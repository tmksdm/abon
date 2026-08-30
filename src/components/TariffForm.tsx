import { useState, type FormEvent } from 'react'
import type { NewTariff, Tariff } from '../domain/tariff'
import { parseWholeRubles } from '../domain/client'

export function TariffForm({ tariff, onSubmit, onCancel }: {
  tariff?: Tariff
  onSubmit(input: NewTariff): Promise<void>
  onCancel(): void
}) {
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setIsSaving(true)
    setError(null)
    try {
      await onSubmit({
        name: String(form.get('name')).trim(),
        amountRubles: parseWholeRubles(String(form.get('amount'))),
        durationMonths: Number(form.get('durationMonths')),
      })
    } catch {
      setError('Не удалось сохранить тариф. Проверьте поля и уникальность названия.')
      setIsSaving(false)
    }
  }

  return <section className="form-card" aria-labelledby="tariff-form-title">
    <div className="form-heading"><div><p className="eyebrow">Шаблон оплаты</p>
      <h2 id="tariff-form-title">{tariff ? 'Изменить тариф' : 'Новый тариф'}</h2></div>
      <button className="text-button" type="button" onClick={onCancel}>Закрыть</button></div>
    <form onSubmit={(event) => void submit(event)}>
      <label><span>Название</span><input name="name" required autoFocus defaultValue={tariff?.name}
        placeholder="Например, Стандарт" /></label>
      <div className="form-row">
        <label><span>Сумма, ₽</span><input name="amount" type="number" min="1" step="1" inputMode="numeric"
          required defaultValue={tariff?.amountRubles} placeholder="3000" /></label>
        <label><span>Срок, месяцев</span><input name="durationMonths" type="number" min="1" step="1" inputMode="numeric"
          required defaultValue={tariff?.durationMonths ?? 1} /></label>
      </div>
      {error && <p className="field-error" role="alert">{error}</p>}
      <div className="form-actions"><button className="quiet-button" type="button" onClick={onCancel}>Отмена</button>
        <button className="primary-button" type="submit" disabled={isSaving}>{isSaving ? 'Сохраняем…' : 'Сохранить тариф'}</button></div>
    </form>
  </section>
}
