/**
 * Day capture model aligned with Flow `config/daily/daily-template.md`.
 * Quick Snapshot, TaskScore, and Notes emoji are handled in Flow.
 */

export type EventKind = 'med' | 'food' | 'note' | 'sleep' | 'movement'

/** Timeline filter tab: `all` shows every entry; a kind filters the list. */
export type TimelineTabId = 'all' | EventKind

export interface DayEvent {
  id: string
  /** ISO 8601 local intent: built from selected calendar date + chosen clock time. */
  at: string
  fuzzy: boolean
  kind: EventKind
  text: string
  /** Log & movement: minutes after `at`; timeline + export show `5:30 PM–6:30 PM` span. */
  durationMinutes?: number
  /** If set with duration: `at` is the end of the span (backward range); if omitted, `at` is the start. */
  durationAnchor?: 'start' | 'end'
  /** Sleep: duration or amount (e.g. `7.5h`, `~6h`). */
  sleepQuantity?: string
  /** Sleep: how it felt (e.g. `solid`, `fragmented`). */
  sleepQuality?: string
  /** Sleep: when true, no time on timeline/export; row sorts to the top. `at` is start of that calendar day. */
  sleepOmitTime?: boolean
  /** Reserved; always empty — Flow assigns symbols when formatting Notes. */
  symbol: string
}

export interface DayRecord {
  /** Calendar date YYYY-MM-DD (local). */
  date: string
  events: DayEvent[]
}

export type MedPreset = {
  id: string
  /** Full line text after time in Med log (name, dose, notes). */
  label: string
}
