import { categoryTypeIs } from "../categories/category-type.util";
import { investmentExclusionSql } from "./investment-filter.util";

export enum IncomeExpenseSide {
  Income = "income",
  Expense = "expense",
}

/** Classify the posting at its own grain, including reversals and refunds. */
export function matchesIncomeExpenseSide(
  category: string,
  amount: string,
  side: IncomeExpenseSide,
): string {
  const classified =
    side === IncomeExpenseSide.Income
      ? categoryTypeIs(category, "income")
      : categoryTypeIs(category, "expense");
  const sign = side === IncomeExpenseSide.Income ? ">" : "<";
  return `(${classified} OR (${category}.id IS NULL AND ${amount} ${sign} 0))`;
}

/** The cash postings included in the Income vs Expenses report. */
export function incomeExpensePostingScope(t: string, s: string): string {
  return `${t}.is_transfer = false
    AND (${t}.status IS NULL OR ${t}.status != 'VOID')
    AND ${t}.parent_transaction_id IS NULL
    AND ${s}.transfer_account_id IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM accounts ax WHERE ax.user_id = ${t}.user_id
        AND ax.asset_category_id = COALESCE(${s}.category_id, ${t}.category_id)
    )`;
}

/** Evaluate on the joined split so only contributing lines are hydrated and summed. */
export function registerIncomeExpensePosting(
  txAlias: string,
  splitAlias: string,
  side: IncomeExpenseSide,
): string {
  const t = `"${txAlias}"`;
  const s = `"${splitAlias}"`;
  const amount = `COALESCE(${s}.amount, ${t}.amount)`;
  return `${t}.user_id = :incomeExpenseOwner AND EXISTS (
    SELECT 1 FROM accounts report_account
    LEFT JOIN categories report_category ON report_category.id = COALESCE(${s}.category_id, ${t}.category_id)
    WHERE report_account.id = ${t}.account_id
      AND ${investmentExclusionSql({ transactionAlias: t, splitAlias: s, accountAlias: "report_account" })}
      AND ${incomeExpensePostingScope(t, s)}
      AND ${matchesIncomeExpenseSide("report_category", amount, side)}
  )`;
}
