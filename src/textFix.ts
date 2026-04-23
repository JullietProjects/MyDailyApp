import type { EventKind } from './types'

/** Join sleep quantity + quality for storage and export (middle dot separator). */
export function composeSleepLine(quantity: string, quality: string): string {
  const q = quantity.trim()
  const ql = quality.trim()
  if (q && ql) return `${q} · ${ql}`
  return q || ql
}

/** Best-effort split when loading legacy rows that only have `text`. */
export function parseSleepFromText(text: string): { q: string; qual: string } {
  const t = text.trim()
  const idx = t.indexOf(' · ')
  if (idx === -1) return { q: t, qual: '' }
  return { q: t.slice(0, idx).trim(), qual: t.slice(idx + 3).trim() }
}

export type FoodRow = { macros: string; food: string }

const FOOD_OF_LEGACY = ' of '

/** First segment looks like an amount (e.g. `2`, `100g`, `12.5 oz`). */
function isAmountToken(s: string): boolean {
  return /^\d+(?:\.\d+)?(?:g|mg|ml|mL|oz)?$/i.test(s) || /^\d+(?:\.\d+)?$/.test(s)
}

/** Legacy food `100g · beans` → `100g beans` (space, not “of”). */
function foodSegmentDotToSpace(segment: string): string {
  const t = segment.replace(/\s+/g, ' ').trim()
  if (!t) return t
  const dot = ' · '
  const dotIdx = t.indexOf(dot)
  if (dotIdx === -1) return t
  const a = t.slice(0, dotIdx).trim()
  const b = t.slice(dotIdx + dot.length).trim()
  if (a && b) return `${a} ${b}`
  return t
}

/** Meal parts in stored `text`: `+` between items; also accepts legacy `;` or newline. */
export function splitFoodMealParts(raw: string): string[] {
  return raw
    .trim()
    .split(/\s*\+\s*|\s*;\s*|\n+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function parseFoodSegmentToRow(segment: string): FoodRow {
  const normalized = foodSegmentDotToSpace(segment)
  if (!normalized) return { macros: '', food: '' }
  const ofIdx = normalized.indexOf(FOOD_OF_LEGACY)
  if (ofIdx !== -1) {
    return {
      macros: normalized.slice(0, ofIdx).trim(),
      food: normalized.slice(ofIdx + FOOD_OF_LEGACY.length).trim(),
    }
  }
  const sp = normalized.indexOf(' ')
  if (sp === -1) {
    return { macros: '', food: normalized }
  }
  const first = normalized.slice(0, sp).trim()
  const rest = normalized.slice(sp + 1).trim()
  if (isAmountToken(first)) {
    return { macros: first, food: rest }
  }
  return { macros: '', food: normalized }
}

/** Multiple UI rows → one timeline line, e.g. `100g beans + 2 avocado toast`. */
export function foodRowsToText(rows: FoodRow[]): string {
  const parts: string[] = []
  for (const { macros, food } of rows) {
    const m = macros.trim().replace(/\s+/g, ' ')
    const f = food.trim().replace(/\s+/g, ' ')
    if (!m && !f) continue
    if (m && f) parts.push(`${m} ${f}`)
    else parts.push(m || f)
  }
  return parts.join(' + ').trim()
}

/** Inverse of `foodRowsToText` (legacy `amount of food` or `amount food`). */
export function parseFoodRows(text: string): FoodRow[] {
  const segments = splitFoodMealParts(text)
  if (segments.length === 0) return [{ macros: '', food: '' }]
  return segments.map(parseFoodSegmentToRow)
}

/** Light cleanup before save (trim, collapse internal whitespace). */
export function formatEntryText(raw: string, kind: EventKind): string {
  if (kind === 'food') {
    return splitFoodMealParts(raw)
      .map((p) => foodSegmentDotToSpace(p))
      .join(' + ')
      .trim()
  }
  const t = raw.trim().replace(/\s+/g, ' ')
  if (!t) return ''
  if (kind === 'sleep') return t
  return t
}
