import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { createPortal } from 'react-dom'
import type { MedPreset } from '../types'
import {
  loadFoodPresets,
  loadMedPresets,
  loadMovementPresets,
  saveFoodPresets,
  saveMedPresets,
  saveMovementPresets,
} from '../storage'
import { EditIcon } from './EditIcon'

function reorderPresets(list: MedPreset[], from: number, to: number): MedPreset[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list
  const next = list.slice()
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

export type ShortcutPresetsPanelProps = {
  onPick: (label: string) => void
  loadPresets: () => MedPreset[]
  savePresets: (presets: MedPreset[]) => void
  groupAriaLabel: string
  inputPlaceholder: string
}

export function ShortcutPresetsPanel({
  onPick,
  loadPresets,
  savePresets,
  groupAriaLabel,
  inputPlaceholder,
}: ShortcutPresetsPanelProps) {
  const [presets, setPresets] = useState<MedPreset[]>([])
  const [draft, setDraft] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState('')
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [pendingRemove, setPendingRemove] = useState<MedPreset | null>(null)
  const confirmFocusRef = useRef<HTMLButtonElement>(null)
  const presetsRef = useRef(presets)
  const listRef = useRef<HTMLDivElement>(null)
  const dragState = useRef<{ index: number; moved: boolean } | null>(null)
  const dragCleanup = useRef<(() => void) | null>(null)
  const suppressClick = useRef(false)
  const skipCommit = useRef(false)
  const editInputRef = useRef<HTMLInputElement>(null)

  presetsRef.current = presets

  const reload = useCallback(() => {
    const next = loadPresets()
    presetsRef.current = next
    setPresets(next)
  }, [loadPresets])

  useEffect(() => {
    reload()
  }, [reload])

  useEffect(() => {
    if (!editingId) return
    editInputRef.current?.focus()
    editInputRef.current?.select()
  }, [editingId])

  useEffect(() => {
    return () => dragCleanup.current?.()
  }, [])

  useEffect(() => {
    if (!pendingRemove) return
    confirmFocusRef.current?.focus()
    function onKey(e: globalThis.KeyboardEvent) {
      if (e.key !== 'Escape') return
      setPendingRemove(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pendingRemove])

  function persist(next: MedPreset[]) {
    presetsRef.current = next
    savePresets(next)
    setPresets(next)
  }

  function addFromDraft() {
    const label = draft.trim()
    if (!label) return
    persist([...presetsRef.current, { id: crypto.randomUUID(), label }])
    setDraft('')
  }

  function removePreset(id: string) {
    if (editingId === id) setEditingId(null)
    setPendingRemove(null)
    persist(presetsRef.current.filter((p) => p.id !== id))
  }

  function startEdit(preset: MedPreset) {
    skipCommit.current = false
    setEditingId(preset.id)
    setEditDraft(preset.label)
  }

  function cancelEdit() {
    skipCommit.current = true
    setEditingId(null)
  }

  function commitEdit() {
    if (skipCommit.current) {
      skipCommit.current = false
      return
    }
    const id = editingId
    const label = editDraft.trim()
    setEditingId(null)
    if (!id || !label) return
    const current = presetsRef.current
    const existing = current.find((p) => p.id === id)
    if (!existing || existing.label === label) return
    persist(current.map((p) => (p.id === id ? { ...p, label } : p)))
  }

  function reorder(from: number, to: number) {
    const next = reorderPresets(presetsRef.current, from, to)
    if (next === presetsRef.current) return
    persist(next)
  }

  function onChipPointerDown(e: PointerEvent<HTMLButtonElement>, index: number) {
    if (e.button !== 0 || editingId) return
    const startX = e.clientX
    const startY = e.clientY
    const pointerId = e.pointerId
    const node = e.currentTarget
    suppressClick.current = false
    dragState.current = { index, moved: false }

    const onMove = (ev: globalThis.PointerEvent) => {
      const drag = dragState.current
      if (!drag || ev.pointerId !== pointerId || !listRef.current) return
      if (!drag.moved) {
        const dx = ev.clientX - startX
        const dy = ev.clientY - startY
        if (dx * dx + dy * dy < 64) return
        drag.moved = true
        setDraggingId(presetsRef.current[drag.index]?.id ?? null)
      }
      const hit = document.elementFromPoint(ev.clientX, ev.clientY)
      const cell = hit?.closest<HTMLElement>('[data-preset-index]')
      if (!cell || !listRef.current.contains(cell)) return
      const to = Number(cell.dataset.presetIndex)
      if (!Number.isInteger(to) || to === drag.index) return
      const from = drag.index
      drag.index = to
      reorder(from, to)
    }

    const finish = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      if (dragCleanup.current === finish) dragCleanup.current = null
    }

    const onUp = (ev: globalThis.PointerEvent) => {
      if (ev.pointerId !== pointerId) return
      if (dragState.current?.moved) suppressClick.current = true
      dragState.current = null
      setDraggingId(null)
      finish()
      if (node.hasPointerCapture?.(pointerId)) node.releasePointerCapture(pointerId)
    }

    dragCleanup.current?.()
    dragCleanup.current = finish
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    try {
      node.setPointerCapture(pointerId)
    } catch {
      // Capture is unavailable for some pointers; window listeners still track the drag.
    }
  }

  function onChipClick(label: string) {
    if (suppressClick.current) {
      suppressClick.current = false
      return
    }
    onPick(label)
  }

  function onChipKeyDown(e: KeyboardEvent, index: number) {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown' && e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    const backward = e.key === 'ArrowUp' || e.key === 'ArrowLeft'
    reorder(index, backward ? index - 1 : index + 1)
  }

  return (
    <div className="med-presets-quick">
      <div className="med-quick-block">
        <p className="muted small med-quick-intro">Your shortcuts (this device)</p>
        {presets.length > 0 ? (
          <div className="med-quick-grid" role="list" aria-label={groupAriaLabel} ref={listRef}>
            {presets.map((p, index) => {
              const editing = editingId === p.id
              return (
                <div
                  key={p.id}
                  className={`med-preset-cell${draggingId === p.id ? ' is-dragging' : ''}${editing ? ' is-editing' : ''}`}
                  data-preset-index={index}
                  role="listitem"
                >
                  {editing ? (
                    <>
                      <input
                        ref={editInputRef}
                        className="input med-preset-edit-input"
                        value={editDraft}
                        onChange={(e) => setEditDraft(e.target.value)}
                        onBlur={commitEdit}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            commitEdit()
                          } else if (e.key === 'Escape') {
                            e.preventDefault()
                            cancelEdit()
                          }
                        }}
                        aria-label={`Shortcut name for ${p.label}`}
                      />
                      <button
                        type="button"
                        className="btn primary small"
                        onPointerDown={(e) => e.preventDefault()}
                        onClick={commitEdit}
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        className="btn ghost small"
                        onPointerDown={(e) => e.preventDefault()}
                        onClick={cancelEdit}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="btn med-quick-btn"
                        title="Drag to reorder"
                        onPointerDown={(e) => onChipPointerDown(e, index)}
                        onClick={() => onChipClick(p.label)}
                        onKeyDown={(e) => onChipKeyDown(e, index)}
                      >
                        {p.label}
                      </button>
                      <button
                        type="button"
                        className="btn ghost small icon-only med-preset-edit"
                        onClick={() => startEdit(p)}
                        aria-label={`Edit shortcut ${p.label}`}
                        title="Edit shortcut"
                      >
                        <EditIcon />
                      </button>
                      <button
                        type="button"
                        className="btn ghost small med-preset-remove"
                        onClick={() => setPendingRemove(p)}
                        aria-label={`Remove shortcut ${p.label}`}
                      >
                        ×
                      </button>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        ) : null}
        <div className="med-preset-add">
          <input
            className="input med-preset-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return
              e.preventDefault()
              addFromDraft()
            }}
            placeholder={inputPlaceholder}
            aria-label="New shortcut label"
          />
          <button type="button" className="btn secondary small" onClick={addFromDraft}>
            Add shortcut
          </button>
        </div>
      </div>
      {pendingRemove
        ? createPortal(
            <div
              className="clear-day-backdrop"
              role="presentation"
              onClick={(e) => {
                if (e.target === e.currentTarget) setPendingRemove(null)
              }}
            >
              <div
                className="clear-day-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="shortcut-remove-title"
                onClick={(e) => e.stopPropagation()}
              >
                <h2 id="shortcut-remove-title" className="clear-day-title">
                  Remove this shortcut?
                </h2>
                <p className="clear-day-lead">
                  Exclude <strong>{pendingRemove.label}</strong> from your shortcuts on this device?
                </p>
                <p className="clear-day-warning">You can’t undo this action.</p>
                <div className="clear-day-actions">
                  <button
                    ref={confirmFocusRef}
                    type="button"
                    className="btn secondary"
                    onClick={() => setPendingRemove(null)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn danger"
                    onClick={() => removePreset(pendingRemove.id)}
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}

type MedProps = {
  onPick: (label: string) => void
}

export function MedPresetsPanel({ onPick }: MedProps) {
  return (
    <ShortcutPresetsPanel
      onPick={onPick}
      loadPresets={loadMedPresets}
      savePresets={saveMedPresets}
      groupAriaLabel="Saved medication shortcuts"
      inputPlaceholder="e.g. Medication name & dose"
    />
  )
}

export function FoodPresetsPanel({ onPick }: MedProps) {
  return (
    <ShortcutPresetsPanel
      onPick={onPick}
      loadPresets={loadFoodPresets}
      savePresets={saveFoodPresets}
      groupAriaLabel="Saved food shortcuts"
      inputPlaceholder="e.g. 40g protein bar or 200 kcal oats"
    />
  )
}

export function MovementPresetsPanel({ onPick }: MedProps) {
  return (
    <ShortcutPresetsPanel
      onPick={onPick}
      loadPresets={loadMovementPresets}
      savePresets={saveMovementPresets}
      groupAriaLabel="Saved movement shortcuts"
      inputPlaceholder="e.g. 30 min walk or mobility routine"
    />
  )
}
