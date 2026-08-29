import { useRef, useState, type FormEvent } from 'react'
import type { Client, NewMembershipFreezeBatch } from '../domain/client'
import { addCalendarDays, isCalendarDate, localCalendarDate, previewFreezeBatch } from '../domain/client'

type BatchFreezeFormProps = {
  clients: Client[]
  onSubmit(input: NewMembershipFreezeBatch): Promise<void>
  onCancel(): void
}

export function BatchFreezeForm({ clients, onSubmit, onCancel }: BatchFreezeFormProps) {
  const today = localCalendarDate()
  const [batchId] = useState(() => crypto.randomUUID())
  const [startsOn, setStartsOn] = useState(today)
  const [plannedResumesOn, setPlannedResumesOn] = useState(addCalendarDays(today, 7))
  const [isSaving, setIsSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const savingRef = useRef(false)
  const hasValidPeriod = isCalendarDate(startsOn) && isCalendarDate(plannedResumesOn) && startsOn < plannedResumesOn
  const minimumResumeDate = isCalendarDate(startsOn) ? addCalendarDays(startsOn, 1) : today
  const preview = hasValidPeriod
    ? previewFreezeBatch(clients, { id: batchId, startsOn, plannedResumesOn })
    : { affectedClients: 0, totalDaysApplied: 0 }

  const changeStartsOn = (value: string) => {
    setStartsOn(value)
    if (plannedResumesOn <= value) setPlannedResumesOn(addCalendarDays(value, 1))
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (savingRef.current || preview.affectedClients === 0) return
    savingRef.current = true
    setIsSaving(true)
    setFormError(null)
    try {
      await onSubmit({ id: batchId, startsOn, plannedResumesOn })
    } catch {
      savingRef.current = false
      setIsSaving(false)
      setFormError('Общая заморозка не сохранена. Попробуйте ещё раз.')
    }
  }

  return <section className="form-card batch-freeze-form" aria-labelledby="batch-freeze-title">
    <div className="form-heading">
      <div><p className="eyebrow">Пауза для всего зала</p><h2 id="batch-freeze-title">Общая заморозка</h2></div>
      <button className="text-button" type="button" onClick={onCancel}>Закрыть</button>
    </div>
    <form onSubmit={(event) => void submit(event)}>
      <p className="form-hint">Укажите период болезни или отпуска тренера. Пересечения с личными заморозками второй раз не продлят срок.</p>
      <div className="form-row">
        <label><span>Дата начала</span><input type="date" value={startsOn} min={today} required
          onChange={(event) => changeStartsOn(event.target.value)} /></label>
        <label><span>Возобновить с</span><input type="date" value={plannedResumesOn} min={minimumResumeDate} required
          onChange={(event) => setPlannedResumesOn(event.target.value)} /></label>
      </div>
      <div className="batch-preview" aria-live="polite">
        <strong>{preview.affectedClients === 0 ? 'Нет затронутых клиентов' : `Будут затронуты: ${preview.affectedClients}`}</strong>
        <span>Всего будет добавлено {preview.totalDaysApplied} клиент-дн.</span>
      </div>
      {formError && <p className="field-error" role="alert">{formError}</p>}
      <div className="form-actions">
        <button className="quiet-button" type="button" onClick={onCancel}>Отмена</button>
        <button className="primary-button" type="submit" disabled={isSaving || preview.affectedClients === 0}>
          {isSaving ? 'Сохраняем…' : 'Применить общую заморозку'}
        </button>
      </div>
    </form>
  </section>
}
