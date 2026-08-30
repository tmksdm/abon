import { useEffect, useState } from 'react'
import { APP_VERSIONS, CURRENT_APP_VERSION } from './appVersions'
import { AddClientForm } from './components/AddClientForm'
import { AddPaymentForm } from './components/AddPaymentForm'
import { BatchFreezeForm } from './components/BatchFreezeForm'
import { EditClientForm } from './components/EditClientForm'
import { FreezeMembershipForm } from './components/FreezeMembershipForm'
import { Icon } from './components/Icon'
import { ReloadPrompt } from './components/ReloadPrompt'
import { TariffForm } from './components/TariffForm'
import type {
  Client, ClientListFilter, MembershipFreeze, NewClient, NewMembershipFreeze, NewMembershipFreezeBatch, NewPayment,
  UpdateClient,
} from './domain/client'
import {
  formatCompactDate, formatDisplayDate, getActiveFreeze, getClientAttentionSummary,
  getClientMembershipStatus, getMembershipDaysLeft, localCalendarDate, selectClientsForList,
} from './domain/client'
import type { ClientRepository } from './data/clientRepository'
import { createDemoClientRepository } from './data/demoClientRepository'
import { localStorageClientRepository } from './data/localStorageClientRepository'
import { createMemoryTariffRepository } from './data/memoryTariffRepository'
import { localStorageTariffRepository } from './data/localStorageTariffRepository'
import type { TariffRepository } from './data/tariffRepository'
import type { NewTariff, Tariff } from './domain/tariff'

type AppProps = { repository?: ClientRepository; tariffRepository?: TariffRepository }
type AppView =
  | { screen: 'clients'; isAddingClient?: boolean }
  | { screen: 'settings'; isAddingBatchFreeze?: boolean }
  | { screen: 'archive' }
  | { screen: 'client'; clientId: string; isAddingPayment?: boolean; isAddingFreeze?: boolean;
    isEditingClient?: boolean; isConfirmingArchive?: boolean; isConfirmingDelete?: boolean }

const HISTORY_STATE_KEY = 'abonView'

const moneyFormatter = new Intl.NumberFormat('ru-RU', {
  style: 'currency', currency: 'RUB', maximumFractionDigits: 0,
})

function App({ repository = localStorageClientRepository, tariffRepository = localStorageTariffRepository }: AppProps) {
  const [activeRepository, setActiveRepository] = useState<ClientRepository>(repository)
  const [activeTariffRepository, setActiveTariffRepository] = useState<TariffRepository>(tariffRepository)
  const [isDemoMode, setIsDemoMode] = useState(false)
  const [clients, setClients] = useState<Client[]>([])
  const [tariffs, setTariffs] = useState<Tariff[]>([])
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)
  const [isAddingClient, setIsAddingClient] = useState(false)
  const [isAddingBatchFreeze, setIsAddingBatchFreeze] = useState(false)
  const [isAddingPayment, setIsAddingPayment] = useState(false)
  const [isAddingFreeze, setIsAddingFreeze] = useState(false)
  const [isEditingClient, setIsEditingClient] = useState(false)
  const [isConfirmingArchive, setIsConfirmingArchive] = useState(false)
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isArchiveOpen, setIsArchiveOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tariffError, setTariffError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [clientFilter, setClientFilter] = useState<ClientListFilter>('all')
  const activeClients = clients.filter((client) => client.archivedAt === null)
  const archivedClients = clients.filter((client) => client.archivedAt !== null)
  const selectedClient = clients.find((client) => client.id === selectedClientId) ?? null

  const applyView = (view: AppView) => {
    setSelectedClientId(view.screen === 'client' ? view.clientId : null)
    setIsAddingClient(view.screen === 'clients' && view.isAddingClient === true)
    setIsAddingBatchFreeze(view.screen === 'settings' && view.isAddingBatchFreeze === true)
    setIsAddingPayment(view.screen === 'client' && view.isAddingPayment === true)
    setIsAddingFreeze(view.screen === 'client' && view.isAddingFreeze === true)
    setIsEditingClient(view.screen === 'client' && view.isEditingClient === true)
    setIsConfirmingArchive(view.screen === 'client' && view.isConfirmingArchive === true)
    setIsConfirmingDelete(view.screen === 'client' && view.isConfirmingDelete === true)
    setIsSettingsOpen(view.screen === 'settings')
    setIsArchiveOpen(view.screen === 'archive')
  }

  const pushView = (view: AppView) => {
    window.history.pushState({ ...window.history.state, [HISTORY_STATE_KEY]: view }, '')
    applyView(view)
  }

  const retryClients = async () => {
    setIsLoading(true)
    setError(null)
    try { setClients(await activeRepository.list()) }
    catch { setError('Не удалось открыть данные на этом устройстве.') }
    finally { setIsLoading(false) }
  }

  useEffect(() => {
    let isCurrent = true
    activeRepository.list()
      .then((storedClients) => { if (isCurrent) setClients(storedClients) })
      .catch(() => { if (isCurrent) setError('Не удалось открыть данные на этом устройстве.') })
      .finally(() => { if (isCurrent) setIsLoading(false) })
    return () => { isCurrent = false }
  }, [activeRepository])

  const retryTariffs = async () => {
    setTariffError(null)
    try { setTariffs(await activeTariffRepository.list()) }
    catch { setTariffError('Не удалось открыть тарифы на этом устройстве.') }
  }

  useEffect(() => {
    let isCurrent = true
    activeTariffRepository.list()
      .then((storedTariffs) => {
        if (isCurrent) { setTariffs(storedTariffs); setTariffError(null) }
      })
      .catch(() => { if (isCurrent) setTariffError('Не удалось открыть тарифы на этом устройстве.') })
    return () => { isCurrent = false }
  }, [activeTariffRepository])

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
      if (candidate.screen === 'clients' || candidate.screen === 'settings' || candidate.screen === 'archive'
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
      const client = await activeRepository.add(input)
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
      const updatedClient = await activeRepository.addPayment(selectedClient.id, input)
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
      const updatedClient = await activeRepository.updateNote(selectedClient.id, note)
      setClients((current) => current.map((client) => client.id === updatedClient.id ? updatedClient : client))
    } catch {
      throw new Error('Note was not saved')
    }
  }

  const updateClient = async (input: UpdateClient) => {
    if (!selectedClient) return
    try {
      const updatedClient = await activeRepository.update(selectedClient.id, input)
      setClients((current) => current.map((client) => client.id === updatedClient.id ? updatedClient : client))
      setIsEditingClient(false)
      window.history.replaceState({
        ...window.history.state,
        [HISTORY_STATE_KEY]: { screen: 'client', clientId: selectedClient.id },
      }, '')
    } catch {
      throw new Error('Client was not updated')
    }
  }

  const archiveClient = async () => {
    if (!selectedClient) return
    try {
      const updatedClient = await activeRepository.archive(selectedClient.id)
      setClients((current) => current.map((client) => client.id === updatedClient.id ? updatedClient : client))
      const nextView: AppView = { screen: 'clients' }
      window.history.replaceState({ ...window.history.state, [HISTORY_STATE_KEY]: nextView }, '')
      applyView(nextView)
    } catch {
      throw new Error('Client was not archived')
    }
  }

  const restoreClient = async () => {
    if (!selectedClient) return
    try {
      const updatedClient = await activeRepository.restore(selectedClient.id)
      setClients((current) => current.map((client) => client.id === updatedClient.id ? updatedClient : client))
      const nextView: AppView = { screen: 'clients' }
      window.history.replaceState({ ...window.history.state, [HISTORY_STATE_KEY]: nextView }, '')
      applyView(nextView)
    } catch {
      throw new Error('Client was not restored')
    }
  }

  const deleteClientPermanently = async () => {
    if (!selectedClient) return
    const deletedId = selectedClient.id
    try {
      await activeRepository.deletePermanently(deletedId)
      setClients((current) => current.filter((client) => client.id !== deletedId))
      const nextView: AppView = { screen: 'archive' }
      window.history.replaceState({ ...window.history.state, [HISTORY_STATE_KEY]: nextView }, '')
      applyView(nextView)
    } catch {
      throw new Error('Client was not deleted')
    }
  }

  const freezeMembership = async (input: NewMembershipFreeze) => {
    if (!selectedClient) return
    try {
      const updatedClient = await activeRepository.freeze(selectedClient.id, input)
      setClients((current) => current.map((client) => client.id === updatedClient.id ? updatedClient : client))
      setIsAddingFreeze(false)
      window.history.replaceState({
        ...window.history.state,
        [HISTORY_STATE_KEY]: { screen: 'client', clientId: selectedClient.id },
      }, '')
    } catch {
      throw new Error('Freeze was not saved')
    }
  }

  const resumeMembership = async (freezeId: string) => {
    if (!selectedClient) return
    try {
      const updatedClient = await activeRepository.resume(selectedClient.id, freezeId, localCalendarDate())
      setClients((current) => current.map((client) => client.id === updatedClient.id ? updatedClient : client))
    } catch {
      throw new Error('Resume was not saved')
    }
  }

  const freezeBatch = async (input: NewMembershipFreezeBatch) => {
    try {
      setClients(await activeRepository.freezeBatch(input))
      setIsAddingBatchFreeze(false)
      window.history.replaceState({
        ...window.history.state, [HISTORY_STATE_KEY]: { screen: 'settings' },
      }, '')
      setIsSettingsOpen(true)
    } catch {
      throw new Error('Freeze batch was not saved')
    }
  }

  const resumeBatch = async (batchId: string) => {
    try { setClients(await activeRepository.resumeBatch(batchId, localCalendarDate())) }
    catch { throw new Error('Freeze batch was not resumed') }
  }

  const addTariff = async (input: NewTariff) => {
    const tariff = await activeTariffRepository.add(input)
    setTariffs((current) => [...current, tariff])
  }

  const updateTariff = async (tariffId: string, input: NewTariff) => {
    const updated = await activeTariffRepository.update(tariffId, input)
    setTariffs((current) => current.map((tariff) => tariff.id === tariffId ? updated : tariff))
  }

  const deleteTariff = async (tariffId: string) => {
    await activeTariffRepository.delete(tariffId)
    setTariffs((current) => current.filter((tariff) => tariff.id !== tariffId))
  }

  const enterDemoMode = () => {
    setError(null)
    setIsLoading(true)
    setIsDemoMode(true)
    setActiveRepository(createDemoClientRepository())
    setActiveTariffRepository(createDemoTariffRepository())
    pushView({ screen: 'clients' })
  }

  const exitDemoMode = () => {
    setError(null)
    setIsLoading(true)
    setIsDemoMode(false)
    setActiveRepository(repository)
    setActiveTariffRepository(tariffRepository)
    pushView({ screen: 'clients' })
  }

  return (
    <main className="app-shell">
      {!isSettingsOpen && !isArchiveOpen && !selectedClient && <header className="topbar">
        <>
          <div className="home-title"><h1>Клиенты</h1><span className="client-count">{activeClients.length}</span>
            {isDemoMode && <span className="demo-badge">Demo</span>}</div>
          <button className="icon-button" type="button" aria-label="Настройки"
            onClick={() => pushView({ screen: 'settings' })}><Icon name="settings" /></button>
        </>
      </header>}

      {error && (
        <section className="notice error-notice" role="alert">
          <div><strong>Данные недоступны</strong><p>{error}</p></div>
          <button className="quiet-button" type="button" onClick={() => void retryClients()}>Повторить</button>
        </section>
      )}

      {error ? null : isLoading ? (
        <p className="loading" role="status">Загружаем клиентов…</p>
      ) : isSettingsOpen ? (
        <SettingsScreen clients={activeClients} tariffs={tariffs} tariffError={tariffError}
          archivedCount={archivedClients.length} isDemoMode={isDemoMode} isAddingBatchFreeze={isAddingBatchFreeze}
          onEnableDemo={enterDemoMode} onExitDemo={exitDemoMode} onFreezeBatch={freezeBatch} onResumeBatch={resumeBatch}
          onAddTariff={addTariff} onUpdateTariff={updateTariff} onDeleteTariff={deleteTariff}
          onRetryTariffs={() => void retryTariffs()}
          onOpenArchive={() => pushView({ screen: 'archive' })}
          onStartBatchFreeze={() => pushView({ screen: 'settings', isAddingBatchFreeze: true })}
          onCancelBatchFreeze={() => window.history.back()}
          onBack={() => window.history.back()} />
      ) : isArchiveOpen ? (
        <ArchiveScreen clients={archivedClients} isDemoMode={isDemoMode} onBack={() => window.history.back()}
          onOpenClient={(clientId) => pushView({ screen: 'client', clientId })} />
      ) : selectedClient ? (
        <ClientScreen client={selectedClient} tariffs={tariffs} isDemoMode={isDemoMode} isAddingPayment={isAddingPayment} onBack={() => window.history.back()}
          isAddingFreeze={isAddingFreeze} onAddPayment={addPayment} onCancelPayment={() => window.history.back()}
          onStartFreeze={() => pushView({ screen: 'client', clientId: selectedClient.id, isAddingFreeze: true })}
          onFreeze={freezeMembership} onCancelFreeze={() => window.history.back()} onResume={resumeMembership}
          onUpdateNote={updateNote} isEditingClient={isEditingClient} onUpdateClient={updateClient}
          onStartEdit={() => pushView({ screen: 'client', clientId: selectedClient.id, isEditingClient: true })}
          onCancelEdit={() => window.history.back()} isConfirmingArchive={isConfirmingArchive}
          onStartArchive={() => pushView({ screen: 'client', clientId: selectedClient.id, isConfirmingArchive: true })}
          onCancelArchive={() => window.history.back()} onArchive={archiveClient} onRestore={restoreClient}
          isConfirmingDelete={isConfirmingDelete}
          onStartDelete={() => pushView({ screen: 'client', clientId: selectedClient.id, isConfirmingDelete: true })}
          onCancelDelete={() => window.history.back()} onDeletePermanently={deleteClientPermanently} />
      ) : (
        <ClientListScreen clients={activeClients} tariffs={tariffs} query={searchQuery} filter={clientFilter}
          isAdding={isAddingClient}
          onQueryChange={setSearchQuery} onFilterChange={setClientFilter}
          onAddClient={addClient}
          onStartAdd={() => pushView({ screen: 'clients', isAddingClient: true })} onCancelAdd={() => window.history.back()}
          onOpenClient={(clientId) => pushView({ screen: 'client', clientId })} />
      )}
      {!error && !isLoading && !isSettingsOpen && !isArchiveOpen && !isAddingClient && !isAddingPayment && (
        selectedClient && selectedClient.archivedAt === null ? <button className="floating-action" type="button" aria-label="Новая оплата"
          onClick={() => pushView({ screen: 'client', clientId: selectedClient.id, isAddingPayment: true })}>
          <Icon name="add" size={28} /></button>
          : !selectedClient && activeClients.length > 0 && <button className="floating-action" type="button" aria-label="Добавить клиента"
            onClick={() => pushView({ screen: 'clients', isAddingClient: true })}><Icon name="add" size={28} /></button>
      )}
      <ReloadPrompt />
    </main>
  )
}

function SettingsScreen({
  clients, tariffs, tariffError, archivedCount, isDemoMode, isAddingBatchFreeze, onEnableDemo, onExitDemo, onFreezeBatch,
  onStartBatchFreeze, onCancelBatchFreeze, onResumeBatch, onAddTariff, onUpdateTariff, onDeleteTariff,
  onRetryTariffs, onOpenArchive, onBack,
}: {
  clients: Client[]
  tariffs: Tariff[]
  tariffError: string | null
  archivedCount: number
  isDemoMode: boolean
  isAddingBatchFreeze: boolean
  onEnableDemo(): void
  onExitDemo(): void
  onFreezeBatch(input: NewMembershipFreezeBatch): Promise<void>
  onStartBatchFreeze(): void
  onCancelBatchFreeze(): void
  onResumeBatch(batchId: string): Promise<void>
  onAddTariff(input: NewTariff): Promise<void>
  onUpdateTariff(tariffId: string, input: NewTariff): Promise<void>
  onDeleteTariff(tariffId: string): Promise<void>
  onRetryTariffs(): void
  onOpenArchive(): void
  onBack(): void
}) {
  const activeBatch = findCurrentFreezeBatch(clients)
  return <>
    <ScreenHeader title="Настройки" isDemoMode={isDemoMode} onBack={onBack} />
    <section className="version-summary" aria-label="Текущая версия">
      <span>Текущая версия</span><strong>{CURRENT_APP_VERSION}</strong>
    </section>
    <section className="settings-card" aria-labelledby="demo-mode-title">
      <div><p className="eyebrow">Безопасная проба</p><h2 id="demo-mode-title">Demo-режим</h2></div>
      <p>{isDemoMode
        ? 'Сейчас открыта временная база. Выход удалит все сделанные здесь изменения и вернёт ваши данные.'
        : 'Откройте 28 вымышленных клиентов, чтобы попробовать оплаты, заметки и заморозки. Ваша база не изменится.'}</p>
      <button className={isDemoMode ? 'quiet-button' : 'primary-button'} type="button"
        onClick={isDemoMode ? onExitDemo : onEnableDemo}>
        {isDemoMode ? 'Выйти и очистить demo-данные' : 'Включить demo-режим'}
      </button>
    </section>
    <TariffManager tariffs={tariffs} error={tariffError} onAdd={onAddTariff}
      onUpdate={onUpdateTariff} onDelete={onDeleteTariff} onRetry={onRetryTariffs} />
    <section className="settings-card" aria-labelledby="batch-freeze-settings-title">
      <div><p className="eyebrow">Редкая операция</p><h2 id="batch-freeze-settings-title">Общая заморозка</h2></div>
      <p>Поставьте действующие абонементы на паузу на время болезни или отпуска тренера.</p>
      {!activeBatch && !isAddingBatchFreeze && <button className="quiet-button" type="button"
        onClick={onStartBatchFreeze}>Настроить</button>}
      {activeBatch && <BatchFreezeSummary batch={activeBatch} onResume={onResumeBatch} />}
      {isAddingBatchFreeze && <BatchFreezeForm clients={clients} onSubmit={onFreezeBatch} onCancel={onCancelBatchFreeze} />}
    </section>
    <section className="settings-card" aria-labelledby="archive-settings-title">
      <div><p className="eyebrow">Неактивные записи</p><h2 id="archive-settings-title">Архив</h2></div>
      <p>Архивные клиенты не видны в рабочем списке, но их данные и история сохранены.</p>
      <button className="quiet-button" type="button" onClick={onOpenArchive}>
        Открыть архив{archivedCount > 0 ? ` · ${archivedCount}` : ''}
      </button>
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

function createDemoTariffRepository() {
  const timestamp = '2026-08-30T00:00:00.000Z'
  return createMemoryTariffRepository([
    { id: 'demo-tariff-month', name: 'Месяц', amountRubles: 3000, durationMonths: 1, createdAt: timestamp, updatedAt: timestamp },
    { id: 'demo-tariff-quarter', name: 'Три месяца', amountRubles: 8000, durationMonths: 3, createdAt: timestamp, updatedAt: timestamp },
    { id: 'demo-tariff-year', name: 'Год', amountRubles: 28000, durationMonths: 12, createdAt: timestamp, updatedAt: timestamp },
  ])
}

function TariffManager({ tariffs, error, onAdd, onUpdate, onDelete, onRetry }: {
  tariffs: Tariff[]
  error: string | null
  onAdd(input: NewTariff): Promise<void>
  onUpdate(tariffId: string, input: NewTariff): Promise<void>
  onDelete(tariffId: string): Promise<void>
  onRetry(): void
}) {
  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const editingTariff = tariffs.find((tariff) => tariff.id === editingId)

  const add = async (input: NewTariff) => {
    await onAdd(input)
    setIsAdding(false)
  }
  const update = async (input: NewTariff) => {
    if (!editingId) return
    await onUpdate(editingId, input)
    setEditingId(null)
  }
  const remove = async (tariffId: string) => {
    setActionError(null)
    try {
      await onDelete(tariffId)
      setDeletingId(null)
    } catch {
      setActionError('Не удалось удалить тариф. Попробуйте ещё раз.')
    }
  }

  return <section className="settings-card" aria-labelledby="tariffs-settings-title">
    <div><p className="eyebrow">Быстрое заполнение</p><h2 id="tariffs-settings-title">Тарифы</h2></div>
    <p>Выбор тарифа подставляет сумму и срок. Сохранённые оплаты от шаблона не зависят.</p>
    {error ? <div className="field-error" role="alert">{error} <button className="text-button" type="button"
      onClick={onRetry}>Повторить</button></div> : <>
      {tariffs.length > 0 && <ol className="version-list" aria-label="Список тарифов">
        {tariffs.map((tariff) => <li key={tariff.id}>
          <strong>{tariff.name}</strong><p>{moneyFormatter.format(tariff.amountRubles)} · {membershipLabel(tariff.durationMonths)}</p>
          {deletingId === tariff.id ? <div className="confirmation-panel" role="alertdialog" aria-label={`Удалить тариф ${tariff.name}`}>
            <p>Удалить шаблон? Уже сохранённые оплаты останутся без изменений.</p>
            <div className="form-actions"><button className="quiet-button" type="button" onClick={() => setDeletingId(null)}>Отмена</button>
              <button className="danger-button" type="button" onClick={() => void remove(tariff.id)}>Удалить</button></div>
          </div> : <div className="form-actions">
            <button className="text-button" type="button" onClick={() => { setIsAdding(false); setEditingId(tariff.id) }}>Изменить</button>
            <button className="danger-text-button" type="button" onClick={() => setDeletingId(tariff.id)}>Удалить</button>
          </div>}
        </li>)}
      </ol>}
      {actionError && <p className="field-error" role="alert">{actionError}</p>}
      {!isAdding && editingId === null && <button className="quiet-button" type="button" onClick={() => setIsAdding(true)}>
        Добавить тариф</button>}
      {isAdding && <TariffForm onSubmit={add} onCancel={() => setIsAdding(false)} />}
      {editingTariff && <TariffForm tariff={editingTariff} onSubmit={update} onCancel={() => setEditingId(null)} />}
    </>}
  </section>
}

function ArchiveScreen({
  clients, isDemoMode, onBack, onOpenClient,
}: {
  clients: Client[]
  isDemoMode: boolean
  onBack(): void
  onOpenClient(clientId: string): void
}) {
  const [query, setQuery] = useState('')
  const normalizedQuery = query.trim().toLocaleLowerCase('ru-RU')
  const visibleClients = [...clients]
    .filter((client) => normalizedQuery === '' || client.name.toLocaleLowerCase('ru-RU').includes(normalizedQuery))
    .sort((left, right) => left.name.localeCompare(right.name, 'ru'))

  return <>
    <ScreenHeader title="Архив" count={clients.length} isDemoMode={isDemoMode} onBack={onBack} />
    {clients.length > 0 && <label className="search-field archive-search">
      <span className="visually-hidden">Поиск в архиве</span><Icon name="search" />
      <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск по имени" />
    </label>}
    {clients.length === 0 ? <section className="empty-state compact-empty-state">
      <h2>Архив пуст</h2><p>Здесь появятся клиенты, которых вы уберёте из рабочего списка.</p>
    </section> : visibleClients.length === 0 ? <section className="no-results">
      <h2>Никого не нашли</h2><p>Проверьте имя или сбросьте поиск.</p>
      <button className="text-button" type="button" onClick={() => setQuery('')}>Сбросить</button>
    </section> : <ul className="client-list archive-list" aria-label="Архив клиентов">
      {visibleClients.map((client) => <li key={client.id}>
        <button className="client-card" type="button" onClick={() => onOpenClient(client.id)}>
          <span className="client-card-heading"><span className="client-identity"><strong>{client.name}</strong></span>
            <span className="status-badge status-archived">В архиве</span></span>
          <span className="client-summary">История: {client.payments.length} оплат, {client.freezes.length} заморозок</span>
        </button>
      </li>)}
    </ul>}
  </>
}

type ClientListScreenProps = {
  clients: Client[]
  tariffs: Tariff[]
  query: string
  filter: ClientListFilter
  isAdding: boolean
  onAddClient(input: NewClient): Promise<void>
  onStartAdd(): void
  onCancelAdd(): void
  onOpenClient(clientId: string): void
  onQueryChange(query: string): void
  onFilterChange(filter: ClientListFilter): void
}

function ClientListScreen({
  clients, tariffs, query, filter, isAdding, onAddClient, onStartAdd, onCancelAdd, onOpenClient,
  onQueryChange, onFilterChange,
}: ClientListScreenProps) {
  const attention = getClientAttentionSummary(clients)
  const visibleClients = selectClientsForList(clients, query, filter)
  return <>
    {attention.total > 0 && <button className={`attention-banner${filter === 'attention' ? ' attention-banner-active' : ''}`}
      type="button" aria-pressed={filter === 'attention'}
      onClick={() => onFilterChange(filter === 'attention' ? 'all' : 'attention')}>
      <span className="attention-count" aria-hidden="true">{attention.total}</span>
      <span><strong>Требуют продления</strong>
        <small>{attention.overdue} просроч. · {attention.dueSoon} до 7 дней</small></span>
      <Icon name="filter" />
    </button>}
    {clients.length > 0 && <div className="list-tools">
      <label className="search-field"><span className="visually-hidden">Поиск клиентов</span><Icon name="search" />
        <input type="search" value={query} onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Поиск по имени" /></label>
      <label className="filter-field"><span className="visually-hidden">Фильтр клиентов</span><Icon name="filter" />
        <select aria-label="Фильтр клиентов" value={filter}
          onChange={(event) => onFilterChange(event.target.value as ClientListFilter)}>
          <option value="all">Все</option><option value="attention">На контроле</option>
          <option value="active">Активные</option><option value="frozen">Заморожены</option>
        </select></label>
    </div>}
    {isAdding && <AddClientForm tariffs={tariffs} onSubmit={onAddClient} onCancel={onCancelAdd} />}
    {clients.length === 0 && !isAdding ? (
      <section className="empty-state">
        <span className="empty-mark" aria-hidden="true">A</span><h2>Пока нет клиентов</h2>
        <p>Добавьте первого клиента и оплату — срок абонемента рассчитается автоматически.</p>
        <button className="primary-button" type="button" onClick={onStartAdd}>Добавить клиента</button>
      </section>
    ) : visibleClients.length === 0 && !isAdding ? (
      <section className="no-results"><h2>Никого не нашли</h2><p>Измените поиск или фильтр.</p>
        <button className="text-button" type="button" onClick={() => { onQueryChange(''); onFilterChange('all') }}>Сбросить</button></section>
    ) : (
      <ul className="client-list" aria-label="Список клиентов">
        {visibleClients.map((client) => {
          const status = getClientMembershipStatus(client)
          const payment = client.payments[0]
          return <li key={client.id} className={`status-row-${status.kind}`}>
            <button className="client-card" type="button" onClick={() => onOpenClient(client.id)}>
              <span className="client-card-heading">
                <span className="client-identity"><strong>{client.name}</strong></span>
                <span className={`status-badge status-${status.kind}`}>{compactStatus(client)}</span>
              </span>
              <span className="client-summary">{formatCompactDate(payment.paidOn)}<i>·</i>{moneyFormatter.format(payment.amountRubles)}<i>·</i>до {formatCompactDate(client.membershipEndsOn)}<i>·</i>{membershipLabel(payment.durationMonths)}</span>
              {client.note && <span className="client-note-preview">{client.note}</span>}
            </button>
          </li>
        })}
      </ul>
    )}
  </>
}

function compactStatus(client: Client) {
  const status = getClientMembershipStatus(client)
  const days = getMembershipDaysLeft(client.membershipEndsOn)
  if (status.kind === 'frozen' || status.kind === 'active') return status.label
  if (days === 0) return 'Сегодня'
  if (days < 0) return `Просрочен ${Math.abs(days)} дн.`
  return `${days} дн.`
}

function membershipLabel(months: number) {
  if (months === 1) return 'Месяц'
  if (months === 12) return 'Год'
  return `${months} мес.`
}

type FreezeBatchSummary = {
  id: string
  startsOn: string
  plannedResumesOn: string
  affectedClients: number
  totalDaysApplied: number
  isActive: boolean
}

function findCurrentFreezeBatch(clients: Client[]): FreezeBatchSummary | null {
  const today = localCalendarDate()
  const batches = new Map<string, MembershipFreeze[]>()
  for (const client of clients) {
    for (const freeze of client.freezes) {
      if (freeze.batchId && freeze.resumedOn === null) {
        batches.set(freeze.batchId, [...(batches.get(freeze.batchId) ?? []), freeze])
      }
    }
  }
  const candidates = [...batches.entries()].map(([id, freezes]) => ({
    id, startsOn: freezes[0].startsOn, plannedResumesOn: freezes[0].plannedResumesOn,
    affectedClients: freezes.length,
    totalDaysApplied: freezes.reduce((sum, freeze) => sum + freeze.daysApplied, 0),
    isActive: freezes[0].startsOn <= today && today < freezes[0].plannedResumesOn,
  })).filter((batch) => today < batch.plannedResumesOn)
  return candidates.sort((left, right) => left.startsOn.localeCompare(right.startsOn))[0] ?? null
}

function BatchFreezeSummary({
  batch, onResume,
}: {
  batch: FreezeBatchSummary
  onResume(batchId: string): Promise<void>
}) {
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const resume = async () => {
    setIsSaving(true)
    setError(null)
    try { await onResume(batch.id) }
    catch { setError('Не удалось завершить общую заморозку. Попробуйте ещё раз.') }
    finally { setIsSaving(false) }
  }
  return <section className="batch-freeze-card" aria-labelledby="batch-freeze-summary-title">
    <div className="section-heading">
      <div><p className="eyebrow">Пауза для зала</p><h2 id="batch-freeze-summary-title">Общая заморозка</h2></div>
    </div>
    <>
      <p className="freeze-period"><strong>{batch.isActive ? 'Действует сейчас' : 'Запланирована'}</strong>
        <span>{formatDisplayDate(batch.startsOn)} — {formatDisplayDate(batch.plannedResumesOn)}</span></p>
      <p className="empty-note">Затронуто клиентов: {batch.affectedClients}. Добавлено {batch.totalDaysApplied} клиент-дн.</p>
      {batch.isActive && <button className="quiet-button resume-button" type="button" disabled={isSaving}
        onClick={() => void resume()}>{isSaving ? 'Сохраняем…' : 'Завершить сегодня'}</button>}
    </>
    {error && <p className="field-error" role="alert">{error}</p>}
  </section>
}

type ClientScreenProps = {
  client: Client
  tariffs: Tariff[]
  isDemoMode: boolean
  isAddingPayment: boolean
  isAddingFreeze: boolean
  onBack(): void
  onAddPayment(input: NewPayment): Promise<void>
  onCancelPayment(): void
  onStartFreeze(): void
  onFreeze(input: NewMembershipFreeze): Promise<void>
  onCancelFreeze(): void
  onResume(freezeId: string): Promise<void>
  onUpdateNote(note: string): Promise<void>
  isEditingClient: boolean
  onStartEdit(): void
  onUpdateClient(input: UpdateClient): Promise<void>
  onCancelEdit(): void
  isConfirmingArchive: boolean
  onStartArchive(): void
  onCancelArchive(): void
  onArchive(): Promise<void>
  onRestore(): Promise<void>
  isConfirmingDelete: boolean
  onStartDelete(): void
  onCancelDelete(): void
  onDeletePermanently(): Promise<void>
}

function ClientScreen({
  client, tariffs, isDemoMode, isAddingPayment, isAddingFreeze, onBack, onAddPayment, onCancelPayment,
  onStartFreeze, onFreeze, onCancelFreeze, onResume, onUpdateNote,
  isEditingClient, onStartEdit, onUpdateClient, onCancelEdit, isConfirmingArchive,
  onStartArchive, onCancelArchive, onArchive, onRestore, isConfirmingDelete,
  onStartDelete, onCancelDelete, onDeletePermanently,
}: ClientScreenProps) {
  const status = getClientMembershipStatus(client)
  const isArchived = client.archivedAt !== null
  const [isActionSaving, setIsActionSaving] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const activeFreeze = getActiveFreeze(client)
  const upcomingFreeze = client.freezes.find((freeze) => freeze.resumedOn === null && freeze.startsOn > localCalendarDate()) ?? null
  const operations = [
    ...client.payments.map((payment) => ({ kind: 'payment' as const, occurredOn: payment.paidOn, createdAt: payment.createdAt, payment })),
    ...client.freezes.map((freeze) => ({ kind: 'freeze' as const, occurredOn: freeze.startsOn, createdAt: freeze.createdAt, freeze })),
  ].sort((left, right) => right.occurredOn.localeCompare(left.occurredOn) || right.createdAt.localeCompare(left.createdAt))
  const runAction = async (action: () => Promise<void>, errorMessage: string) => {
    setIsActionSaving(true)
    setActionError(null)
    try { await action() }
    catch { setActionError(errorMessage); setIsActionSaving(false) }
  }
  return <>
    <ScreenHeader title="Клиент" isDemoMode={isDemoMode} onBack={onBack} />
    <section className="client-identity-card" aria-labelledby="client-title">
      <div className="client-identity-main"><div><h1 id="client-title">{client.name}</h1>
        <a className="client-phone" href={`tel:${client.phone}`}>{client.phone}</a></div>
        <span className={`status-badge status-${isArchived ? 'archived' : status.kind}`}>
          {isArchived ? 'В архиве' : status.label}
        </span></div>
      {isArchived ? <>
        <p className="empty-note">Клиент скрыт из рабочего списка. Вся история сохранена.</p>
        <div className="record-actions">
          <button className="primary-button" type="button" disabled={isActionSaving}
            onClick={() => void runAction(onRestore, 'Не удалось вернуть клиента. Попробуйте ещё раз.')}>
            {isActionSaving ? 'Сохраняем…' : 'Вернуть в рабочий список'}
          </button>
          {!isConfirmingDelete && <button className="danger-text-button" type="button" onClick={onStartDelete}>Удалить окончательно</button>}
        </div>
        {isConfirmingDelete && <ConfirmationPanel title="Удалить клиента безвозвратно?"
          text="Имя, телефон, оплаты, заметка и история заморозок будут удалены. Отменить это действие нельзя."
          confirmLabel="Удалить безвозвратно" isSaving={isActionSaving} onCancel={onCancelDelete}
          onConfirm={() => void runAction(onDeletePermanently, 'Не удалось удалить клиента. Попробуйте ещё раз.')} />}
      </> : <>
        <div className="record-actions">
          <button className="quiet-button" type="button" onClick={onStartEdit}>Изменить данные</button>
          {!isConfirmingArchive && <button className="danger-text-button" type="button" onClick={onStartArchive}>Архивировать</button>}
        </div>
        {isConfirmingArchive && <ConfirmationPanel title="Убрать клиента в архив?"
          text="Клиент исчезнет из рабочего списка, но данные и история сохранятся. Его можно будет вернуть."
          confirmLabel="Архивировать" isSaving={isActionSaving} onCancel={onCancelArchive}
          onConfirm={() => void runAction(onArchive, 'Не удалось архивировать клиента. Попробуйте ещё раз.')} />}
      </>}
      {actionError && <p className="field-error" role="alert">{actionError}</p>}
    </section>
    {isEditingClient && <EditClientForm client={client} onSubmit={onUpdateClient} onCancel={onCancelEdit} />}
    <section className="membership-summary" aria-label="Текущий абонемент">
      <span>Абонемент до</span><strong>{formatDisplayDate(client.membershipEndsOn)}</strong>
    </section>
    {!isArchived && <FreezeSummary freeze={activeFreeze ?? upcomingFreeze} isActive={activeFreeze !== null}
      canStart={!isAddingFreeze && status.kind !== 'expired' && activeFreeze === null && upcomingFreeze === null}
      onStart={onStartFreeze} onResume={onResume} />}
    {isAddingFreeze && !isArchived && <FreezeMembershipForm onSubmit={onFreeze} onCancel={onCancelFreeze} />}
    {!isArchived && <ClientNote note={client.note} onSave={onUpdateNote} />}
    {isArchived && client.note && <section className="note-card" aria-labelledby="archived-client-note-title">
      <div className="section-heading"><h2 id="archived-client-note-title">Заметка</h2></div><p className="client-note">{client.note}</p>
    </section>}
    {isAddingPayment && !isArchived && <AddPaymentForm tariffs={tariffs} onSubmit={onAddPayment} onCancel={onCancelPayment} />}
    <section className="history-section" aria-labelledby="operation-history-title">
      <div className="section-heading"><div><p className="eyebrow">Все изменения срока</p><h2 id="operation-history-title">История операций</h2></div>
        <span className="client-count">{operations.length}</span></div>
      <ol className="payment-list operation-list">
        {operations.map((operation) => operation.kind === 'payment' ? <li key={`payment-${operation.payment.id}`}>
          <div><strong>{moneyFormatter.format(operation.payment.amountRubles)}</strong><span>{operation.payment.durationMonths} мес.</span></div>
          <time dateTime={operation.payment.paidOn}>{formatDisplayDate(operation.payment.paidOn)}</time>
        </li> : <li key={`freeze-${operation.freeze.id}`}>
          <div><strong>{operation.freeze.batchId ? 'Общая заморозка' : 'Заморозка'}</strong><span>+{operation.freeze.daysApplied} дн. к сроку</span></div>
          <span className="operation-date">{formatDisplayDate(operation.freeze.startsOn)} — {formatDisplayDate(operation.freeze.resumedOn ?? operation.freeze.plannedResumesOn)}</span>
        </li>)}
      </ol>
    </section>
  </>
}

function ScreenHeader({
  title, count, isDemoMode, onBack,
}: {
  title: string
  count?: number
  isDemoMode: boolean
  onBack(): void
}) {
  return <header className="screen-header">
    <button className="screen-back-button" type="button" onClick={onBack} aria-label="Назад"><Icon name="arrow-back" /></button>
    <h1>{title}</h1>
    {count !== undefined && <span className="client-count">{count}</span>}
    {isDemoMode && <span className="demo-badge">Demo</span>}
  </header>
}

function ConfirmationPanel({
  title, text, confirmLabel, isSaving, onCancel, onConfirm,
}: {
  title: string
  text: string
  confirmLabel: string
  isSaving: boolean
  onCancel(): void
  onConfirm(): void
}) {
  return <section className="confirmation-panel" role="alertdialog" aria-labelledby="confirmation-title" aria-describedby="confirmation-text">
    <strong id="confirmation-title">{title}</strong><p id="confirmation-text">{text}</p>
    <div className="form-actions">
      <button className="quiet-button" type="button" disabled={isSaving} onClick={onCancel}>Отмена</button>
      <button className="danger-button" type="button" disabled={isSaving} onClick={onConfirm}>
        {isSaving ? 'Сохраняем…' : confirmLabel}
      </button>
    </div>
  </section>
}

function FreezeSummary({
  freeze, isActive, canStart, onStart, onResume,
}: {
  freeze: MembershipFreeze | null
  isActive: boolean
  canStart: boolean
  onStart(): void
  onResume(freezeId: string): Promise<void>
}) {
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const resume = async () => {
    if (!freeze) return
    setIsSaving(true)
    setError(null)
    try { await onResume(freeze.id) }
    catch { setError('Не удалось завершить заморозку. Попробуйте ещё раз.') }
    finally { setIsSaving(false) }
  }

  return <section className="freeze-card" aria-labelledby="freeze-summary-title">
    <div className="section-heading">
      <div><p className="eyebrow">Сохранение дней</p><h2 id="freeze-summary-title">Заморозка</h2></div>
      {canStart && <button className="text-button" type="button" onClick={onStart}>Заморозить</button>}
    </div>
    {freeze ? <>
      <p className="freeze-period"><strong>{isActive ? 'Заморожен' : 'Запланирована'}</strong>
        <span>{formatDisplayDate(freeze.startsOn)} — {formatDisplayDate(freeze.plannedResumesOn)}</span></p>
      <p className="empty-note">К сроку добавлено {freeze.daysApplied} дн.</p>
      {isActive && freeze.batchId === null && <button className="quiet-button resume-button" type="button" disabled={isSaving}
        onClick={() => void resume()}>{isSaving ? 'Сохраняем…' : 'Разморозить сегодня'}</button>}
      {freeze.batchId && <p className="empty-note batch-freeze-note">Общая заморозка управляется из списка клиентов.</p>}
    </> : <p className="empty-note">Абонемент можно поставить на паузу, чтобы дни не сгорели.</p>}
    {error && <p className="field-error" role="alert">{error}</p>}
  </section>
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
