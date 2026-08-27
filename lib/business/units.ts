// The three measurement units an ingredient can be stocked/costed in.
// `unit_type` is stored as plain text on `ingredients` (see
// database_schema.sql) — this is the single source of truth for the values
// that column is allowed to hold and how each one is labeled, shared by the
// ingredient form (where it's set) and the product/recipe UI (where it's
// only ever displayed) so the two can never drift apart.
export const UNIT_TYPES = [
  { value: 'pieces', label: 'Pieces', shortLabel: 'pcs' },
  { value: 'grams', label: 'Grams', shortLabel: 'g' },
  { value: 'ml', label: 'Milliliters', shortLabel: 'ml' },
] as const

export type UnitType = (typeof UNIT_TYPES)[number]['value']

export function unitLabel(unitType: string) {
  return UNIT_TYPES.find(u => u.value === unitType)?.shortLabel ?? unitType
}
