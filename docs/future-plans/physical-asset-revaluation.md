# Exclude physical asset revaluations from economic reports

Apply the [financial rule and fixtures](../specs/physical-asset-revaluation.md) from [Discussion #2534](https://github.com/kenlasko/monize/discussions/2534). Use existing posting categories as the input. No new ledger data is required for a configured valuation category.

1. Start with Year Over Year Comparison and Tax Summary. Reuse the tenant-scoped valuation category check already in the built-in reports. Run the annual reports against PostgreSQL with separate upward and downward postings and a mixed split. Compare the income and expense figures with Income vs Expenses.
2. Trace the date and payee selection in weekend, anomaly, recurring and bill reports, and the income fallback in Savings Rate. A valuation can alter the date at which history starts even if its amount never reaches a displayed total. Exercise a genuine payment after a matching manual valuation.
3. Trace the MCP and AI tools to their transaction queries, including grouped flows and period comparisons. Distinguish a net expense from a gross outgoing amount. Exercise both adapters. Check the independent financial summary resource, Insights aggregation and forecast history with the same transactions.
4. Recheck the explicit category list and register, the change in balance and net worth, and eligible transactions with missing FX. Run the fixtures on the combined revision and record the verified SHA for each entry point before the final PR review.

See the [implementation checklist](physical-asset-revaluation-tasks.md).
