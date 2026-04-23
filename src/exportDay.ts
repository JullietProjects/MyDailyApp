import type { DayEvent, DayRecord } from './types'
import { compareEventsForTimeline, formatTimeRangeLabel } from './dateUtils'
import { splitFoodMealParts } from './textFix'
import { getPeriod, type DayPeriod } from './timeBuckets'

function weekdayTitle(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1)
  return dt.toLocaleDateString('en-US', { weekday: 'long' })
}

function formatClock(iso: string, fuzzy: boolean): string {
  const t = new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
  return fuzzy ? `~${t}` : t
}

/** Normalize unit order; join amount + name with a space (no “of”). */
function normalizeFoodQuantityText(text: string): string {
  let t = text.trim()
  if (!t) return t
  t = t.replace(/^(\d+(?:\.\d+)?(?:g|mg|ml|mL|oz)?)\s+of\s+/i, '$1 ')

  let m = t.match(/^(.+?)\s+(\d+(?:\.\d+)?)\s*(g|mg|ml|mL|oz)\s*$/i)
  if (m) {
    const [, name, qty, unit] = m
    return `${qty}${unit} ${name.trim()}`
  }
  m = t.match(/^(\d+(?:\.\d+)?)\s*(g|mg|ml|mL|oz)\s+(.+)$/i)
  if (m) {
    const [, qty, unit, name] = m
    return `${qty}${unit} ${name.trim()}`
  }
  return t
}

function formatEventTextForExport(e: DayEvent): string {
  const raw = e.text.trim()
  if (!raw) return ''
  if (e.kind === 'food') {
    return splitFoodMealParts(raw)
      .map((seg) => normalizeFoodQuantityText(seg).trim())
      .filter(Boolean)
      .join(' + ')
      .trim()
  }
  return raw
}

function hasExportText(e: DayEvent): boolean {
  return formatEventTextForExport(e).length > 0
}

function formatEventClock(e: DayEvent): string {
  if (e.kind === 'sleep' && e.sleepOmitTime) return ''
  const hasSpan =
    (e.kind === 'note' || e.kind === 'movement') &&
    e.durationMinutes != null &&
    e.durationMinutes > 0
  return hasSpan ? formatTimeRangeLabel(e.at, e.durationMinutes!, e.fuzzy) : formatClock(e.at, e.fuzzy)
}

/** Markdown bullet for one event (sleep has no clock; prefixed with `Sleep:`). */
function formatMarkdownBullet(e: DayEvent): string {
  const body = formatEventTextForExport(e)
  if (e.kind === 'sleep') {
    return `- Sleep: ${body}`
  }
  const clock = formatEventClock(e)
  return clock ? `- ${clock}: ${body}` : `- ${body}`
}

const PERIOD_HEADING: Record<DayPeriod, string> = {
  morning: 'Morning / Earlier in the day',
  afternoon: 'Afternoon / Evening',
  night: 'Night / Late Night',
}

const PERIOD_ORDER: DayPeriod[] = ['morning', 'afternoon', 'night']

/**
 * Flow-friendly markdown: `# date (weekday)`, then only periods that have at least one
 * non-empty entry. Untimed sleep is grouped under Morning. Each block is a plain period
 * label (no `##`) plus `- time: text` lines.
 */
export function exportMarkdown(record: DayRecord): string {
  const title = `# ${record.date} (${weekdayTitle(record.date)})`
  const events = record.events.filter(hasExportText).sort(compareEventsForTimeline)

  if (events.length === 0) {
    return `${title}\n`
  }

  const byPeriod: Record<DayPeriod, DayEvent[]> = {
    morning: [],
    afternoon: [],
    night: [],
  }
  for (const e of events) {
    const p = e.kind === 'sleep' && e.sleepOmitTime ? 'morning' : getPeriod(e.at)
    byPeriod[p].push(e)
  }

  const blocks: string[] = [title]
  for (const p of PERIOD_ORDER) {
    const list = byPeriod[p]
    if (list.length === 0) continue
    const lines = list.map((e) => formatMarkdownBullet(e))
    blocks.push(`${PERIOD_HEADING[p]}\n\n${lines.join('\n')}`)
  }

  return `${blocks.join('\n\n')}\n`
}

/** Clipboard line for one entry: `- time: text` (or `- Sleep: …`); no date or section heading. */
export function exportSingleEventMarkdown(e: DayEvent): string {
  if (!hasExportText(e)) return ''
  return `${formatMarkdownBullet(e)}\n`
}

export function exportJson(record: DayRecord): string {
  return JSON.stringify(record, null, 2)
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
