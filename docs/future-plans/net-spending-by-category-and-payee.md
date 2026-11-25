# Net spending by category and by payee

Proposal for the built-in reports in [discussion #2404](https://github.com/kenlasko/monize/discussions/2404). [PR #2427](https://github.com/kenlasko/monize/pull/2427) addresses Custom Reports. This proposal can be reviewed independently. Its implementation and maintainer approval are pending.

## Proposed decision

Give Spending by Category and Spending by Payee the same net spending measure when the date range, accounts and eligible postings match. Each group shows purchases less refunds for its expense postings. Classify an eligible posting before choosing the grouping. In a month of refunds on earlier purchases, the group's net spending can be negative. Keep a group with qualifying activity when its net is zero.

## Reproduced on PostgreSQL

An isolated PostgreSQL 18.7 check called the existing SpendingReportsService methods at upstream commit `db2ad3e`. Each scenario used a single USD account, one expense category, the same merchant and date, and two ordinary transactions. Neither execution reported an excluded amount or missing currency.

| Signed ledger entries | Current Spending by Category | Current Spending by Payee | Proposed net spending in both |
| --- | ---: | ---: | ---: |
| Purchase −100, refund +30 | 70 | 100 | 70 |
| Purchase −100, refund +150 | 0, with the category omitted | 100 | −50, with activity visible |

## Why the reports differ

[PR #1135](https://github.com/kenlasko/monize/pull/1135) fixed dropped refunds in August 2026. A category's net also served to exclude income categories, so a category with a net credit dropped out. On 19 November the [trivia design](https://github.com/kenlasko/monize/blob/5b2940791047b03fbe06f79087d9020b3da37010/docs/future-plans/trivia-variety.md#35-the-purchase-predicate-is-written-once) recorded the use of the payee report's purchase population for facts such as the largest and most recent purchase. [PR #2293](https://github.com/kenlasko/monize/pull/2293) shipped that work. Gross purchases remain a meaningful measure for those facts.

## Implementation and acceptance

- Derive expense components for both built-in reports from one definition. Use the expense classification of the effective category on a transaction or split, including a positive refund. Reuse the uncategorized fallback of Income vs Expenses: an uncategorized debit contributes spending and an unclassified credit contributes income. Apply the existing transfer, VOID, investment, asset-category and user filters. Group the same resulting components by effective category or payee.
- Accumulate each component in the reporting currency with the existing FX rate and completeness rules. Round each group and whole-population headline from the underlying amounts. Retain negative and zero groups in the data and make them accessible in the UI. A missing required rate withholds the complete headline.
- The payee API currently returns a maximum of 20 payees and a total over the returned set. Keep that labeled subtotal identifiable if the ranked view stays capped. Define a whole-population headline separately. Test with at least 21 payees so both figures can be verified independently.
- Preserve the purchase predicate for facts that need individual purchases. Check report drill-down, dashboard widgets, monthly comparison, AI report tools and trivia consumers for the measure each one actually promises. A purchase-only drill-down cannot substantiate a net spending figure.
- In the database-backed reporting tests, exercise the two reproduced scenarios, full refund, refund without a purchase in the selected period, income from the same payee, split categories, missing FX, and the payee ranking limit. Verify each result against the ledger and compare matched populations across groupings. A signed chart or table must expose both signs when a pie cannot.

The first change in this note concerns the two built-in spending breakdowns. Budget actuals, tax classification and other Custom Report metrics have distinct definitions and acceptance examples under #2404.
