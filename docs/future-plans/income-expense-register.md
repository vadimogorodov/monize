# Income vs Expenses register selection

The chart, the register and a bulk category write share the report-side posting
rule. Use the register listing query to select owned transaction and split IDs
after applying every active filter. Validate the selection under the batch’s
existing write locks before changing categories. Reuse the bulk update path for
category fit, reconciled rows, audit history and the split parent’s amount.

See the [verification tasks](income-expense-register-tasks.md) and
[accepted examples](../specs/split-bulk-update.md#selection-from-an-income-vs-expenses-bar).
