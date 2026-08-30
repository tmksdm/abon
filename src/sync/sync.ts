import type { ClientRepository } from '../data/clientRepository'
import type { TariffRepository } from '../data/tariffRepository'
import type {
  Client, NewMembershipFreeze, NewPayment, UpdateClient,
} from '../domain/client'
import type { Tariff } from '../domain/tariff'

export type CloudSnapshot = { clients: Client[]; tariffs: Tariff[] }

export type SyncOperation =
  | { id: string; kind: 'put-client'; value: Client }
  | { id: string; kind: 'update-client'; clientId: string; input: UpdateClient }
  | { id: string; kind: 'archive-client'; clientId: string; archivedAt: string | null }
  | { id: string; kind: 'add-payment'; clientId: string; input: NewPayment; createdAt: string }
  | { id: string; kind: 'freeze-client'; clientId: string; input: NewMembershipFreeze; createdAt: string }
  | { id: string; kind: 'resume-client'; clientId: string; freezeId: string; resumedOn: string; resumedAt: string }
  | { id: string; kind: 'update-note'; clientId: string; note: string }
  | { id: string; kind: 'delete-client'; clientId: string }
  | { id: string; kind: 'put-tariff'; value: Tariff }
  | { id: string; kind: 'delete-tariff'; tariffId: string }

export interface CloudStore {
  bootstrap(local: CloudSnapshot): Promise<CloudSnapshot>
  load(): Promise<CloudSnapshot>
  apply(operation: SyncOperation): Promise<void>
  subscribe(listener: () => void): () => void
}

export type SyncState = {
  phase: 'starting' | 'synced' | 'offline' | 'syncing' | 'error'
  pending: number
}

type QueueStorage = Pick<Storage, 'getItem' | 'setItem'>

function readQueue(storage: QueueStorage, key: string): SyncOperation[] {
  const stored = storage.getItem(key)
  if (!stored) return []
  const parsed: unknown = JSON.parse(stored)
  if (!Array.isArray(parsed)) throw new Error('Invalid sync queue')
  return parsed as SyncOperation[]
}

export function createSyncController({
  localClients, localTariffs, cloud, storage = window.localStorage, queueKey,
  isOnline = () => navigator.onLine,
}: {
  localClients: ClientRepository
  localTariffs: TariffRepository
  cloud: CloudStore
  storage?: QueueStorage
  queueKey: string
  isOnline?: () => boolean
}) {
  const listeners = new Set<() => void>()
  const stateListeners = new Set<(state: SyncState) => void>()
  let state: SyncState = { phase: 'starting', pending: readQueue(storage, queueKey).length }
  let flushPromise: Promise<void> | null = null
  let stopped = false
  let unsubscribeCloud: (() => void) | null = null

  const subscribeCloud = () => {
    unsubscribeCloud ??= cloud.subscribe(() => { void pull() })
  }

  const publishState = (next: SyncState) => {
    state = next
    for (const listener of stateListeners) listener(state)
  }

  const notifyData = () => {
    for (const listener of listeners) listener()
  }

  const writeQueue = (queue: SyncOperation[]) => {
    storage.setItem(queueKey, JSON.stringify(queue))
    publishState({ phase: isOnline() ? 'syncing' : 'offline', pending: queue.length })
  }

  const enqueue = (operation: SyncOperation) => {
    const queue = readQueue(storage, queueKey)
    if (!queue.some((item) => item.id === operation.id)) writeQueue([...queue, operation])
    void flush()
  }

  const replaceLocal = async (snapshot: CloudSnapshot) => {
    await localClients.replaceAll(snapshot.clients)
    await localTariffs.replaceAll(snapshot.tariffs)
    notifyData()
  }

  const pull = async () => {
    if (!isOnline() || readQueue(storage, queueKey).length > 0 || stopped) return
    const snapshot = await cloud.load()
    if (stopped) return
    await replaceLocal(snapshot)
    publishState({ phase: 'synced', pending: 0 })
  }

  const handleOnline = () => {
    subscribeCloud()
    void flush()
  }

  const handleOffline = () => { void flush() }

  async function runFlush() {
    if (stopped) return
    if (!isOnline()) {
      publishState({ phase: 'offline', pending: readQueue(storage, queueKey).length })
      return
    }
    try {
      let queue = readQueue(storage, queueKey)
      publishState({ phase: queue.length > 0 ? 'syncing' : 'synced', pending: queue.length })
      while (queue.length > 0 && isOnline() && !stopped) {
        const appliedId = queue[0].id
        await cloud.apply(queue[0])
        queue = readQueue(storage, queueKey).filter((operation) => operation.id !== appliedId)
        writeQueue(queue)
      }
      if (!stopped && queue.length === 0) await pull()
    } catch {
      publishState({ phase: isOnline() ? 'error' : 'offline', pending: readQueue(storage, queueKey).length })
    } finally { /* the shared promise is cleared by flush */ }
  }

  function flush() {
    if (flushPromise) return flushPromise
    flushPromise = runFlush().finally(() => { flushPromise = null })
    return flushPromise
  }

  const operationId = () => crypto.randomUUID()
  const clientRepository: ClientRepository = {
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener) },
    list: () => localClients.list(),
    async replaceAll(clients) {
      const previous = await localClients.list()
      await localClients.replaceAll(clients)
      const nextIds = new Set(clients.map((client) => client.id))
      for (const client of clients) enqueue({ id: operationId(), kind: 'put-client', value: client })
      for (const client of previous) {
        if (!nextIds.has(client.id)) enqueue({ id: operationId(), kind: 'delete-client', clientId: client.id })
      }
    },
    async add(input) {
      const client = await localClients.add(input)
      enqueue({ id: operationId(), kind: 'put-client', value: client })
      return client
    },
    async update(clientId, input) {
      const client = await localClients.update(clientId, input)
      enqueue({ id: operationId(), kind: 'update-client', clientId, input })
      return client
    },
    async archive(clientId) {
      const client = await localClients.archive(clientId)
      enqueue({ id: operationId(), kind: 'archive-client', clientId, archivedAt: client.archivedAt })
      return client
    },
    async restore(clientId) {
      const client = await localClients.restore(clientId)
      enqueue({ id: operationId(), kind: 'archive-client', clientId, archivedAt: null })
      return client
    },
    async deletePermanently(clientId) {
      await localClients.deletePermanently(clientId)
      enqueue({ id: operationId(), kind: 'delete-client', clientId })
    },
    async addPayment(clientId, input) {
      const client = await localClients.addPayment(clientId, input)
      const payment = client.payments.find((item) => item.id === input.id)
      if (!payment) throw new Error('Payment not found after save')
      enqueue({ id: operationId(), kind: 'add-payment', clientId, input, createdAt: payment.createdAt })
      return client
    },
    async freeze(clientId, input) {
      const client = await localClients.freeze(clientId, input)
      const freeze = client.freezes.find((item) => item.id === input.id)
      if (!freeze) throw new Error('Freeze not found after save')
      enqueue({ id: operationId(), kind: 'freeze-client', clientId, input, createdAt: freeze.createdAt })
      return client
    },
    async resume(clientId, freezeId, resumedOn) {
      const client = await localClients.resume(clientId, freezeId, resumedOn)
      const freeze = client.freezes.find((item) => item.id === freezeId)
      if (!freeze?.resumedAt) throw new Error('Resume not found after save')
      enqueue({ id: operationId(), kind: 'resume-client', clientId, freezeId, resumedOn, resumedAt: freeze.resumedAt })
      return client
    },
    async freezeBatch(input) {
      const previous = await localClients.list()
      const clients = await localClients.freezeBatch(input)
      const previousById = new Map(previous.map((client) => [client.id, client]))
      for (const client of clients) {
        const oldFreezeIds = new Set(previousById.get(client.id)?.freezes.map((freeze) => freeze.id) ?? [])
        const freeze = client.freezes.find((item) => item.batchId === input.id && !oldFreezeIds.has(item.id))
        if (freeze) enqueue({
          id: operationId(), kind: 'freeze-client', clientId: client.id,
          input: { id: freeze.id, batchId: freeze.batchId, startsOn: freeze.startsOn, plannedResumesOn: freeze.plannedResumesOn },
          createdAt: freeze.createdAt,
        })
      }
      return clients
    },
    async resumeBatch(batchId, resumedOn) {
      const previous = await localClients.list()
      const clients = await localClients.resumeBatch(batchId, resumedOn)
      const previousById = new Map(previous.map((client) => [client.id, client]))
      for (const client of clients) {
        const freeze = client.freezes.find((item) => item.batchId === batchId && item.resumedOn === resumedOn
          && previousById.get(client.id)?.freezes.find((old) => old.id === item.id)?.resumedOn === null)
        if (freeze?.resumedAt) enqueue({
          id: operationId(), kind: 'resume-client', clientId: client.id, freezeId: freeze.id, resumedOn,
          resumedAt: freeze.resumedAt,
        })
      }
      return clients
    },
    async updateNote(clientId, note) {
      const client = await localClients.updateNote(clientId, note)
      enqueue({ id: operationId(), kind: 'update-note', clientId, note: client.note })
      return client
    },
  }

  const tariffRepository: TariffRepository = {
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener) },
    list: () => localTariffs.list(),
    async replaceAll(tariffs) {
      const previous = await localTariffs.list()
      await localTariffs.replaceAll(tariffs)
      const nextIds = new Set(tariffs.map((tariff) => tariff.id))
      for (const tariff of tariffs) enqueue({ id: operationId(), kind: 'put-tariff', value: tariff })
      for (const tariff of previous) {
        if (!nextIds.has(tariff.id)) enqueue({ id: operationId(), kind: 'delete-tariff', tariffId: tariff.id })
      }
    },
    async add(input) {
      const tariff = await localTariffs.add(input)
      enqueue({ id: operationId(), kind: 'put-tariff', value: tariff })
      return tariff
    },
    async update(tariffId, input) {
      const tariff = await localTariffs.update(tariffId, input)
      enqueue({ id: operationId(), kind: 'put-tariff', value: tariff })
      return tariff
    },
    async delete(tariffId) {
      await localTariffs.delete(tariffId)
      enqueue({ id: operationId(), kind: 'delete-tariff', tariffId })
    },
  }

  return {
    clientRepository,
    tariffRepository,
    getState: () => state,
    subscribeState(listener: (next: SyncState) => void) {
      stateListeners.add(listener)
      listener(state)
      return () => stateListeners.delete(listener)
    },
    async start() {
      const local = { clients: await localClients.list(), tariffs: await localTariffs.list() }
      window.addEventListener('online', handleOnline)
      window.addEventListener('offline', handleOffline)
      if (!isOnline()) {
        publishState({ phase: 'offline', pending: readQueue(storage, queueKey).length })
        return
      }
      const cloudSnapshot = await cloud.bootstrap(local)
      if (stopped) return
      if (readQueue(storage, queueKey).length === 0) await replaceLocal(cloudSnapshot)
      if (stopped) return
      subscribeCloud()
      await flush()
    },
    syncNow: flush,
    stop() {
      stopped = true
      unsubscribeCloud?.()
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    },
  }
}
