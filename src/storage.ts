import type { DayEvent, DayRecord, MedPreset } from './types'
import { composeSleepLine, formatEntryText, parseSleepFromText } from './textFix'

function stripDuration(ev: DayEvent): DayEvent {
  const copy = { ...ev } as DayEvent & { durationMinutes?: number }
  delete copy.durationMinutes
  return copy as DayEvent
}

const dayKey = (date: string) => `mydailyapp:day:${date}`
const PRESETS_KEY = 'mydailyapp:medPresets'

/** When `localStorage` throws (e.g. Chrome on http://192.168…), hold keys in memory for this tab only. */
const memory = new Map<string, string>()

function storageGet(key: string): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(key)
  } catch {
    return memory.get(key) ?? null
  }
}

function storageSet(key: string, value: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, value)
    memory.delete(key)
  } catch {
    memory.set(key, value)
  }
}

/** False when the browser blocks storage (common: HTTP + LAN IP on mobile Chrome). */
export function isDevicePersistenceAvailable(): boolean {
  if (typeof window === 'undefined') return true
  try {
    const k = '__mydailyapp_ls_probe__'
    window.localStorage.setItem(k, '1')
    window.localStorage.removeItem(k)
    return true
  } catch {
    return false
  }
}

export function emptyDay(date: string): DayRecord {
  return {
    date,
    events: [],
  }
}

function normalizeEvent(e: Partial<DayEvent> & { durationMinutes?: unknown }): DayEvent {
  const symbol = typeof e.symbol === 'string' ? e.symbol : ''
  const kind = (e.kind ?? 'note') as DayEvent['kind']
  const rawText = typeof e.text === 'string' ? e.text : ''

  if (kind === 'sleep') {
    let sq = typeof e.sleepQuantity === 'string' ? e.sleepQuantity.trim() : ''
    let squal = typeof e.sleepQuality === 'string' ? e.sleepQuality.trim() : ''
    if (!sq && !squal && rawText.trim()) {
      const p = parseSleepFromText(rawText)
      sq = p.q
      squal = p.qual
    }
    const combined = composeSleepLine(sq, squal)
    const text = combined ? formatEntryText(combined, 'sleep') : ''
    const base = {
      ...e,
      symbol,
      kind: 'sleep' as const,
      text,
      sleepQuantity: sq,
      sleepQuality: squal,
      sleepOmitTime: e.sleepOmitTime === true,
    } as DayEvent
    return stripDuration(base)
  }

  const text = rawText.trim() ? formatEntryText(rawText, kind) : ''
  const base = { ...e, symbol, kind, text } as DayEvent
  if (kind !== 'note' && kind !== 'movement') {
    return stripDuration(base)
  }
  const n = Number(e.durationMinutes)
  if (!Number.isFinite(n) || n <= 0) {
    return stripDuration(base)
  }
  return { ...base, durationMinutes: Math.min(10080, Math.floor(n)) }
}

function normalizeLoaded(parsed: Partial<DayRecord>, date: string): DayRecord {
  return {
    date,
    events: Array.isArray(parsed.events)
      ? parsed.events.map((e) => normalizeEvent(e as Partial<DayEvent>))
      : [],
  }
}

export function loadDay(date: string): DayRecord {
  try {
    const raw = storageGet(dayKey(date))
    if (!raw) return emptyDay(date)
    const parsed = JSON.parse(raw) as Partial<DayRecord> & {
      taskScore?: unknown
      snapshot?: unknown
      food?: unknown
    }
    if (!parsed || parsed.date !== date || !Array.isArray(parsed.events)) {
      return emptyDay(date)
    }
    return normalizeLoaded(parsed, date)
  } catch {
    return emptyDay(date)
  }
}

export function saveDay(record: DayRecord): void {
  try {
    storageSet(dayKey(record.date), JSON.stringify(record))
  } catch {
    // ignore
  }
}

export function loadMedPresets(): MedPreset[] {
  try {
    const raw = storageGet(PRESETS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as MedPreset[]
    return Array.isArray(parsed)
      ? parsed.filter((p) => p && typeof p.id === 'string' && typeof p.label === 'string')
      : []
  } catch {
    return []
  }
}

export function saveMedPresets(presets: MedPreset[]): void {
  try {
    storageSet(PRESETS_KEY, JSON.stringify(presets))
  } catch {
    // ignore
  }
}
