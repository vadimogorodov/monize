import { TestingModule } from "@nestjs/testing";
import { DataSource } from "typeorm";
import { Currency } from "@/currencies/entities/currency.entity";
import { UserPreference } from "@/users/entities/user-preference.entity";
import { BuiltInReportsModule } from "@/built-in-reports/built-in-reports.module";
import { IncomeReportsService } from "@/built-in-reports/income-reports.service";
import { IncomeExpenseSide } from "@/common/income-expense-posting";
import { withUserContext } from "@/common/db/with-context";
import { sumMoney } from "@/common/round.util";
import {
  Transaction,
  TransactionStatus,
} from "@/transactions/entities/transaction.entity";
import { TransactionSplit } from "@/transactions/entities/transaction-split.entity";
import { TransactionsModule } from "@/transactions/transactions.module";
import { TransactionsService } from "@/transactions/transactions.service";
import {
  createIntegrationModule,
  createTestUserDirect,
} from "../helpers/integration-setup";
import {
  createTestAccount,
  createTestCategory,
} from "../helpers/test-factories";

describe("Income vs Expenses register drill-down", () => {
  const start = "2025-09-01";
  const end = "2025-09-30";
  let module: TestingModule;
  let db: DataSource;

  beforeAll(async () => {
    module = await createIntegrationModule([
      BuiltInReportsModule,
      TransactionsModule,
    ]);
    db = module.get(DataSource);
    await db
      .getRepository(Currency)
      .save({ code: "EUR", name: "Euro", symbol: "€", decimalPlaces: 2 });
  });

  afterAll(async () => {
    await module.close();
  });

  it.each([false, true])(
    "reconciles both paged selections and the classified-only control (split: %s)",
    async (split) => {
      const { id: userId } = await createTestUserDirect(db);
      await db
        .getRepository(UserPreference)
        .save({ userId, defaultCurrency: "EUR" });
      const { id: accountId } = await createTestAccount(db, userId, {
        currencyCode: "EUR",
      });
      const income = await createTestCategory(db, userId, {
        name: "Salary",
        categoryType: "income",
      });
      const expense = await createTestCategory(db, userId, {
        name: "Supplies",
        categoryType: "expense",
      });
      const save = (amount: number, values: Partial<Transaction> = {}) =>
        db.getRepository(Transaction).save({
          userId,
          accountId,
          currencyCode: "EUR",
          transactionDate: "2025-09-15",
          amount,
          ...values,
        });
      const salary = await save(40, { categoryId: income.id });
      const reversal = await save(-7, { categoryId: income.id });
      const purchase = await save(-30, { categoryId: expense.id });
      const refund = await save(9, { categoryId: expense.id });
      await save(90, { status: TransactionStatus.VOID });
      await save(-50, { transactionDate: "2025-10-01" });
      let receiptId: string;
      let paymentId: string;
      if (split) {
        const parent = await save(-3, {
          isSplit: true,
          transactionDate: "2025-09-20",
        });
        const repo = db.getRepository(TransactionSplit);
        receiptId = (await repo.save({ transactionId: parent.id, amount: 5 }))
          .id;
        paymentId = (await repo.save({ transactionId: parent.id, amount: -8 }))
          .id;
      } else {
        receiptId = (await save(5)).id;
        paymentId = (await save(-8)).id;
      }

      await withUserContext(userId, async () => {
        const report = await module
          .get(IncomeReportsService)
          .getIncomeVsExpenses(userId, start, end);
        expect(report.data).toHaveLength(1);
        expect(report.data[0]).toMatchObject({ income: 38, expenses: 29 });
        const register = module.get(TransactionsService);
        for (const [side, classified, uncategorized, total] of [
          [IncomeExpenseSide.Income, [salary, reversal], receiptId, 38],
          [IncomeExpenseSide.Expense, [purchase, refund], paymentId, -29],
        ] as const) {
          const ordinary = await register.findAll(
            userId,
            undefined,
            start,
            end,
            [side],
          );
          expect(ordinary.data.map((row) => row.id).sort()).toEqual(
            classified.map((row) => row.id).sort(),
          );
          expect(
            sumMoney(
              ordinary.data.map((row) => Number(row.amount)),
              4,
            ),
          ).toBe(side === IncomeExpenseSide.Income ? 33 : -21);
          const postings: { id: string; amount: number }[] = [];
          for (const page of [1, 2]) {
            const args: Parameters<TransactionsService["findAll"]> = [
              userId,
              undefined,
              start,
              end,
              undefined,
              undefined,
              page,
              2,
            ];
            args[22] = side;
            const result = await register.findAll(...args);
            expect(result.startingBalance).toBe(
              total -
                sumMoney(
                  postings.map((row) => Number(row.amount)),
                  4,
                ),
            );
            expect(result.pagination).toMatchObject({
              page,
              total: 3,
              totalPages: 2,
            });
            for (const row of result.data) {
              postings.push(...(row.isSplit ? row.splits : [row]));
            }
          }
          const monthly = await register.getMonthlyTotals(
            userId,
            undefined,
            start,
            end,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            side,
          );
          expect(monthly).toHaveLength(1);
          expect(monthly[0]).toMatchObject({ total, currency: "EUR" });
          expect(postings.map((row) => row.id).sort()).toEqual(
            [...classified.map((row) => row.id), uncategorized].sort(),
          );
          expect(
            sumMoney(
              postings.map((row) => Number(row.amount)),
              4,
            ),
          ).toBe(total);
        }
        if (split) {
          const parent = await save(7, { isSplit: true });
          const lines = db.getRepository(TransactionSplit);
          const match = await lines.save({
            transactionId: parent.id,
            amount: 3,
            memo: "materials",
          });
          await lines.save({
            transactionId: parent.id,
            amount: 4,
            memo: "delivery",
          });
          const args: Parameters<TransactionsService["findAll"]> = [
            userId,
            undefined,
            start,
            end,
          ];
          args[9] = "memo:materials";
          args[22] = IncomeExpenseSide.Income;
          const narrowed = await register.findAll(...args);
          expect(narrowed.startingBalance).toBe(3);
          expect(narrowed.data.map((row) => row.id)).toEqual([parent.id]);
          expect(narrowed.data[0].splits.map((line) => line.id)).toEqual([
            match.id,
          ]);
        }
      });
    },
  );
});
