import { useRef, useState, type FormEvent } from 'react'
import type { NewMembershipFreeze } from '../domain/client'
import { addCalendarDays, localCalendarDate } from '../domain/client'

type FreezeMembershipFormProps = {
  onSubmit(input: NewMembershipFreeze): Promise<void>
  onCancel(): void
}

export function FreezeMembershipForm({ onSubmit, onCancel }: FreezeMembershipFormProps) {
  const today = localCalendarDate()
  const [startsOn, setStartsOn] = useState(today)
  const [plannedResumesOn, setPlannedResumesOn] = useState(addCalendarDays(today, 7))
  const [isSaving, setIsSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const savingRef = useRef(false)

  const changeStartsOn = (value: string) => {
    setStartsOn(value)
    if (plannedResumesOn <= value) setPlannedResumesOn(addCalendarDays(value, 1))
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (savingRef.current) return
    savingRef.current = true
    setIsSaving(true)
    setFormError(null)

    try {
      await onSubmit({ id: crypto.randomUUID(), startsOn, plannedResumesOn })
    } catch {
      savingRef.current = false
      setIsSaving(false)
      setFormError('Заморозка не сохранена. Проверьте период и повторите.')
    }
  }

  return <section className="form-card" aria-labelledby="freeze-title">
    <div className="form-heading">
      <div><p className="eyebrow">Пауза в абонементе</p><h2 id="freeze-title">Заморозка</h2></div>
      <button className="text-button" type="button" onClick={onCancel}>Закрыть</button>
    </div>
    <form onSubmit={(event) => void submit(event)}>
      <p className="form-hint">Укажите первый день паузы и день, с которого клиент снова сможет заниматься.</p>
      <div className="form-row">
        <label><span>Дата начала</span><input type="date" value={startsOn} min={today} required
          onChange={(event) => changeStartsOn(event.target.value)} /></label>
        <label><span>Возобновить с</span><input type="date" value={plannedResumesOn} min={addCalendarDays(startsOn, 1)} required
          onChange={(event) => setPlannedResumesOn(event.target.value)} /></label>
      </div>
      {formError && <p className="field-error" role="alert">{formError}</p>}
      <div className="form-actions">
        <button className="quiet-button" type="button" onClick={onCancel}>Отмена</button>
        <button className="primary-button" type="submit" disabled={isSaving}>{isSaving ? 'Сохраняем…' : 'Заморозить'}</button>
      </div>
    </form>
  </section>
}
