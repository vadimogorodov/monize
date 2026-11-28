import type { PeriodResultReason } from './net-worth';

export interface CategorySpendingComparisonItem {
  categoryId: string | null;
  categoryName: string;
  color: string | null;
  currentTotal: number;
  previousTotal: number;
  change: number | null;
  /** Undefined as a percentage when new net refunds have no spending baseline. */
  changePercent: number | null;
}

export interface PartialMonthFlows {
  missingCurrencies: string[];
  knownIncome: number;
  knownExpenses: number;
  knownSavings: number;
}

export interface PartialMonthSpending {
  missingCurrencies: string[];
  knownSpending: number;
}

export interface MonthlyComparisonIncomeExpenses {
  currentMonth: string;
  previousMonth: string;
  currentIncome: number | null;
  previousIncome: number | null;
  incomeChange: number | null;
  incomeChangePercent: number | null;
  currentExpenses: number | null;
  previousExpenses: number | null;
  expensesChange: number | null;
  expensesChangePercent: number | null;
  currentSavings: number | null;
  previousSavings: number | null;
  savingsChange: number | null;
  savingsChangePercent: number | null;

  currentPartial?: PartialMonthFlows;

  previousPartial?: PartialMonthFlows;
}

export interface MonthlyComparisonNotes {
  savingsNote: string | null;
  incomeNote: string | null;
}

export interface CategorySpendingSnapshot {
  categoryId: string | null;
  categoryName: string;
  color: string | null;
  total: number;
  percentage?: number;
}

export interface MonthlyComparisonExpenses {
  netSpending?: true;
  currentMonth: CategorySpendingSnapshot[];
  previousMonth: CategorySpendingSnapshot[];
  comparison: CategorySpendingComparisonItem[];
  currentTotal: number | null;
  previousTotal: number | null;

  currentPartial?: PartialMonthSpending;

  previousPartial?: PartialMonthSpending;
}

export interface TopCategoriesComparison {
  currentMonth: CategorySpendingSnapshot[];
  previousMonth: CategorySpendingSnapshot[];
}

export interface NetWorthMonthlyPoint {
  month: string;
  /** A subtotal of what converted when `fxComplete` is `false`. */
  netWorth: number;
  /** Read as `=== false`; absent (an older backend) is no information. */
  fxComplete?: boolean;
  /** `"ZZZ->USD"` for each pair this month could not convert. */
  missingRatePairs?: string[];
}

/**
 * The net worth block. The four headline figures are `null` when a month
 * could not be fully converted; `knownCurrentNetWorth` / `knownPreviousNetWorth`
 * carry the subtotal that did, to be shown marked as partial.
 */
export interface MonthlyComparisonNetWorth {
  monthlyHistory: NetWorthMonthlyPoint[];
  currentNetWorth: number | null;
  previousNetWorth: number | null;
  netWorthChange: number | null;
  netWorthChangePercent: number | null;
  knownCurrentNetWorth?: number;
  knownPreviousNetWorth?: number;
  fxComplete?: boolean;
  missingRatePairs?: string[];
}

export interface InvestmentAccountPerformance {
  accountId: string;
  accountName: string;
  /** The securities' value at `periodEnd`, cash excluded; null when unknown. */
  currentValue: number | null;
  /** The securities' value at `periodStart`, cash excluded; null when unknown. */
  startValue: number | null;
  /** What the investments earned over the window, net of buys and sales. */
  investmentPnl: number | null;
  /**
   * The invested part's time-weighted return over the trailing year, in
   * percent. Deposits, purchases and idle cash move nothing. Null when the
   * server withheld it; `returnReasons` says why.
   */
  returnPercent: number | null;
  returnReasons: PeriodResultReason[];
  periodStart: string;
  periodEnd: string;
}

export interface InvestmentTopMover {
  securityId: string;
  symbol: string;
  name: string;
  currentPrice: number;
  previousPrice: number;
  change: number;
  changePercent: number;
  marketValue: number | null;
}

export interface MonthlyComparisonInvestments {
  accountPerformance: InvestmentAccountPerformance[];
  topMovers: InvestmentTopMover[];
}

export interface MonthlyComparisonResponse {
  currentMonth: string;
  previousMonth: string;
  currentMonthLabel: string;
  previousMonthLabel: string;
  currency: string;
  incomeExpenses: MonthlyComparisonIncomeExpenses;
  notes: MonthlyComparisonNotes;
  expenses: MonthlyComparisonExpenses;
  topCategories: TopCategoriesComparison;
  netWorth: MonthlyComparisonNetWorth;
  investments: MonthlyComparisonInvestments;
}
