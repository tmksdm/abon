import { useEffect, useState } from 'react'
import { APP_VERSIONS, CURRENT_APP_VERSION } from './appVersions'
import { AddClientForm } from './components/AddClientForm'
import { AddPaymentForm } from './components/AddPaymentForm'
import { ReloadPrompt } from './components/ReloadPrompt'
import type { Client, NewClient, NewPayment } from './domain/client'
import { formatDisplayDate, getMembershipStatus } from './domain/client'
import type { ClientRepository } from './data/clientRepository'
import { localStorageClientRepository } from './data/localStorageClientRepository'

type AppProps = { repository?: ClientRepository }
type AppView =
  | { screen: 'clients'; isAddingClient?: boolean }
  | { screen: 'settings' }
  | { screen: 'client'; clientId: string; isAddingPayment?: boolean }

const HISTORY_STATE_KEY = 'abonView'

const moneyFormatter = new Intl.NumberFormat('ru-RU', {
  style: 'currency', currency: 'RUB', maximumFractionDigits: 0,
})

function App({ repository = localStorageClientRepository }: AppProps) {
  const [clients, setClients] = useState<Client[]>([])
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)
  const [isAddingClient, setIsAddingClient] = useState(false)
  const [isAddingPayment, setIsAddingPayment] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const selectedClient = clients.find((client) => client.id === selectedClientId) ?? null

  const applyView = (view: AppView) => {
    setSelectedClientId(view.screen === 'client' ? view.clientId : null)
    setIsAddingClient(view.screen === 'clients' && view.isAddingClient === true)
    setIsAddingPayment(view.screen === 'client' && view.isAddingPayment === true)
    setIsSettingsOpen(view.screen === 'settings')
  }

  const pushView = (view: AppView) => {
    window.history.pushState({ ...window.history.state, [HISTORY_STATE_KEY]: view }, '')
    applyView(view)
  }

  const retryClients = async () => {
    setIsLoading(true)
    setError(null)
    try { setClients(await repository.list()) }
    catch { setError('Не удалось открыть данные на этом устройстве.') }
    finally { setIsLoading(false) }
  }

  useEffect(() => {
    let isCurrent = true
    repository.list()
      .then((storedClients) => { if (isCurrent) setClients(storedClients) })
      .catch(() => { if (isCurrent) setError('Не удалось открыть данные на этом устройстве.') })
      .finally(() => { if (isCurrent) setIsLoading(false) })
    return () => { isCurrent = false }
  }, [repository])

  useEffect(() => {
    const rootView: AppView = { screen: 'clients' }
    window.history.replaceState({ ...window.history.state, [HISTORY_STATE_KEY]: rootView }, '')

    const restoreView = (event: PopStateEvent) => {
      const state = event.state as Record<string, unknown> | null
      const view = state?.[HISTORY_STATE_KEY]
      if (!view || typeof view !== 'object' || !('screen' in view)) {
        applyView(rootView)
        return
      }
      const candidate = view as AppView
      if (candidate.screen === 'clients' || candidate.screen === 'settings'
        || (candidate.screen === 'client' && typeof candidate.clientId === 'string')) {
        applyView(candidate)
      } else {
        applyView(rootView)
      }
    }

    window.addEventListener('popstate', restoreView)
    return () => window.removeEventListener('popstate', restoreView)
  }, [])

  const addClient = async (input: NewClient) => {
    try {
      const client = await repository.add(input)
      setClients((current) => [client, ...current])
      setIsAddingClient(false)
      window.history.replaceState({ ...window.history.state, [HISTORY_STATE_KEY]: { screen: 'clients' } }, '')
    } catch {
      throw new Error('Client was not saved')
    }
  }

  const addPayment = async (input: NewPayment) => {
    if (!selectedClient) return
    try {
      const updatedClient = await repository.addPayment(selectedClient.id, input)
      setClients((current) => current.map((client) => client.id === updatedClient.id ? updatedClient : client))
      setIsAddingPayment(false)
      window.history.replaceState({
        ...window.history.state,
        [HISTORY_STATE_KEY]: { screen: 'client', clientId: selectedClient.id },
      }, '')
    } catch {
      throw new Error('Payment was not saved')
    }
  }

  const updateNote = async (note: string) => {
    if (!selectedClient) return
    try {
      const updatedClient = await repository.updateNote(selectedClient.id, note)
      setClients((current) => current.map((client) => client.id === updatedClient.id ? updatedClient : client))
    } catch {
      throw new Error('Note was not saved')
    }
  }

  const showClientList = () => {
    pushView({ screen: 'clients' })
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <button className="brand" type="button" onClick={showClientList} aria-label="Abon, список клиентов">
          <span className="brand-mark" aria-hidden="true">A</span><span>Abon</span>
        </button>
        {isSettingsOpen ? null : selectedClient ? (
          <button className="primary-button topbar-action" type="button"
            onClick={() => pushView({ screen: 'client', clientId: selectedClient.id, isAddingPayment: true })}>Новая оплата</button>
        ) : (
          <div className="topbar-actions">
            <button className="text-button" type="button" onClick={() => pushView({ screen: 'settings' })}>Настройки</button>
            <button className="primary-button topbar-action" type="button"
              onClick={() => pushView({ screen: 'clients', isAddingClient: true })}>Добавить</button>
          </div>
        )}
      </header>

      {error && (
        <section className="notice error-notice" role="alert">
          <div><strong>Данные недоступны</strong><p>{error}</p></div>
          <button className="quiet-button" type="button" onClick={() => void retryClients()}>Повторить</button>
        </section>
      )}

      {error ? null : isLoading ? (
        <p className="loading" role="status">Загружаем клиентов…</p>
      ) : isSettingsOpen ? (
        <SettingsScreen onBack={() => window.history.back()} />
      ) : selectedClient ? (
        <ClientScreen client={selectedClient} isAddingPayment={isAddingPayment} onBack={() => window.history.back()}
          onAddPayment={addPayment} onCancelPayment={() => window.history.back()} onUpdateNote={updateNote} />
      ) : (
        <ClientListScreen clients={clients} isAdding={isAddingClient} onAddClient={addClient}
          onStartAdd={() => pushView({ screen: 'clients', isAddingClient: true })} onCancelAdd={() => window.history.back()}
          onOpenClient={(clientId) => pushView({ screen: 'client', clientId })} />
      )}
      <ReloadPrompt />
    </main>
  )
}

function SettingsScreen({ onBack }: { onBack(): void }) {
  return <>
    <button className="back-button" type="button" onClick={onBack}>К клиентам</button>
    <section className="page-heading settings-heading" aria-labelledby="settings-title">
      <div><p className="eyebrow">Приложение</p><h1 id="settings-title">Настройки</h1></div>
    </section>
    <section className="version-summary" aria-label="Текущая версия">
      <span>Текущая версия</span><strong>{CURRENT_APP_VERSION}</strong>
    </section>
    <section className="history-section" aria-labelledby="version-history-title">
      <div className="section-heading"><div><p className="eyebrow">Что изменилось</p><h2 id="version-history-title">История версий</h2></div></div>
      <ol className="version-list">
        {APP_VERSIONS.map((release) => <li key={release.version}>
          <strong>{release.version}</strong><p>{release.summary}</p>
        </li>)}
      </ol>
    </section>
  </>
}

type ClientListScreenProps = {
  clients: Client[]
  isAdding: boolean
  onAddClient(input: NewClient): Promise<void>
  onStartAdd(): void
  onCancelAdd(): void
  onOpenClient(clientId: string): void
}

function ClientListScreen({ clients, isAdding, onAddClient, onStartAdd, onCancelAdd, onOpenClient }: ClientListScreenProps) {
  return <>
    <section className="page-heading" aria-labelledby="clients-title">
      <div><p className="eyebrow">Учёт абонементов</p><h1 id="clients-title">Клиенты</h1></div>
      <span className="client-count">{clients.length}</span>
    </section>
    {isAdding && <AddClientForm onSubmit={onAddClient} onCancel={onCancelAdd} />}
    {clients.length === 0 && !isAdding ? (
      <section className="empty-state">
        <span className="empty-mark" aria-hidden="true">A</span><h2>Пока нет клиентов</h2>
        <p>Добавьте первого клиента и оплату — срок абонемента рассчитается автоматически.</p>
        <button className="primary-button" type="button" onClick={onStartAdd}>Добавить клиента</button>
      </section>
    ) : (
      <ul className="client-list" aria-label="Список клиентов">
        {clients.map((client) => {
          const status = getMembershipStatus(client.membershipEndsOn)
          return <li key={client.id}>
            <button className="client-card" type="button" onClick={() => onOpenClient(client.id)}>
              <span className="client-card-heading">
                <span className="client-identity"><strong>{client.name}</strong><span>{client.phone}</span></span>
                <span className={`status-badge status-${status.kind}`}>{status.label}</span>
              </span>
              <span className="client-details">
                <span><span className="detail-label">До</span><strong>{formatDisplayDate(client.membershipEndsOn)}</strong></span>
                <span><span className="detail-label">Последняя оплата</span><strong>{moneyFormatter.format(client.payments[0].amountRubles)}</strong></span>
              </span>
              {client.note && <span className="client-note-preview">{client.note}</span>}
            </button>
          </li>
        })}
      </ul>
    )}
  </>
}

type ClientScreenProps = {
  client: Client
  isAddingPayment: boolean
  onBack(): void
  onAddPayment(input: NewPayment): Promise<void>
  onCancelPayment(): void
  onUpdateNote(note: string): Promise<void>
}

function ClientScreen({ client, isAddingPayment, onBack, onAddPayment, onCancelPayment, onUpdateNote }: ClientScreenProps) {
  const status = getMembershipStatus(client.membershipEndsOn)
  const payments = [...client.payments].sort((left, right) => right.paidOn.localeCompare(left.paidOn) || right.createdAt.localeCompare(left.createdAt))
  return <>
    <button className="back-button" type="button" onClick={onBack}>К списку</button>
    <section className="page-heading client-page-heading" aria-labelledby="client-title">
      <div><p className="eyebrow">Карточка клиента</p><h1 id="client-title">{client.name}</h1>
        <a className="client-phone" href={`tel:${client.phone}`}>{client.phone}</a></div>
      <span className={`status-badge status-${status.kind}`}>{status.label}</span>
    </section>
    <section className="membership-summary" aria-label="Текущий абонемент">
      <span>Абонемент до</span><strong>{formatDisplayDate(client.membershipEndsOn)}</strong>
    </section>
    <ClientNote note={client.note} onSave={onUpdateNote} />
    {isAddingPayment && <AddPaymentForm onSubmit={onAddPayment} onCancel={onCancelPayment} />}
    <section className="history-section" aria-labelledby="payment-history-title">
      <div className="section-heading"><div><p className="eyebrow">Все операции</p><h2 id="payment-history-title">История оплат</h2></div>
        <span className="client-count">{payments.length}</span></div>
      <ol className="payment-list">
        {payments.map((payment) => <li key={payment.id}>
          <div><strong>{moneyFormatter.format(payment.amountRubles)}</strong><span>{payment.durationMonths} мес.</span></div>
          <time dateTime={payment.paidOn}>{formatDisplayDate(payment.paidOn)}</time>
        </li>)}
      </ol>
    </section>
  </>
}

function ClientNote({ note, onSave }: { note: string; onSave(note: string): Promise<void> }) {
  const [isEditing, setIsEditing] = useState(false)
  const [value, setValue] = useState(note)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async () => {
    setIsSaving(true)
    setError(null)
    try {
      await onSave(value)
      setValue(value.trim())
      setIsEditing(false)
    } catch {
      setError('Не удалось сохранить заметку. Попробуйте ещё раз.')
    } finally {
      setIsSaving(false)
    }
  }

  if (isEditing) {
    return <section className="note-card" aria-labelledby="client-note-title">
      <div className="section-heading"><h2 id="client-note-title">Заметка</h2></div>
      <label htmlFor="client-note">Текст заметки</label>
      <textarea id="client-note" rows={4} value={value} onChange={(event) => setValue(event.target.value)} autoFocus />
      {error && <p className="field-error" role="alert">{error}</p>}
      <div className="form-actions">
        <button className="text-button" type="button" onClick={() => { setValue(note); setError(null); setIsEditing(false) }}>Отмена</button>
        <button className="primary-button" type="button" disabled={isSaving} onClick={() => void save()}>{isSaving ? 'Сохраняем…' : 'Сохранить заметку'}</button>
      </div>
    </section>
  }

  return <section className="note-card" aria-labelledby="client-note-title">
    <div className="section-heading"><h2 id="client-note-title">Заметка</h2>
      <button className="text-button" type="button" onClick={() => setIsEditing(true)}>{note ? 'Изменить' : 'Добавить'}</button></div>
    {note ? <p className="client-note">{note}</p> : <p className="empty-note">Заметки пока нет.</p>}
  </section>
}

export default App
