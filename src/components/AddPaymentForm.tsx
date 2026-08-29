import { useRef, useState, type FormEvent } from 'react'
import type { NewPayment } from '../domain/client'
import { localCalendarDate, parseWholeRubles } from '../domain/client'

type AddPaymentFormProps = {
  onSubmit(input: NewPayment): Promise<void>
  onCancel(): void
}

export function AddPaymentForm({ onSubmit, onCancel }: AddPaymentFormProps) {
  const [isSaving, setIsSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const savingRef = useRef(false)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (savingRef.current) return

    const form = new FormData(event.currentTarget)
    savingRef.current = true
    setIsSaving(true)
    setFormError(null)

    try {
      await onSubmit({
        id: crypto.randomUUID(),
        amountRubles: parseWholeRubles(String(form.get('amount'))),
        paidOn: String(form.get('paidOn')),
        durationMonths: Number(form.get('durationMonths')),
      })
    } catch {
      savingRef.current = false
      setIsSaving(false)
      setFormError('Оплата не сохранена. Проверьте данные и повторите.')
    }
  }

  return (
    <section className="form-card" aria-labelledby="add-payment-title">
      <div className="form-heading">
        <div>
          <p className="eyebrow">Продление</p>
          <h2 id="add-payment-title">Новая оплата</h2>
        </div>
        <button className="text-button" type="button" onClick={onCancel}>Закрыть</button>
      </div>
      <form onSubmit={(event) => void submit(event)}>
        <div className="form-row">
          <label>
            <span>Сумма, ₽</span>
            <input name="amount" type="number" min="1" step="1" inputMode="numeric" required autoFocus placeholder="3000" />
          </label>
          <label>
            <span>Дата оплаты</span>
            <input name="paidOn" type="date" required defaultValue={localCalendarDate()} />
          </label>
        </div>
        <label>
          <span>Срок продления</span>
          <select name="durationMonths" defaultValue="1">
            <option value="1">1 месяц</option>
            <option value="3">3 месяца</option>
            <option value="6">6 месяцев</option>
            <option value="12">12 месяцев</option>
          </select>
        </label>
        {formError && <p className="field-error" role="alert">{formError}</p>}
        <div className="form-actions">
          <button className="quiet-button" type="button" onClick={onCancel}>Отмена</button>
          <button className="primary-button" type="submit" disabled={isSaving}>
            {isSaving ? 'Сохраняем…' : 'Сохранить оплату'}
          </button>
        </div>
      </form>
    </section>
  )
}
