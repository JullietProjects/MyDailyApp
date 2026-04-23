import { useCallback, useEffect, useState } from 'react'
import type { MedPreset } from '../types'
import { loadMedPresets, saveMedPresets } from '../storage'

type Props = {
  /** Fills the medication field when user taps a saved shortcut. */
  onPick: (label: string) => void
}

export function MedPresetsPanel({ onPick }: Props) {
  const [presets, setPresets] = useState<MedPreset[]>([])
  const [draft, setDraft] = useState('')

  const reload = useCallback(() => {
    setPresets(loadMedPresets())
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  function persist(next: MedPreset[]) {
    saveMedPresets(next)
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
          <div className="med-quick-grid" role="group" aria-label="Saved medication shortcuts">
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
        ) : (
          <p className="muted small med-presets-empty">
            Add labels below for one-tap fill. Nothing is bundled with the app.
          </p>
        )}
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
            placeholder="e.g. Medication name & dose"
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
