import { beforeEach, describe, expect, it, vi } from 'vitest'
import { localStorageClientRepository } from './localStorageClientRepository'

describe('localStorageClientRepository', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.stubGlobal('crypto', { randomUUID: () => 'client-1' })
  })

  it('возвращает клиента после создания нового экземпляра приложения', async () => {
    await localStorageClientRepository.add({
      name: 'Анна',
      phone: '+7 900 123-45-67',
      amountRubles: 3000,
      paidOn: '2026-08-29',
      durationMonths: 1,
    })

    await expect(localStorageClientRepository.list()).resolves.toMatchObject([
      { id: 'client-1', name: 'Анна', membershipEndsOn: '2026-09-29' },
    ])
  })

  it('отклоняет повреждённые данные вместо частичного показа', async () => {
    window.localStorage.setItem('abon.clients.v1', '{"name":"Анна"}')
    await expect(localStorageClientRepository.list()).rejects.toThrow('Invalid stored clients')

    window.localStorage.setItem('abon.clients.v1', JSON.stringify([{
      id: 'client-1',
      name: 'Анна',
      phone: '+7 900 123-45-67',
      membershipEndsOn: 'не дата',
      firstPayment: { amountRubles: -1, paidOn: '2026-08-29', durationMonths: 1 },
      createdAt: '2026-08-29T00:00:00.000Z',
    }]))
    await expect(localStorageClientRepository.list()).rejects.toThrow('Invalid stored clients')
  })
})
