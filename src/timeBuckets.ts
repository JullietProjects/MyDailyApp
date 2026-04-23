/** Flow template: Morning until ~1 PM; Afternoon ~1–7 PM; Night ~7 PM onward. */
export type DayPeriod = 'morning' | 'afternoon' | 'night'

export function getPeriod(atIso: string): DayPeriod {
  const d = new Date(atIso)
  const mins = d.getHours() * 60 + d.getMinutes()
  if (mins < 13 * 60) return 'morning'
  if (mins < 19 * 60) return 'afternoon'
  return 'night'
}

export function periodShortLabel(p: DayPeriod): string {
  switch (p) {
    case 'morning':
      return '☀️ Morning'
    case 'afternoon':
      return '🌥️ Afternoon'
    case 'night':
      return '🌙 Night'
  }
}
