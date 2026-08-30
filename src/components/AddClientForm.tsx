import { useState, type FormEvent } from 'react'
import type { NewClient } from '../domain/client'
import { normalizeRussianPhone, parseWholeRubles } from '../domain/client'
import type { Tariff } from '../domain/tariff'

type AddClientFormProps = {
  onSubmit(input: NewClient): Promise<void>
  onCancel(): void
  tariffs: Tariff[]
}

function today() {
  const now = new Date()
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10)
}

export function AddClientForm({ onSubmit, onCancel, tariffs }: AddClientFormProps) {
  const [isSaving, setIsSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [selectedTariffId, setSelectedTariffId] = useState('')
  const [amount, setAmount] = useState('')
  const [durationMonths, setDurationMonths] = useState('1')
  const durationOptions = [...new Set([1, 3, 6, 12, Number(durationMonths)])]
    .filter((months) => Number.isInteger(months) && months > 0)

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
    const form = new FormData(event.currentTarget)

    try {
      setIsSaving(true)
      setFormError(null)
      await onSubmit({
        name: String(form.get('name')).trim(),
        phone: normalizeRussianPhone(String(form.get('phone'))),
        amountRubles: parseWholeRubles(String(form.get('amount'))),
        paidOn: String(form.get('paidOn')),
        durationMonths: Number(form.get('durationMonths')),
      })
    } catch {
      setFormError('Проверьте телефон и целую сумму в рублях.')
      setIsSaving(false)
    }
  }

  return (
    <section className="form-card" aria-labelledby="add-client-title">
      <div className="form-heading">
        <div>
          <p className="eyebrow">Новая запись</p>
          <h2 id="add-client-title">Клиент и оплата</h2>
        </div>
        <button className="text-button" type="button" onClick={onCancel}>Закрыть</button>
      </div>

      <form onSubmit={(event) => void submit(event)}>
        <label>
          <span>Имя</span>
          <input name="name" autoComplete="name" required autoFocus placeholder="Например, Анна" />
        </label>
        <label>
          <span>Телефон</span>
          <input
            name="phone"
            type="text"
            inputMode="tel"
            autoComplete="tel"
            required
            placeholder="+7 900 000-00-00"
          />
        </label>
        {tariffs.length > 0 && <label><span>Тариф</span>
          <select aria-label="Тариф" value={selectedTariffId} onChange={(event) => selectTariff(event.target.value)}>
            <option value="">Заполнить вручную</option>
            {tariffs.map((tariff) => <option key={tariff.id} value={tariff.id}>{tariff.name}</option>)}
          </select></label>}
        <div className="form-row">
          <label>
            <span>Сумма, ₽</span>
            <input name="amount" type="number" min="1" step="1" inputMode="numeric" required placeholder="3000"
              value={amount} onChange={(event) => { setAmount(event.target.value); setSelectedTariffId('') }} />
          </label>
          <label>
            <span>Дата оплаты</span>
            <input name="paidOn" type="date" required defaultValue={today()} />
          </label>
        </div>
        <label>
          <span>Срок абонемента</span>
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
            {isSaving ? 'Сохраняем…' : 'Сохранить клиента'}
          </button>
        </div>
      </form>
    </section>
  )
}
