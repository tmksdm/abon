import { collection, doc, getDoc, getDocs, onSnapshot, runTransaction, setDoc, writeBatch } from 'firebase/firestore'
import type { Firestore } from 'firebase/firestore'
import { isClient } from '../data/localStorageClientRepository'
import { freezeClient, normalizeRussianPhone, renewClient, resumeClient } from '../domain/client'
import { isTariff } from '../domain/tariff'
import type { CloudSnapshot, CloudStore, SyncOperation } from '../sync/sync'

const BATCH_SIZE = 400

type ClientMutationOperation = Extract<SyncOperation, {
  kind: 'update-client' | 'archive-client' | 'add-payment' | 'freeze-client' | 'resume-client' | 'update-note'
}>

export function applyClientOperation(current: ReturnType<typeof assertClient>, operation: ClientMutationOperation) {
  let updated = current
  if (operation.kind === 'update-client') {
    const name = operation.input.name.trim()
    if (!name) throw new Error('Invalid client')
    updated = { ...current, name, phone: normalizeRussianPhone(operation.input.phone) }
  }
  if (operation.kind === 'archive-client') updated = { ...current, archivedAt: operation.archivedAt }
  if (operation.kind === 'add-payment') updated = renewClient(current, operation.input, operation.createdAt)
  if (operation.kind === 'freeze-client') updated = freezeClient(current, operation.input, operation.createdAt)
  if (operation.kind === 'resume-client') {
    updated = resumeClient(current, operation.freezeId, operation.resumedOn, operation.resumedAt)
  }
  if (operation.kind === 'update-note') updated = { ...current, note: operation.note.trim() }
  return updated
}

function assertClient(value: unknown) {
  if (!isClient(value)) throw new Error('Cloud client not found')
  return value
}

function parseSnapshot<T>(values: unknown[], guard: (value: unknown) => value is T, label: string) {
  if (!values.every(guard)) throw new Error(`Invalid cloud ${label}`)
  return values as T[]
}

export function createFirebaseCloudStore(database: Firestore, gymId: string): CloudStore {
  const gym = doc(database, 'gyms', gymId)
  const clients = collection(gym, 'clients')
  const tariffs = collection(gym, 'tariffs')
  const operations = collection(gym, 'operations')

  const load = async (): Promise<CloudSnapshot> => {
    const [clientDocuments, tariffDocuments] = await Promise.all([getDocs(clients), getDocs(tariffs)])
    return {
      clients: parseSnapshot(clientDocuments.docs.map((item) => item.data()), isClient, 'clients'),
      tariffs: parseSnapshot(tariffDocuments.docs.map((item) => item.data()), isTariff, 'tariffs'),
    }
  }

  return {
    async bootstrap(local) {
      const gymSnapshot = await getDoc(gym)
      if (!gymSnapshot.exists()) throw new Error('Gym not found')
      if (gymSnapshot.data().dataInitialized !== true) {
        const writes = [
          ...local.clients.map((client) => ({ path: 'clients' as const, id: client.id, value: client })),
          ...local.tariffs.map((tariff) => ({ path: 'tariffs' as const, id: tariff.id, value: tariff })),
        ]
        for (let offset = 0; offset < writes.length; offset += BATCH_SIZE) {
          const batch = writeBatch(database)
          for (const write of writes.slice(offset, offset + BATCH_SIZE)) {
            batch.set(doc(gym, write.path, write.id), write.value)
          }
          await batch.commit()
        }
        await setDoc(gym, { dataInitialized: true }, { merge: true })
      }
      return load()
    },
    load,
    async apply(operation: SyncOperation) {
      const marker = doc(operations, operation.id)
      await runTransaction(database, async (transaction) => {
        if ((await transaction.get(marker)).exists()) return
        if (operation.kind === 'put-client') {
          transaction.set(doc(clients, operation.value.id), operation.value)
        } else if (operation.kind === 'delete-client') {
          transaction.delete(doc(clients, operation.clientId))
        } else if (operation.kind === 'put-tariff') {
          transaction.set(doc(tariffs, operation.value.id), operation.value)
        } else if (operation.kind === 'delete-tariff') {
          transaction.delete(doc(tariffs, operation.tariffId))
        } else {
          const clientReference = doc(clients, operation.clientId)
          const snapshot = await transaction.get(clientReference)
          if (!snapshot.exists()) throw new Error('Cloud client not found')
          transaction.set(clientReference, applyClientOperation(assertClient(snapshot.data()), operation))
        }
        transaction.set(marker, { kind: operation.kind, appliedAt: new Date().toISOString() })
      })
    },
    subscribe(listener) {
      let scheduled = false
      const schedule = () => {
        if (scheduled) return
        scheduled = true
        queueMicrotask(() => { scheduled = false; listener() })
      }
      const unsubscribeClients = onSnapshot(clients, schedule)
      const unsubscribeTariffs = onSnapshot(tariffs, schedule)
      return () => { unsubscribeClients(); unsubscribeTariffs() }
    },
  }
}
