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

  const addClient = async (input: NewClient) => {
    try {
      const client = await repository.add(input)
      setClients((current) => [client, ...current])
      setIsAddingClient(false)
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
    } catch {
      throw new Error('Payment was not saved')
    }
  }

  const showClientList = () => {
    setSelectedClientId(null)
    setIsAddingPayment(false)
    setIsSettingsOpen(false)
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <button className="brand" type="button" onClick={showClientList} aria-label="Abon, список клиентов">
          <span className="brand-mark" aria-hidden="true">A</span><span>Abon</span>
        </button>
        {isSettingsOpen ? null : selectedClient ? (
          <button className="primary-button topbar-action" type="button" onClick={() => setIsAddingPayment(true)}>Новая оплата</button>
        ) : (
          <div className="topbar-actions">
            <button className="text-button" type="button" onClick={() => { setIsAddingClient(false); setIsSettingsOpen(true) }}>Настройки</button>
            <button className="primary-button topbar-action" type="button" onClick={() => setIsAddingClient(true)}>Добавить</button>
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
        <SettingsScreen onBack={showClientList} />
      ) : selectedClient ? (
        <ClientScreen client={selectedClient} isAddingPayment={isAddingPayment} onBack={showClientList}
          onAddPayment={addPayment} onCancelPayment={() => setIsAddingPayment(false)} />
      ) : (
        <ClientListScreen clients={clients} isAdding={isAddingClient} onAddClient={addClient}
          onStartAdd={() => setIsAddingClient(true)} onCancelAdd={() => setIsAddingClient(false)}
          onOpenClient={(clientId) => { setIsAddingClient(false); setSelectedClientId(clientId) }} />
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
}

function ClientScreen({ client, isAddingPayment, onBack, onAddPayment, onCancelPayment }: ClientScreenProps) {
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

export default App
