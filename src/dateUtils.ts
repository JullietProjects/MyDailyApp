import type { DayEvent } from './types'

/** `datetime-local` value (local) from an ISO string. */
export function isoToDatetimeLocalValue(iso: string): string {
  const d = new Date(iso)
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const da = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${y}-${mo}-${da}T${h}:${mi}`
}

/** Parse `datetime-local` string as local instant → ISO. */
export function datetimeLocalToIso(value: string): string {
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString()
}

/** Local midnight on the given calendar day (for untimed sleep anchor). */
export function startOfDayIso(dayYmd: string): string {
  const parts = dayYmd.split('-').map(Number)
  const y = parts[0] ?? new Date().getFullYear()
  const m = parts[1] ?? 1
  const day = parts[2] ?? 1
  return new Date(y, m - 1, day, 0, 0, 0, 0).toISOString()
}

/** Current clock on a given calendar day (local). */
export function defaultAtForDay(dayYmd: string): string {
  const parts = dayYmd.split('-').map(Number)
  const y = parts[0] ?? new Date().getFullYear()
  const m = parts[1] ?? 1
  const day = parts[2] ?? 1
  const n = new Date()
  return new Date(y, m - 1, day, n.getHours(), n.getMinutes(), 0, 0).toISOString()
}

/**
 * Timed log span in local time. `fuzzy` applies to the anchor instant (start or end of range).
 * - `timeAnchor: 'start'`: `anchorIso` is range start, range runs forward.
 * - `timeAnchor: 'end'`: `anchorIso` is range end, range runs backward.
 */
export function formatTimeRangeLabel(
  anchorIso: string,
  durationMinutes: number,
  anchorFuzzy: boolean,
  timeAnchor: 'start' | 'end' = 'start',
): string {
  const opts = { hour: 'numeric' as const, minute: '2-digit' as const, hour12: true }
  if (timeAnchor === 'end') {
    const end = new Date(anchorIso)
    const start = new Date(anchorIso)
    start.setMinutes(start.getMinutes() - durationMinutes)
    const a = start.toLocaleTimeString('en-US', opts)
    const b = end.toLocaleTimeString('en-US', opts)
    const right = anchorFuzzy ? `~${b}` : b
    return `${a}–${right}`
  }
  const start = new Date(anchorIso)
  const end = new Date(anchorIso)
  end.setMinutes(end.getMinutes() + durationMinutes)
  const a = start.toLocaleTimeString('en-US', opts)
  const b = end.toLocaleTimeString('en-US', opts)
  const left = anchorFuzzy ? `~${a}` : a
  return `${left}–${b}`
}

export function todayYmd(): string {
  const n = new Date()
  const mo = String(n.getMonth() + 1).padStart(2, '0')
  const da = String(n.getDate()).padStart(2, '0')
  return `${n.getFullYear()}-${mo}-${da}`
}

/** If an event’s local calendar day matches `fromYmd`, rewrite it to `toYmd` keeping clock time. */
export function shiftEventsToDay<T extends { at: string }>(
  events: T[],
  fromYmd: string,
  toYmd: string,
): T[] {
  if (fromYmd === toYmd) return events
  const [fy, fm, fd] = fromYmd.split('-').map(Number)
  const [ty, tm, td] = toYmd.split('-').map(Number)
  return events.map((e) => {
    const d = new Date(e.at)
    if (
      d.getFullYear() !== fy ||
      d.getMonth() + 1 !== fm ||
      d.getDate() !== fd
    ) {
      return e
    }
    const nd = new Date(
      ty,
      (tm ?? 1) - 1,
      td ?? 1,
      d.getHours(),
      d.getMinutes(),
      d.getSeconds(),
      d.getMilliseconds(),
    )
    return { ...e, at: nd.toISOString() }
  })
}

/** Untimed sleep first, then by clock; stable tie-break on id. */
export function compareEventsForTimeline(a: DayEvent, b: DayEvent): number {
  const aTop = a.kind === 'sleep' && a.sleepOmitTime
  const bTop = b.kind === 'sleep' && b.sleepOmitTime
  if (aTop !== bTop) return aTop ? -1 : 1
  const dt = new Date(a.at).getTime() - new Date(b.at).getTime()
  if (dt !== 0) return dt
  return a.id.localeCompare(b.id)
}
