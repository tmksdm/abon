import { useRef, useState, type FormEvent } from 'react'
import type { Client, UpdateClient } from '../domain/client'
import { normalizeRussianPhone } from '../domain/client'

type EditClientFormProps = {
  client: Client
  onSubmit(input: UpdateClient): Promise<void>
  onCancel(): void
}

export function EditClientForm({ client, onSubmit, onCancel }: EditClientFormProps) {
  const [isSaving, setIsSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const savingRef = useRef(false)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (savingRef.current) return
    const form = new FormData(event.currentTarget)
    try {
      savingRef.current = true
      setIsSaving(true)
      setFormError(null)
      await onSubmit({
        name: String(form.get('name')).trim(),
        phone: normalizeRussianPhone(String(form.get('phone'))),
      })
    } catch {
      savingRef.current = false
      setIsSaving(false)
      setFormError('Проверьте имя и телефон.')
    }
  }

  return <section className="form-card" aria-labelledby="edit-client-title">
    <div className="form-heading">
      <div><p className="eyebrow">Данные клиента</p><h2 id="edit-client-title">Редактирование</h2></div>
      <button className="text-button" type="button" onClick={onCancel}>Закрыть</button>
    </div>
    <form onSubmit={(event) => void submit(event)}>
      <label><span>Имя</span><input name="name" defaultValue={client.name} autoComplete="name" required autoFocus /></label>
      <label><span>Телефон</span><input name="phone" defaultValue={client.phone} type="text" inputMode="tel"
        autoComplete="tel" required /></label>
      {formError && <p className="field-error" role="alert">{formError}</p>}
      <div className="form-actions">
        <button className="quiet-button" type="button" onClick={onCancel}>Отмена</button>
        <button className="primary-button" type="submit" disabled={isSaving}>{isSaving ? 'Сохраняем…' : 'Сохранить'}</button>
      </div>
    </form>
  </section>
}
