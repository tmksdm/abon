import { useEffect, useState } from 'react'
import { AddClientForm } from './components/AddClientForm'
import { ReloadPrompt } from './components/ReloadPrompt'
import type { Client, NewClient } from './domain/client'
import { formatShortDate, getMembershipStatus } from './domain/client'
import type { ClientRepository } from './data/clientRepository'
import { localStorageClientRepository } from './data/localStorageClientRepository'

type AppProps = { repository?: ClientRepository }

const moneyFormatter = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  maximumFractionDigits: 0,
})

function App({ repository = localStorageClientRepository }: AppProps) {
  const [clients, setClients] = useState<Client[]>([])
  const [isAdding, setIsAdding] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const retryClients = async () => {
    setIsLoading(true)
    setError(null)
    try {
      setClients(await repository.list())
    } catch {
      setError('Не удалось открыть данные на этом устройстве.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    let isCurrent = true

    repository.list()
      .then((storedClients) => {
        if (isCurrent) setClients(storedClients)
      })
      .catch(() => {
        if (isCurrent) setError('Не удалось открыть данные на этом устройстве.')
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false)
      })

    return () => {
      isCurrent = false
    }
  }, [repository])

  const addClient = async (input: NewClient) => {
    setError(null)
    try {
      const client = await repository.add(input)
      setClients((current) => [client, ...current])
      setIsAdding(false)
    } catch {
      setError('Клиент не сохранён. Проверьте доступ к хранилищу и повторите.')
      throw new Error('Client was not saved')
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="/abon/" aria-label="Abon, список клиентов">
          <span className="brand-mark" aria-hidden="true">A</span>
          <span>Abon</span>
        </a>
        <button className="primary-button topbar-action" type="button" onClick={() => setIsAdding(true)}>
          Добавить
        </button>
      </header>

      <section className="page-heading" aria-labelledby="clients-title">
        <div>
          <p className="eyebrow">Учёт абонементов</p>
          <h1 id="clients-title">Клиенты</h1>
        </div>
        {!isLoading && !error && <span className="client-count">{clients.length}</span>}
      </section>

      {error && (
        <section className="notice error-notice" role="alert">
          <div>
            <strong>Данные недоступны</strong>
            <p>{error}</p>
          </div>
          <button className="quiet-button" type="button" onClick={() => void retryClients()}>
            Повторить
          </button>
        </section>
      )}

      {isAdding && <AddClientForm onSubmit={addClient} onCancel={() => setIsAdding(false)} />}

      {error ? null : isLoading ? (
        <p className="loading" role="status">Загружаем клиентов…</p>
      ) : clients.length === 0 && !isAdding ? (
        <section className="empty-state">
          <span className="empty-mark" aria-hidden="true">A</span>
          <h2>Пока нет клиентов</h2>
          <p>Добавьте первого клиента и оплату — срок абонемента рассчитается автоматически.</p>
          <button className="primary-button" type="button" onClick={() => setIsAdding(true)}>
            Добавить клиента
          </button>
        </section>
      ) : (
        <ul className="client-list" aria-label="Список клиентов">
          {clients.map((client) => {
            const status = getMembershipStatus(client.membershipEndsOn)
            return (
              <li className="client-card" key={client.id}>
                <div className="client-card-heading">
                  <div>
                    <h2>{client.name}</h2>
                    <a href={`tel:${client.phone}`}>{client.phone}</a>
                  </div>
                  <span className={`status-badge status-${status.kind}`}>{status.label}</span>
                </div>
                <dl className="client-details">
                  <div>
                    <dt>До</dt>
                    <dd>{formatShortDate(client.membershipEndsOn)}</dd>
                  </div>
                  <div>
                    <dt>Оплата</dt>
                    <dd>{moneyFormatter.format(client.firstPayment.amountRubles)}</dd>
                  </div>
                </dl>
              </li>
            )
          })}
        </ul>
      )}
      <ReloadPrompt />
    </main>
  )
}

export default App
