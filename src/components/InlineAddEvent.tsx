import { useState } from 'react'
import type { DayEvent, EventKind } from '../types'
import {
  datetimeLocalToIso,
  defaultAtForDay,
  isoToDatetimeLocalValue,
  startOfDayIso,
} from '../dateUtils'
import {
  composeSleepLine,
  foodRowsToText,
  formatEntryText,
  parseFoodRows,
  parseSleepFromText,
} from '../textFix.ts'
import { MedPresetsPanel } from './MedPresetsPanel'
import { TrashIcon } from './TrashIcon'

type Props = {
  dayYmd: string
  /** When set, entry kind is fixed (tab on main screen). */
  lockedKind?: EventKind
  /** When set, form loads this entry and save replaces it (same `id`). */
  initialEvent?: DayEvent | null
  onSave: (
    event: Omit<DayEvent, 'id'>,
    replaceId?: string,
    meta?: { adjusted: boolean },
  ) => void
  /** When editing, delete current entry and close (no-op if not provided). */
  onDelete?: () => void
  onClose: () => void
}

type FoodRowDraft = { id: string; macros: string; food: string }

function initFoodRowDrafts(p: Props): FoodRowDraft[] {
  const { initialEvent } = p
  if (initialEvent?.kind === 'food') {
    return parseFoodRows(initialEvent.text).map((r) => ({
      id: crypto.randomUUID(),
      ...r,
    }))
  }
  return [{ id: crypto.randomUUID(), macros: '', food: '' }]
}

const kinds: { id: EventKind; label: string }[] = [
  { id: 'note', label: 'Log' },
  { id: 'sleep', label: 'Sleep' },
  { id: 'med', label: 'Med' },
  { id: 'food', label: 'Food' },
  { id: 'movement', label: 'Movement' },
]

function buildInitialState(p: Props) {
  const { dayYmd, lockedKind, initialEvent } = p
  if (initialEvent) {
    let sleepQuantity = ''
    let sleepQuality = ''
    if (initialEvent.kind === 'sleep') {
      const sq = initialEvent.sleepQuantity?.trim()
      const squal = initialEvent.sleepQuality?.trim()
      if (sq || squal) {
        sleepQuantity = sq ?? ''
        sleepQuality = squal ?? ''
      } else {
        const parsed = parseSleepFromText(initialEvent.text)
        sleepQuantity = parsed.q
        sleepQuality = parsed.qual
      }
    }
    return {
      kind: (lockedKind ?? initialEvent.kind) as EventKind,
      atLocal: isoToDatetimeLocalValue(initialEvent.at),
      fuzzy: initialEvent.fuzzy,
      text: initialEvent.text,
      sleepQuantity,
      sleepQuality,
      durationMinutes:
        (initialEvent.kind === 'note' || initialEvent.kind === 'movement') &&
        initialEvent.durationMinutes != null &&
        initialEvent.durationMinutes > 0
          ? String(initialEvent.durationMinutes)
          : '',
    }
  }
  return {
    kind: (lockedKind ?? 'note') as EventKind,
    atLocal: isoToDatetimeLocalValue(defaultAtForDay(dayYmd)),
    fuzzy: false,
    text: '',
    sleepQuantity: '',
    sleepQuality: '',
    durationMinutes: '',
  }
}

export function InlineAddEvent(p: Props) {
  const init = buildInitialState(p)
  const [kind, setKind] = useState<EventKind>(init.kind)
  const [atLocal, setAtLocal] = useState(init.atLocal)
  const [fuzzy, setFuzzy] = useState(init.fuzzy)
  const [text, setText] = useState(init.text)
  const [sleepQuantity, setSleepQuantity] = useState(init.sleepQuantity)
  const [sleepQuality, setSleepQuality] = useState(init.sleepQuality)
  /** Minutes; empty string = no range (single timestamp in export). */
  const [durationMinutes, setDurationMinutes] = useState(init.durationMinutes)
  const [foodRows, setFoodRows] = useState<FoodRowDraft[]>(() => initFoodRowDrafts(p))

  const { lockedKind, initialEvent, onSave, onDelete, onClose } = p

  const effectiveKind = lockedKind ?? kind

  function submit() {
    if (effectiveKind === 'sleep') {
      const at = startOfDayIso(p.dayYmd)
      const q = sleepQuantity.trim()
      const qual = sleepQuality.trim()
      const combined = composeSleepLine(q, qual)
      const fixed = combined ? formatEntryText(combined, 'sleep') : ''
      if (!fixed) return
      setSleepQuantity(q)
      setSleepQuality(qual)
      const base: Omit<DayEvent, 'id'> = {
        at,
        fuzzy: false,
        kind: 'sleep',
        text: fixed,
        symbol: '',
        sleepQuantity: q,
        sleepQuality: qual,
        sleepOmitTime: true,
      }
      onSave(base, initialEvent?.id, { adjusted: false })
      onClose()
      return
    }

    const at = datetimeLocalToIso(atLocal)

    if (effectiveKind === 'food') {
      const composed = foodRowsToText(
        foodRows.map(({ macros, food }) => ({ macros, food })),
      )
      const fixed = formatEntryText(composed, 'food')
      if (!fixed) return
      const base: Omit<DayEvent, 'id'> = {
        at,
        fuzzy,
        kind: 'food',
        text: fixed,
        symbol: '',
      }
      onSave(base, initialEvent?.id, { adjusted: false })
      onClose()
      return
    }

    /** Same pipeline as storage + export: full textarea → trimmed/fixed line. */
    const fixed = formatEntryText(text, effectiveKind)
    if (!fixed) return
    const rawTrimmed = text.trim()
    const adjusted = fixed !== rawTrimmed
    setText(fixed)
    let parsedDuration: number | undefined
    if (
      (effectiveKind === 'note' || effectiveKind === 'movement') &&
      durationMinutes.trim() !== ''
    ) {
      const n = Number.parseInt(durationMinutes, 10)
      if (Number.isFinite(n) && n > 0) parsedDuration = Math.min(10080, n)
    }
    const base: Omit<DayEvent, 'id'> = {
      at,
      fuzzy,
      kind: effectiveKind,
      text: fixed,
      symbol: '',
      ...(parsedDuration != null ? { durationMinutes: parsedDuration } : {}),
    }
    if (
      (effectiveKind === 'note' || effectiveKind === 'movement') &&
      parsedDuration == null
    ) {
      delete (base as { durationMinutes?: number }).durationMinutes
    }
    onSave(base, initialEvent?.id, { adjusted })
    onClose()
  }

  const showSleepFields = effectiveKind === 'sleep'

  return (
    <form
      className="inline-add card-nested"
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      {!lockedKind ? (
        <div className="kind-row">
          {kinds.map((k) => (
            <button
              key={k.id}
              type="button"
              className={`btn kind kind-${k.id} ${kind === k.id ? 'active' : 'secondary'}`}
              onClick={() => {
                if (kind === 'food' && k.id !== 'food') {
                  setText(foodRowsToText(foodRows.map(({ macros, food }) => ({ macros, food }))))
                } else if (k.id === 'food' && kind !== 'food') {
                  setFoodRows(
                    parseFoodRows(text).map((r) => ({
                      id: crypto.randomUUID(),
                      ...r,
                    })),
                  )
                }
                setKind(k.id)
              }}
            >
              {k.label}
            </button>
          ))}
        </div>
      ) : null}
      {!showSleepFields ? (
        <label className="field">
          <span>When</span>
          <input
            type="datetime-local"
            className="input"
            value={atLocal}
            onChange={(e) => setAtLocal(e.target.value)}
          />
        </label>
      ) : null}
      {!showSleepFields ? (
        <label className="check">
          <input type="checkbox" checked={fuzzy} onChange={(e) => setFuzzy(e.target.checked)} />
          Approximate time (~)
        </label>
      ) : null}
      {showSleepFields ? (
        <>
          <label className="field">
            <span>Quantity</span>
            <input
              type="text"
              className="input"
              autoComplete="off"
              placeholder="e.g. 7.5h, ~6h, 8h in bed"
              value={sleepQuantity}
              onChange={(e) => setSleepQuantity(e.target.value)}
            />
          </label>
          <label className="field">
            <span>Quality</span>
            <input
              type="text"
              className="input"
              autoComplete="off"
              placeholder="e.g. solid, fragmented, restless, deep"
              value={sleepQuality}
              onChange={(e) => setSleepQuality(e.target.value)}
            />
          </label>
        </>
      ) : null}
      {effectiveKind === 'note' || effectiveKind === 'movement' ? (
        <div className="field">
          <span>Duration (optional)</span>
          <div className="duration-row">
            <input
              type="number"
              className="input duration-input"
              min={1}
              max={10080}
              step={1}
              placeholder="Minutes — e.g. 60 for 1h"
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(e.target.value)}
              aria-label="Duration in minutes"
            />
            <div className="duration-presets" role="group" aria-label="Quick durations">
              {[15, 30, 45, 60].map((m) => (
                <button
                  key={m}
                  type="button"
                  className="btn secondary small"
                  onClick={() => setDurationMinutes(String(m))}
                >
                  {m === 60 ? '1h' : `${m}m`}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
      {effectiveKind === 'food' ? (
        <div className="field food-rows-field">
          <span>Food log</span>
          <div className="food-rows">
            {foodRows.map((row, i) => (
              <div key={row.id} className="food-row">
                <input
                  type="text"
                  className="input"
                  autoComplete="off"
                  placeholder="Macros, kcal, grams…"
                  value={row.macros}
                  onChange={(e) => {
                    const next = [...foodRows]
                    next[i] = { ...next[i], macros: e.target.value }
                    setFoodRows(next)
                  }}
                  aria-label={`Row ${i + 1} macros or amount`}
                />
                <input
                  type="text"
                  className="input"
                  autoComplete="off"
                  placeholder="Food"
                  value={row.food}
                  onChange={(e) => {
                    const next = [...foodRows]
                    next[i] = { ...next[i], food: e.target.value }
                    setFoodRows(next)
                  }}
                  aria-label={`Row ${i + 1} food`}
                />
                <button
                  type="button"
                  className="btn secondary small food-row-remove"
                  onClick={() => {
                    if (foodRows.length <= 1) {
                      setFoodRows([{ id: crypto.randomUUID(), macros: '', food: '' }])
                      return
                    }
                    setFoodRows(foodRows.filter((r) => r.id !== row.id))
                  }}
                  aria-label={foodRows.length <= 1 ? 'Clear row' : 'Remove row'}
                >
                  {foodRows.length <= 1 ? 'Clear' : '−'}
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="btn secondary small food-add-row"
            onClick={() =>
              setFoodRows([...foodRows, { id: crypto.randomUUID(), macros: '', food: '' }])
            }
          >
            + Row
          </button>
        </div>
      ) : null}
      {!showSleepFields && effectiveKind !== 'food' ? (
        <>
          <label className="field">
            <span>
              {effectiveKind === 'note'
                ? 'What happened / how it felt'
                : effectiveKind === 'med'
                  ? 'Medication & dose'
                  : 'Movement details'}
            </span>
            <textarea
              className="input textarea modal-body"
              rows={5}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return
                if (!(e.metaKey || e.ctrlKey)) return
                e.preventDefault()
                submit()
              }}
              placeholder={
                effectiveKind === 'med'
                  ? 'e.g. Medication name & dose'
                  : effectiveKind === 'movement'
                    ? 'Walk, stretch, workout, steps…'
                    : 'Write freely — one moment or a short paragraph is fine.'
              }
            />
          </label>
          {effectiveKind === 'med' ? (
            <MedPresetsPanel
              onPick={(label) => {
                const add = label.trim()
                if (!add) return
                setText((prev) => {
                  const base = prev.trim()
                  if (!base) return add
                  return `${base} + ${add}`
                })
              }}
            />
          ) : null}
        </>
      ) : null}
      <div className="modal-actions">
        {initialEvent && onDelete ? (
          <button
            type="button"
            className="btn ghost small icon-only"
            onClick={() => onDelete()}
            aria-label="Delete entry"
          >
            <TrashIcon />
          </button>
        ) : null}
        <div className="modal-actions-trailing">
          <button type="button" className="btn secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn primary">
            {initialEvent ? 'Save changes' : 'Save to timeline'}
          </button>
        </div>
      </div>
    </form>
  )
}
