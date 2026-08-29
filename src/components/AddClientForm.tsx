import { useState, type FormEvent } from 'react'
import type { NewClient } from '../domain/client'
import { normalizeRussianPhone, parseWholeRubles } from '../domain/client'

type AddClientFormProps = {
  onSubmit(input: NewClient): Promise<void>
  onCancel(): void
}

function today() {
  const now = new Date()
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10)
}

export function AddClientForm({ onSubmit, onCancel }: AddClientFormProps) {
  const [isSaving, setIsSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

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
        <div className="form-row">
          <label>
            <span>Сумма, ₽</span>
            <input name="amount" type="number" min="1" step="1" inputMode="numeric" required placeholder="3000" />
          </label>
          <label>
            <span>Дата оплаты</span>
            <input name="paidOn" type="date" required defaultValue={today()} />
          </label>
        </div>
        <label>
          <span>Срок абонемента</span>
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
            {isSaving ? 'Сохраняем…' : 'Сохранить клиента'}
          </button>
        </div>
      </form>
    </section>
  )
}
