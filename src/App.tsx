import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { DayEvent, DayRecord, EventKind, TimelineTabId } from './types'
import { emptyDay, isDevicePersistenceAvailable, loadDay, saveDay } from './storage'
import { copyText, exportMarkdown, exportSingleEventMarkdown } from './exportDay'
import { getPeriod, periodShortLabel } from './timeBuckets'
import {
  compareEventsForTimeline,
  formatTimeRangeLabel,
  shiftEventsToDay,
  todayYmd,
} from './dateUtils'
import { EditIcon } from './components/EditIcon'
import { CopyIcon } from './components/CopyIcon'
import { InlineAddEvent } from './components/InlineAddEvent'
import logoUrl from './assets/MyDailyApp-logo.png'
import './App.css'

const TIMELINE_TABS: { id: TimelineTabId; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'note', label: 'Log' },
  { id: 'sleep', label: 'Sleep' },
  { id: 'med', label: 'Med' },
  { id: 'food', label: 'Food' },
  { id: 'movement', label: 'Movement' },
]

function sortEvents(list: DayEvent[]): DayEvent[] {
  return [...list].sort(compareEventsForTimeline)
}

function formatDayHeading(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1)
  return dt.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function kindLabel(k: EventKind): string {
  switch (k) {
    case 'med':
      return 'Med'
    case 'food':
      return 'Food'
    case 'note':
      return 'Log'
    case 'sleep':
      return 'Sleep'
    case 'movement':
      return 'Movement'
  }
}

export default function App() {
  const [date, setDate] = useState(todayYmd)
  const [record, setRecord] = useState<DayRecord>(() => loadDay(todayYmd()))
  const [activeTab, setActiveTab] = useState<TimelineTabId>('all')
  const [addOpen, setAddOpen] = useState(false)
  /** Bumps when opening a new row so the add form remounts with fresh fields. */
  const [addFormNonce, setAddFormNonce] = useState(0)
  /** When set, the add panel edits this row instead of creating a new one. */
  const [editingEvent, setEditingEvent] = useState<DayEvent | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [clearDayModalOpen, setClearDayModalOpen] = useState(false)
  const clearDayFocusRef = useRef<HTMLButtonElement>(null)
  const persistenceOk = useMemo(() => isDevicePersistenceAvailable(), [])

  useEffect(() => {
    saveDay(record)
  }, [record])

  useEffect(() => {
    if (!clearDayModalOpen) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    clearDayFocusRef.current?.focus()
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setClearDayModalOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKey)
    }
  }, [clearDayModalOpen])

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 2800)
  }, [])

  const sorted = useMemo(() => sortEvents(record.events), [record.events])
  const displayedEvents = useMemo(
    () => (activeTab === 'all' ? sorted : sorted.filter((e) => e.kind === activeTab)),
    [sorted, activeTab],
  )
  const markdownPreview = useMemo(() => exportMarkdown(record), [record])

  function addEvent(payload: Omit<DayEvent, 'id'>) {
    const ev: DayEvent = { ...payload, id: crypto.randomUUID() }
    setRecord((r) => ({ ...r, events: sortEvents([...r.events, ev]) }))
  }

  function updateEvent(replaceId: string, payload: Omit<DayEvent, 'id'>) {
    setRecord((r) => ({
      ...r,
      events: sortEvents(
        r.events.map((e) => (e.id === replaceId ? ({ ...payload, id: replaceId } as DayEvent) : e)),
      ),
    }))
  }

  function removeEvent(id: string) {
    setRecord((r) => ({ ...r, events: r.events.filter((e) => e.id !== id) }))
  }

  async function handleCopyMd() {
    const ok = await copyText(exportMarkdown(record))
    showToast(ok ? 'Markdown copied' : 'Copy failed — select export text manually')
  }

  async function handleCopyOneEntry(e: DayEvent) {
    const md = exportSingleEventMarkdown(e)
    if (!md.trim()) {
      showToast('Nothing to copy for this entry')
      return
    }
    const ok = await copyText(md)
    showToast(ok ? 'Entry copied' : 'Copy failed — select export text manually')
  }

  /** Persist current day, then load or migrate when changing the calendar. */
  function switchToDate(next: string) {
    if (next === date) return
    setEditingEvent(null)
    setAddOpen(false)
    saveDay(record)

    const target = loadDay(next)
    const hasWork = record.events.length > 0
    const targetEmpty = target.events.length === 0

    if (hasWork && targetEmpty) {
      const n = record.events.length
      const move = window.confirm(
        `You have ${n} entr${n === 1 ? 'y' : 'ies'} on ${record.date}. ${next} has nothing saved yet.\n\n` +
          `OK — move these entries to ${next} (and clear ${record.date} on this device).\n` +
          `Cancel — keep entries on ${record.date} and open an empty ${next}.`,
      )
      if (move) {
        const shifted = shiftEventsToDay(record.events, record.date, next)
        const nextRecord: DayRecord = { date: next, events: sortEvents(shifted) }
        saveDay(emptyDay(record.date))
        saveDay(nextRecord)
        setDate(next)
        setRecord(nextRecord)
        return
      }
      setDate(next)
      setRecord(emptyDay(next))
      return
    }

    setDate(next)
    setRecord(target)
  }

  function goToday() {
    switchToDate(todayYmd())
  }

  const toggleAddForm = useCallback(() => {
    setAddOpen((wasOpen) => {
      if (wasOpen) {
        setEditingEvent(null)
        return false
      }
      setEditingEvent(null)
      setAddFormNonce((n) => n + 1)
      return true
    })
  }, [])

  function performClearDay() {
    const next = emptyDay(date)
    setRecord(next)
    saveDay(next)
    setClearDayModalOpen(false)
    showToast('Day cleared on this device')
  }

  return (
    <div className="app">
      {!persistenceOk ? (
        <div className="storage-banner" role="alert">
          <strong>Not saving to this device.</strong> This browser blocked{' '}
          <code className="storage-banner-code">localStorage</code> (common on{' '}
          <code className="storage-banner-code">http://</code> LAN). On your Mac run{' '}
          <code className="storage-banner-code">npm run dev:https</code>, then open the{' '}
          <strong>https://192.168…</strong> URL from the terminal (not <code className="storage-banner-code">http://</code>
          ). Accept the certificate warning once. Until then, data only lasts for this tab session.
        </div>
      ) : null}
      <header className="top">
        <div className="top-brand">
          <h1 className="app-title">
            <img src={logoUrl} alt="MyDailyApp" className="app-logo" decoding="async" />
          </h1>
        </div>
        <div className="date-bar">
          <label className="field inline date-field">
            <span className="sr-only">Date</span>
            <input
              type="date"
              className="input input-date"
              value={date}
              onChange={(e) => switchToDate(e.target.value)}
            />
          </label>
          <button type="button" className="btn secondary btn-today" onClick={goToday}>
            Today
          </button>
        </div>
      </header>

      <section className="card timeline-main-card" aria-label="Timeline">
        <div className="section-head section-head-tight timeline-head">
          <div className="section-head-left">
            <h2>📋 Timeline</h2>
          </div>
          <span className="timeline-count">
            <span className="timeline-count-num">{displayedEvents.length}</span>
            <span className="timeline-count-label">entries</span>
          </span>
        </div>

        <div className="timeline-tabs" role="tablist" aria-label="Entry type">
          {TIMELINE_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={activeTab === t.id}
              id={`tab-${t.id}`}
              aria-controls="timeline-tab-panel"
              className={`timeline-tab kind-${t.id} ${activeTab === t.id ? 'active' : ''}`}
              onClick={() => {
                setActiveTab(t.id)
                setAddOpen(false)
                setEditingEvent(null)
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {activeTab !== 'all' ? (
          <div className="timeline-add-wrap">
            <button
              type="button"
              className="timeline-add-fab"
              onClick={toggleAddForm}
              aria-expanded={addOpen}
              aria-label={addOpen ? 'Close add form' : 'Add entry'}
            >
              <span className="timeline-add-fab-icon" aria-hidden>
                {addOpen ? '−' : '+'}
              </span>
            </button>
          </div>
        ) : null}

        <div
          id="timeline-tab-panel"
          role="tabpanel"
          aria-labelledby={`tab-${activeTab}`}
          className="tab-panel"
        />

        {addOpen ? (
          <InlineAddEvent
            key={editingEvent?.id ?? `new-${addFormNonce}`}
            dayYmd={date}
            lockedKind={
              editingEvent ? editingEvent.kind : activeTab === 'all' ? undefined : activeTab
            }
            initialEvent={editingEvent}
            onSave={(payload, replaceId) => {
              if (replaceId) {
                updateEvent(replaceId, payload)
                showToast('Entry updated')
              } else {
                addEvent(payload)
                showToast('Saved to timeline')
              }
              setEditingEvent(null)
            }}
            onClose={() => {
              setAddOpen(false)
              setEditingEvent(null)
            }}
            onDelete={
              editingEvent
                ? () => {
                    removeEvent(editingEvent.id)
                    setEditingEvent(null)
                    setAddOpen(false)
                  }
                : undefined
            }
          />
        ) : null}

        <ul className="timeline" aria-live="polite">
          {displayedEvents.map((e) => (
            <li key={e.id} className={`tl-row kind-${e.kind}`}>
              <div className="tl-meta">
                <span className="tl-pill tl-pill-period">
                  {e.kind === 'sleep' && e.sleepOmitTime
                    ? periodShortLabel('morning')
                    : periodShortLabel(getPeriod(e.at))}
                </span>
                {activeTab === 'all' ? (
                  <span className="tl-pill tl-pill-kind">{kindLabel(e.kind)}</span>
                ) : null}
                <span className="tl-time">
                  {e.kind === 'sleep' && e.sleepOmitTime
                    ? ''
                    : (e.kind === 'note' || e.kind === 'movement') &&
                        e.durationMinutes != null &&
                        e.durationMinutes > 0
                      ? formatTimeRangeLabel(e.at, e.durationMinutes, e.fuzzy)
                      : `${e.fuzzy ? '~' : ''}${new Date(e.at).toLocaleTimeString('en-US', {
                          hour: 'numeric',
                          minute: '2-digit',
                          hour12: true,
                        })}`}
                </span>
              </div>
              <p className="tl-text">{e.text}</p>
              <div className="tl-actions">
                <button
                  type="button"
                  className="btn ghost small icon-only tl-action-btn"
                  onClick={() => {
                    setEditingEvent(e)
                    setAddOpen(true)
                  }}
                  aria-label="Edit entry"
                >
                  <EditIcon />
                </button>
                <button
                  type="button"
                  className="btn ghost small icon-only tl-action-btn"
                  onClick={() => handleCopyOneEntry(e)}
                  aria-label="Copy entry as Markdown"
                >
                  <CopyIcon />
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="card export-flow-card" aria-label="Export for Flow">
        <h2 className="export-flow-heading">📤 Export for Flow</h2>
        <details className="export-flow-preview-details">
          <summary className="export-preview-summary">Markdown preview</summary>
          <pre className="export-preview" aria-label="Markdown export preview">
            {markdownPreview}
          </pre>
        </details>
        <div className="export-actions">
          <button type="button" className="btn primary" onClick={handleCopyMd}>
            Copy Markdown
          </button>
            <button
              type="button"
              className="btn danger export-clear"
              onClick={() => setClearDayModalOpen(true)}
            >
              Clear day
            </button>
        </div>
      </section>

      {clearDayModalOpen ? (
        <div
          className="clear-day-backdrop"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) setClearDayModalOpen(false)
          }}
        >
          <div
            className="clear-day-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="clear-day-title"
            onClick={(e) => e.stopPropagation()}
          >
            {record.events.length === 0 ? (
              <>
                <h2 id="clear-day-title" className="clear-day-title">
                  Nothing to clear
                </h2>
                <p className="clear-day-lead">
                  There are no timeline entries saved for{' '}
                  <strong className="clear-day-date">{formatDayHeading(date)}</strong> on this
                  device.
                </p>
                <div className="clear-day-actions">
                  <button
                    ref={clearDayFocusRef}
                    type="button"
                    className="btn primary clear-day-btn-full"
                    onClick={() => setClearDayModalOpen(false)}
                  >
                    OK
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 id="clear-day-title" className="clear-day-title">
                  Clear this day?
                </h2>
                <p className="clear-day-lead">
                  This will permanently remove <strong>{record.events.length}</strong>{' '}
                  timeline {record.events.length === 1 ? 'entry' : 'entries'} for{' '}
                  <strong className="clear-day-date">{formatDayHeading(date)}</strong> on this device only.
                </p>
                <p className="clear-day-warning">You can’t undo this action.</p>
                <div className="clear-day-actions">
                  <button
                    ref={clearDayFocusRef}
                    type="button"
                    className="btn secondary"
                    onClick={() => setClearDayModalOpen(false)}
                  >
                    Cancel
                  </button>
                  <button type="button" className="btn danger" onClick={performClearDay}>
                    Clear all entries
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}

      {toast ? <div className="toast" role="status">{toast}</div> : null}
    </div>
  )
}
