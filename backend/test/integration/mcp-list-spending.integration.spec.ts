import { AccountsService } from "@/accounts/accounts.service";
import { ToolExecutorService } from "@/ai/query/tool-executor.service";
import { Test, TestingModule } from "@nestjs/testing";
import { DataSource } from "typeorm";
import { withUserContext } from "@/common/db/with-context";
import { McpTransactionsTools } from "@/mcp/tools/transactions.tool";
import { mcpTestCtx } from "@/mcp/testing/mcp-test-context";
import { PayeesService } from "@/payees/payees.service";
import { SharedReviewService } from "@/shared-expenses/shared-review.service";
import { Transaction } from "@/transactions/entities/transaction.entity";
import { TransactionSplit } from "@/transactions/entities/transaction-split.entity";
import { TransactionAnalyticsService } from "@/transactions/transaction-analytics.service";
import { TransactionsModule } from "@/transactions/transactions.module";
import { TransactionsService } from "@/transactions/transactions.service";
import { UserPreference } from "@/users/entities/user-preference.entity";
import {
  cleanTables,
  createIntegrationModule,
  createTestUserDirect,
} from "../helpers/integration-setup";
import {
  createTestAccount,
  createTestCategory,
  createTestPayee,
} from "../helpers/test-factories";

describe("list_transactions grouped spending through MCP (USD)", () => {
  let module: TestingModule;
  let tools: TestingModule;
  let db: DataSource;
  let userId: string;
  let accountId: string;
  let categoryId: string;
  let payeeId: string;
  const registerTool = jest.fn();
  const startDate = "2026-11-01";
  const endDate = "2026-12-31";

  beforeAll(async () => {
    module = await createIntegrationModule([TransactionsModule]);
    db = module.get(DataSource);
    tools = await Test.createTestingModule({
      providers: [
        McpTransactionsTools,
        ToolExecutorService,
        ...[
          AccountsService,
          PayeesService,
          TransactionAnalyticsService,
          TransactionsService,
        ].map((provide) => ({ provide, useValue: module.get(provide) })),
        { provide: SharedReviewService, useValue: new SharedReviewService(db) },
      ],
    })
      .useMocker(() => ({}))
      .compile();
    tools.get(McpTransactionsTools).register({ registerTool } as never);
  });
  afterAll(async () => {
    await tools?.close();
    await module?.close();
  });
  beforeEach(async () => {
    await cleanTables(db, [
      "transaction_splits",
      "transactions",
      "accounts",
      "categories",
      "payees",
      "users",
    ]);
    userId = (await createTestUserDirect(db)).id;
    accountId = (
      await createTestAccount(db, userId, {
        name: "Checking",
        currencyCode: "USD",
      })
    ).id;
    await db.manager.save(UserPreference, { userId, defaultCurrency: "USD" });
    categoryId = (await createTestCategory(db, userId, { name: "Groceries" }))
      .id;
    payeeId = (await createTestPayee(db, userId, { name: "Shop" })).id;
  });

  function post(amount: number, overrides: Partial<Transaction> = {}) {
    return db.manager.save(Transaction, {
      userId,
      accountId,
      categoryId,
      payeeId,
      amount,
      currencyCode: "USD",
      transactionDate: startDate,
      ...overrides,
    });
  }

  async function list(
    direction: "expenses" | "outgoing",
    groupBy: "category" | "payee" | "month" | "week" | "year",
    filters = {},
  ) {
    const [, config, handler] = registerTool.mock.calls.find(
      ([name]) => name === "list_transactions",
    )!;
    const args = config.inputSchema.parse({
      startDate,
      endDate,
      direction,
      groupBy,
      ...filters,
    });
    const result = await withUserContext<{ structuredContent: unknown }>(
      userId,
      () => handler(args, mcpTestCtx({ userId, scopes: "read" })),
    );
    expect(result).not.toHaveProperty("isError", true);
    return config.outputSchema.parse(result.structuredContent);
  }

  it.each([
    ["categoryNames", "Groceries", "Books"],
    ["accountNames", "Checking", "Cash"],
    ["payeeNames", "Shop", "Bookstore"],
  ] as const)(
    "applies every %s selection to detail rows and their count",
    async (field, first, second) => {
      const purchase = await post(-25);
      const book = await post(-10, {
        transactionDate: "2026-11-02",
        categoryId: (await createTestCategory(db, userId, { name: "Books" }))
          .id,
        accountId: (
          await createTestAccount(db, userId, {
            name: "Cash",
            currencyCode: "USD",
          })
        ).id,
        payeeId: (await createTestPayee(db, userId, { name: "Bookstore" })).id,
      });
      await post(-90, {
        categoryId: (
          await createTestCategory(db, userId, { name: "Other expense" })
        ).id,
        accountId: (
          await createTestAccount(db, userId, {
            name: "Other account",
            currencyCode: "USD",
          })
        ).id,
        payeeId: (await createTestPayee(db, userId, { name: "Other shop" })).id,
      });
      const filters = {
        includeTransactions: true,
        sortBy: "date",
        sortDirection: "asc",
      };
      const expectedRows = [
        { id: purchase.id, amount: -25 },
        { id: book.id, amount: -10 },
      ];
      for (const names of [
        [first, second],
        [second, first],
      ]) {
        const args = { ...filters, [field]: names };
        const expected = {
          totalExpenses: 35,
          total: 2,
          hasMore: false,
          truncatedTransactionList: false,
          transactions: expectedRows,
        };
        expect(await list("outgoing", "month", args)).toMatchObject(expected);
        const ai = await withUserContext(userId, () =>
          tools.get(ToolExecutorService).execute(userId, "list_transactions", {
            startDate,
            endDate,
            direction: "outgoing",
            groupBy: "month",
            ...args,
          }),
        );
        expect(ai.data).toMatchObject(expected);
        expect(
          await list("outgoing", "month", { ...args, limit: 1 }),
        ).toMatchObject({
          totalExpenses: 35,
          total: 2,
          hasMore: true,
          truncatedTransactionList: true,
          transactions: [expectedRows[0]],
        });
      }
      expect(
        await list("outgoing", "month", { ...filters, [field]: [second] }),
      ).toMatchObject({
        totalExpenses: 10,
        total: 1,
        hasMore: false,
        transactions: [expectedRows[1]],
      });
    },
  );

  it.each([30, 100, 150])(
    "nets a %i USD refund in every grouping and keeps cash flows separate",
    async (refund) => {
      // Three independent debits meet the payee disclosure threshold even in outgoing.
      for (const debit of [-30, -30, -40]) await post(debit);
      await post(refund);
      for (const groupBy of ["category", "payee", "month"] as const) {
        const label = {
          category: "Groceries",
          payee: "Shop",
          month: "2026-11",
        }[groupBy];
        for (const [direction, total, count] of [
          ["expenses", 100 - refund, 4],
          ["outgoing", 100, 3],
        ] as const) {
          const result = await list(direction, groupBy);
          const ai = await withUserContext(userId, () =>
            tools
              .get(ToolExecutorService)
              .execute(userId, "list_transactions", {
                startDate,
                endDate,
                direction,
                groupBy,
              }),
          );
          expect(ai.isError).toBeFalsy();
          expect(ai.data).toMatchObject({
            breakdown: result.breakdown,
            netCashFlow: refund - 100,
          });

          expect(result).toMatchObject({
            totalIncome: refund,
            totalExpenses: 100,
            netCashFlow: refund - 100,
            totalsCurrency: "USD",
            breakdown: [{ [groupBy]: label, total, count }],
          });
        }
      }
    },
  );

  it("keeps linked payees and free text separate when their stored names match", async () => {
    const secondId = (await createTestPayee(db, userId, { name: "Birch" })).id;
    for (const transactionDate of [startDate, "2026-11-02", "2026-11-03"]) {
      await post(-12, { payeeId, payeeName: "Shop", transactionDate });
      await post(-7, { payeeId: secondId, payeeName: "Shop", transactionDate });
      await post(-2, { payeeId: null, payeeName: "Shop", transactionDate });
    }
    for (const direction of ["expenses", "outgoing"] as const) {
      const result = await list(direction, "payee");
      expect(result.breakdown).toMatchObject([
        { payee: "Shop", payeeId, total: 36, count: 3 },
        { payee: "Birch", payeeId: secondId, total: 21, count: 3 },
        { payee: "Shop", payeeId: null, total: 6, count: 3 },
      ]);
      const ai = await withUserContext(userId, () =>
        tools.get(ToolExecutorService).execute(userId, "list_transactions", {
          startDate,
          endDate,
          direction,
          groupBy: "payee",
        }),
      );
      expect(ai.isError).toBeFalsy();
      expect(ai.data).toMatchObject({ breakdown: result.breakdown });
      for (const row of result.breakdown) {
        if (!row.payeeId) continue;
        const detail = await withUserContext(userId, () =>
          module
            .get(TransactionsService)
            .findAll(userId, undefined, startDate, endDate, undefined, [
              row.payeeId,
            ]),
        );
        expect(detail.data).toHaveLength(row.count);
        expect(
          -detail.data.reduce((sum, tx) => sum + Number(tx.amount), 0),
        ).toBe(row.total);
      }
    }
  });

  it("applies the disclosure threshold per payee before pooling small totals", async () => {
    const secondId = (await createTestPayee(db, userId, { name: "Birch" })).id;
    for (const id of [payeeId, secondId]) {
      await post(-4, { payeeId: id, payeeName: "Shared text" });
      await post(-6, { payeeId: id, payeeName: "Shared text" });
    }
    expect(await list("expenses", "payee")).toMatchObject({
      breakdown: [
        { payee: "Other (aggregated)", payeeId: null, total: 20, count: 4 },
      ],
    });
  });

  it("keeps the December refund signed when November holds the purchase", async () => {
    await post(-100);
    await post(30, { transactionDate: "2026-12-02" });
    expect(await list("expenses", "month")).toMatchObject({
      netCashFlow: -70,
      breakdown: [
        { month: "2026-11", total: 100 },
        { month: "2026-12", total: -30 },
      ],
    });
    expect(await list("expenses", "year")).toMatchObject({
      breakdown: [{ year: "2026", total: 70 }],
    });
    expect(await list("expenses", "week")).toMatchObject({
      breakdown: [
        { week: "2026-10-26", total: 100 },
        { week: "2026-11-30", total: -30 },
      ],
    });
    expect(await list("expenses", "payee")).toMatchObject({
      breakdown: [
        { payee: "Other (aggregated)", payeeId: null, total: 70, count: 2 },
      ],
    });
  });

  it("classifies splits before grouping and counts their payee once per transaction", async () => {
    const income = (
      await createTestCategory(db, userId, { name: "Salary", isIncome: true })
    ).id;
    const parent = await post(-100, { isSplit: true, categoryId: null });
    await db.manager.save(TransactionSplit, [
      { transactionId: parent.id, categoryId, amount: -40 },
      { transactionId: parent.id, categoryId, amount: -30 },
      { transactionId: parent.id, categoryId: income, amount: -30 },
    ]);
    await post(30);
    await post(-10, { categoryId: null });
    for (const direction of ["expenses", "outgoing"] as const) {
      const expected = direction === "expenses" ? 40 : 110;
      expect(await list(direction, "payee")).toMatchObject({
        breakdown: [
          {
            payee: "Other (aggregated)",
            payeeId: null,
            total: expected,
            count: 2,
          },
        ],
      });
      for (const categoryNames of [
        ["Groceries", "Salary"],
        ["Salary", "Groceries"],
      ]) {
        expect(await list(direction, "month", { categoryNames })).toMatchObject(
          { breakdown: [{ total: direction === "expenses" ? 40 : 100 }] },
        );
      }
    }
  });
});
