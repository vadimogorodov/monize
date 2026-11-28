/** Exclude this owner's configured asset valuation categories from a cash measure. */
export function assetValueChangeExclusionSql(
  transactionAlias: string,
  splitAlias?: string,
): string {
  const category = splitAlias
    ? `COALESCE(${splitAlias}.category_id, ${transactionAlias}.category_id)`
    : `${transactionAlias}.category_id`;
  return `NOT EXISTS (
    SELECT 1 FROM accounts ax
    WHERE ax.user_id = ${transactionAlias}.user_id
      AND ax.asset_category_id IS NOT NULL
      AND ax.asset_category_id = ${category}
  )`;
}
