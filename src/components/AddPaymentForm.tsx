import { useRef, useState, type FormEvent } from 'react'
import type { NewPayment } from '../domain/client'
import { localCalendarDate, parseWholeRubles } from '../domain/client'
import type { Tariff } from '../domain/tariff'

type AddPaymentFormProps = {
  onSubmit(input: NewPayment): Promise<void>
  onCancel(): void
  tariffs: Tariff[]
}

export function AddPaymentForm({ onSubmit, onCancel, tariffs }: AddPaymentFormProps) {
  const [isSaving, setIsSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [selectedTariffId, setSelectedTariffId] = useState('')
  const [amount, setAmount] = useState('')
  const [durationMonths, setDurationMonths] = useState('1')
  const durationOptions = [...new Set([1, 3, 6, 12, Number(durationMonths)])]
    .filter((months) => Number.isInteger(months) && months > 0)
  const savingRef = useRef(false)

  const selectTariff = (tariffId: string) => {
    setSelectedTariffId(tariffId)
    const tariff = tariffs.find((item) => item.id === tariffId)
    if (tariff) {
      setAmount(String(tariff.amountRubles))
      setDurationMonths(String(tariff.durationMonths))
    } else {
      setAmount('')
      setDurationMonths('1')
    }
  }

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
        {tariffs.length > 0 && <label><span>Тариф</span>
          <select aria-label="Тариф" value={selectedTariffId} onChange={(event) => selectTariff(event.target.value)}>
            <option value="">Заполнить вручную</option>
            {tariffs.map((tariff) => <option key={tariff.id} value={tariff.id}>{tariff.name}</option>)}
          </select></label>}
        <div className="form-row">
          <label>
            <span>Сумма, ₽</span>
            <input name="amount" type="number" min="1" step="1" inputMode="numeric" required autoFocus placeholder="3000"
              value={amount} onChange={(event) => { setAmount(event.target.value); setSelectedTariffId('') }} />
          </label>
          <label>
            <span>Дата оплаты</span>
            <input name="paidOn" type="date" required defaultValue={localCalendarDate()} />
          </label>
        </div>
        <label>
          <span>Срок продления</span>
          <select name="durationMonths" value={durationMonths}
            onChange={(event) => { setDurationMonths(event.target.value); setSelectedTariffId('') }}>
            {durationOptions.map((months) => <option key={months} value={months}>
              {months === 1 ? '1 месяц' : `${months} мес.`}
            </option>)}
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
