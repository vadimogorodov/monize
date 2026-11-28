# Physical asset revaluations in financial reports

The **Update Value** action records the difference between the old and new values of a physical asset. The register, account balance and net worth use that difference. A report of income, expenses, savings or cash movement should count zero for this entry, whether the appraisal went up or down. [Discussion #2534](https://github.com/kenlasko/monize/discussions/2534)

## Identifying the posting

Use the same category identity as Income vs Expenses. Check the effective category of the posting against the asset value change categories configured on accounts belonging to the transaction's owner. On a split, classify each component before summing. A real purchase, sale, payment or refund keeps its ordinary report treatment. An explicitly filtered transaction list can still show the appraisal posting.

The account type, amount sign and translated memo do not establish that a posting was an appraisal. A category lookup with no match preserves the report's treatment of that posting. A valuation excluded before currency conversion requires no rate. An eligible payment with an unavailable rate still follows the report's existing missing-rate contract.

## Numerical acceptance cases

Use one user, one reporting month and one currency. The configured valuation category is an expense category. Each scenario starts from its own baseline.

| Entries | Surface | Expected |
| --- | --- | --- |
| Salary +120, deductible purchase −30, then independently a valuation +75 or −50 | Year Over Year Comparison and Tax Summary | Income 120 and expenses 30. Monthly and annual savings 90. Deductible expenses 30. |
| Same salary and purchase, asset starting at 1000 | Register, balance, net worth and the explicit category list | Updated asset balance 1075 or 950. Net worth moves by +75 or −50. The valuation row carries that signed delta. |
| Valuation −75 alongside an ordinary −30 purchase in a split | Annual reports | Qualifying expense 30. Both standalone and split representations give the same result. |
| Salary +120, expense −30, appraisal +75 | Savings Rate with no budget income rows, MCP Financial Summary, AI Insights and AI Forecast history | Savings rate 75%. Monthly financial summary and forecast inputs show income 120, expenses 30, net movement 90. Insights shows expenses 30. |
| Purchase −32, refund +12, appraisal −75 | Registered MCP tools and the AI executor | Net expense 20, gross outgoing 32, net cash movement −20. |
| Old or repeated valuations, including a manually entered one with the payee and amount of a scheduled bill | Weekend vs Weekday, anomalies, recurring expenses and bill history | The valuation contributes no spending, adds no purchase to the sample, starts no recurring series and settles no bill. An ordinary matching payment still counts. |
