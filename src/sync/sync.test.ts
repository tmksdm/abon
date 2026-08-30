import { beforeEach, describe, expect, it, vi } from 'vitest'
import { localStorageClientRepository } from '../data/localStorageClientRepository'
import { localStorageTariffRepository } from '../data/localStorageTariffRepository'
import type { CloudStore, SyncOperation } from './sync'
import { createSyncController } from './sync'

function createCloudStore() {
  const applied = new Set<string>()
  const operations: SyncOperation[] = []
  const cloud: CloudStore = {
    bootstrap: vi.fn(async (local) => local),
    load: vi.fn(async () => ({ clients: await localStorageClientRepository.list(), tariffs: [] })),
    apply: vi.fn(async (operation) => {
      if (applied.has(operation.id)) return
      applied.add(operation.id)
      operations.push(operation)
    }),
    subscribe: vi.fn(() => () => undefined),
  }
  return { cloud, operations }
}

describe('sync controller', () => {
  beforeEach(() => window.localStorage.clear())

  it('сохраняет изменение локально без сети и оставляет его в очереди', async () => {
    const { cloud } = createCloudStore()
    const controller = createSyncController({
      localClients: localStorageClientRepository,
      localTariffs: localStorageTariffRepository,
      cloud, queueKey: 'test.queue', isOnline: () => false,
    })

    const client = await controller.clientRepository.add({
      name: 'Анна', phone: '9991234567', amountRubles: 3000, paidOn: '2026-08-30', durationMonths: 1,
    })

    expect((await controller.clientRepository.list())[0].id).toBe(client.id)
    expect(controller.getState()).toEqual({ phase: 'offline', pending: 1 })
    expect(cloud.apply).not.toHaveBeenCalled()
  })

  it('открывает локальные данные без обращения к облаку при холодном старте офлайн', async () => {
    const { cloud } = createCloudStore()
    const controller = createSyncController({
      localClients: localStorageClientRepository,
      localTariffs: localStorageTariffRepository,
      cloud, queueKey: 'test.queue', isOnline: () => false,
    })
    await localStorageClientRepository.add({
      name: 'Анна', phone: '9991234567', amountRubles: 3000, paidOn: '2026-08-30', durationMonths: 1,
    })

    await controller.start()

    expect(await controller.clientRepository.list()).toHaveLength(1)
    expect(controller.getState()).toEqual({ phase: 'offline', pending: 0 })
    expect(cloud.bootstrap).not.toHaveBeenCalled()
  })

  it('не запускает параллельную повторную отправку одной операции', async () => {
    const { cloud, operations } = createCloudStore()
    const controller = createSyncController({
      localClients: localStorageClientRepository,
      localTariffs: localStorageTariffRepository,
      cloud, queueKey: 'test.queue', isOnline: () => true,
    })
    await controller.clientRepository.add({
      name: 'Анна', phone: '9991234567', amountRubles: 3000, paidOn: '2026-08-30', durationMonths: 1,
    })

    await Promise.all([controller.syncNow(), controller.syncNow()])

    expect(operations).toHaveLength(1)
    expect(controller.getState()).toEqual({ phase: 'synced', pending: 0 })
  })
})
