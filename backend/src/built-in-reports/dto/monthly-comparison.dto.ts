import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import type { PeriodResultReason } from "../../net-worth/portfolio-period-result.util";

export class CategorySpendingComparisonItem {
  @ApiPropertyOptional()
  categoryId: string | null;

  @ApiProperty()
  categoryName: string;

  @ApiPropertyOptional()
  color: string | null;

  @ApiProperty()
  currentTotal: number;

  @ApiProperty()
  previousTotal: number;

  @ApiProperty({ type: Number, nullable: true })
  change: number | null;

  /** A new net credit has no percentage change against a previous zero. */
  @ApiProperty({ type: Number, nullable: true })
  changePercent: number | null;
}

export class PartialMonthFlows {
  @ApiProperty({ type: [String] })
  missingCurrencies: string[];
  @ApiProperty()
  knownIncome: number;
  @ApiProperty()
  knownExpenses: number;
  @ApiProperty()
  knownSavings: number;
}

export class PartialMonthSpending {
  @ApiProperty({ type: [String] })
  missingCurrencies: string[];
  @ApiProperty()
  knownSpending: number;
}

export class MonthlyComparisonIncomeExpenses {
  @ApiProperty()
  currentMonth: string;

  @ApiProperty()
  previousMonth: string;

  @ApiProperty({ type: Number, nullable: true })
  currentIncome: number | null;

  @ApiProperty({ type: Number, nullable: true })
  previousIncome: number | null;

  @ApiProperty({ type: Number, nullable: true })
  incomeChange: number | null;

  @ApiProperty({ type: Number, nullable: true })
  incomeChangePercent: number | null;

  @ApiProperty({ type: Number, nullable: true })
  currentExpenses: number | null;

  @ApiProperty({ type: Number, nullable: true })
  previousExpenses: number | null;

  @ApiProperty({ type: Number, nullable: true })
  expensesChange: number | null;

  @ApiProperty({ type: Number, nullable: true })
  expensesChangePercent: number | null;

  @ApiProperty({ type: Number, nullable: true })
  currentSavings: number | null;

  @ApiProperty({ type: Number, nullable: true })
  previousSavings: number | null;

  @ApiProperty({ type: Number, nullable: true })
  savingsChange: number | null;

  @ApiProperty({ type: Number, nullable: true })
  savingsChangePercent: number | null;

  @ApiPropertyOptional({ type: PartialMonthFlows })
  currentPartial?: PartialMonthFlows;

  @ApiPropertyOptional({ type: PartialMonthFlows })
  previousPartial?: PartialMonthFlows;
}

export class MonthlyComparisonNotes {
  @ApiProperty({ type: String, nullable: true })
  savingsNote: string | null;

  @ApiProperty({ type: String, nullable: true })
  incomeNote: string | null;
}

export class CategorySpendingSnapshot {
  @ApiPropertyOptional()
  categoryId: string | null;

  @ApiProperty()
  categoryName: string;

  @ApiPropertyOptional()
  color: string | null;

  @ApiProperty()
  total: number;

  /** The category report's share when this month is a complete, nonnegative whole. */
  @ApiPropertyOptional()
  percentage?: number;
}

export class MonthlyComparisonExpenses {
  /** Both monthly snapshots preserve signed net expense categories. */
  @ApiPropertyOptional({ example: true })
  netSpending?: true;

  @ApiProperty({ type: [CategorySpendingSnapshot] })
  currentMonth: CategorySpendingSnapshot[];

  @ApiProperty({ type: [CategorySpendingSnapshot] })
  previousMonth: CategorySpendingSnapshot[];

  @ApiProperty({ type: [CategorySpendingComparisonItem] })
  comparison: CategorySpendingComparisonItem[];

  @ApiProperty({ type: Number, nullable: true })
  currentTotal: number | null;

  @ApiProperty({ type: Number, nullable: true })
  previousTotal: number | null;

  @ApiPropertyOptional({ type: PartialMonthSpending })
  currentPartial?: PartialMonthSpending;

  @ApiPropertyOptional({ type: PartialMonthSpending })
  previousPartial?: PartialMonthSpending;
}

export class TopCategoriesComparison {
  @ApiProperty({ type: [CategorySpendingSnapshot] })
  currentMonth: CategorySpendingSnapshot[];

  @ApiProperty({ type: [CategorySpendingSnapshot] })
  previousMonth: CategorySpendingSnapshot[];
}

export class NetWorthMonthlyPoint {
  @ApiProperty()
  month: string;

  /** A subtotal of what converted while `fxComplete` is false. */
  @ApiProperty()
  netWorth: number;

  /** False when a component of this month had no rate; see `missingRatePairs`. */
  @ApiProperty()
  fxComplete: boolean;

  @ApiProperty({ type: [String] })
  missingRatePairs: string[];
}

/**
 * The two compared months' net worth. A month's figure is a total only while its
 * own conversion was complete (`docs/financial-calculation-contract.md` section
 * 1): otherwise `currentNetWorth` / `previousNetWorth` are null and the sum of
 * what converted is in the matching `known*` field. The change is a difference
 * of two totals, so it is null unless both months are complete.
 */
export class MonthlyComparisonNetWorth {
  @ApiProperty({ type: [NetWorthMonthlyPoint] })
  monthlyHistory: NetWorthMonthlyPoint[];

  @ApiProperty({ type: Number, nullable: true })
  currentNetWorth: number | null;

  @ApiProperty({ type: Number, nullable: true })
  previousNetWorth: number | null;

  @ApiProperty()
  knownCurrentNetWorth: number;

  @ApiProperty()
  knownPreviousNetWorth: number;

  @ApiProperty({ type: Number, nullable: true })
  netWorthChange: number | null;

  @ApiProperty({ type: Number, nullable: true })
  netWorthChangePercent: number | null;

  /** True only when both compared months converted completely. */
  @ApiProperty()
  fxComplete: boolean;

  /** `"JPY->USD"` for each pair either compared month had no rate for. */
  @ApiProperty({ type: [String] })
  missingRatePairs: string[];
}

export class InvestmentAccountPerformance {
  @ApiProperty()
  accountId: string;

  @ApiProperty()
  accountName: string;

  /** The securities' value at the end of the window, cash excluded; null when unknown. */
  @ApiPropertyOptional({ type: Number, nullable: true })
  currentValue: number | null;

  /** The securities' value at the start of the window, cash excluded; null when unknown. */
  @ApiPropertyOptional({ type: Number, nullable: true })
  startValue: number | null;

  /** What the investments earned over the window, net of buys and sales. */
  @ApiPropertyOptional({ type: Number, nullable: true })
  investmentPnl: number | null;

  /**
   * The invested part's time-weighted return over the trailing year to
   * `periodEnd`, in percent. Deposits, purchases and idle cash move nothing.
   * Null when withheld; `returnReasons` says why.
   */
  @ApiPropertyOptional({ type: Number, nullable: true })
  returnPercent: number | null;

  @ApiProperty({ type: [String] })
  returnReasons: PeriodResultReason[];

  @ApiProperty()
  periodStart: string;

  @ApiProperty()
  periodEnd: string;
}

export class InvestmentTopMover {
  @ApiProperty()
  securityId: string;

  @ApiProperty()
  symbol: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  currentPrice: number;

  @ApiProperty()
  previousPrice: number;

  @ApiProperty()
  change: number;

  @ApiProperty()
  changePercent: number;

  @ApiPropertyOptional()
  marketValue: number | null;
}

export class MonthlyComparisonInvestments {
  @ApiProperty({ type: [InvestmentAccountPerformance] })
  accountPerformance: InvestmentAccountPerformance[];

  @ApiProperty({ type: [InvestmentTopMover] })
  topMovers: InvestmentTopMover[];
}

export class MonthlyComparisonResponse {
  @ApiProperty()
  currentMonth: string;

  @ApiProperty()
  previousMonth: string;

  @ApiProperty()
  currentMonthLabel: string;

  @ApiProperty()
  previousMonthLabel: string;

  @ApiProperty()
  currency: string;

  @ApiProperty({ type: MonthlyComparisonIncomeExpenses })
  incomeExpenses: MonthlyComparisonIncomeExpenses;

  @ApiProperty({ type: MonthlyComparisonNotes })
  notes: MonthlyComparisonNotes;

  @ApiProperty({ type: MonthlyComparisonExpenses })
  expenses: MonthlyComparisonExpenses;

  @ApiProperty({ type: TopCategoriesComparison })
  topCategories: TopCategoriesComparison;

  @ApiProperty({ type: MonthlyComparisonNetWorth })
  netWorth: MonthlyComparisonNetWorth;

  @ApiProperty({ type: MonthlyComparisonInvestments })
  investments: MonthlyComparisonInvestments;
}
