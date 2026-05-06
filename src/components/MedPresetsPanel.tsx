import { useCallback, useEffect, useState } from 'react'
import type { MedPreset } from '../types'
import {
  loadFoodPresets,
  loadMedPresets,
  loadMovementPresets,
  saveFoodPresets,
  saveMedPresets,
  saveMovementPresets,
} from '../storage'

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

  const reload = useCallback(() => {
    setPresets(loadPresets())
  }, [loadPresets])

  useEffect(() => {
    reload()
  }, [reload])

  function persist(next: MedPreset[]) {
    savePresets(next)
    setPresets(next)
  }

  function addFromDraft() {
    const label = draft.trim()
    if (!label) return
    persist([...presets, { id: crypto.randomUUID(), label }])
    setDraft('')
  }

  function removePreset(id: string) {
    persist(presets.filter((p) => p.id !== id))
  }

  return (
    <div className="med-presets-quick">
      <div className="med-quick-block">
        <p className="muted small med-quick-intro">Your shortcuts (this device)</p>
        {presets.length > 0 ? (
          <div className="med-quick-grid" role="group" aria-label={groupAriaLabel}>
            {presets.map((p) => (
              <div key={p.id} className="med-preset-cell">
                <button
                  type="button"
                  className="btn med-quick-btn"
                  onClick={() => onPick(p.label)}
                >
                  {p.label}
                </button>
                <button
                  type="button"
                  className="btn ghost small med-preset-remove"
                  onClick={() => removePreset(p.id)}
                  aria-label={`Remove shortcut ${p.label}`}
                >
                  ×
                </button>
              </div>
            ))}
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
