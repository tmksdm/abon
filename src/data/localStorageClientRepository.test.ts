import { beforeEach, describe, expect, it, vi } from 'vitest'
import { localStorageClientRepository } from './localStorageClientRepository'

describe('localStorageClientRepository', () => {
  beforeEach(() => {
    window.localStorage.clear()
    let nextId = 0
    vi.stubGlobal('crypto', { randomUUID: () => `generated-${++nextId}` })
  })

  it('возвращает клиента после создания нового экземпляра приложения', async () => {
    await localStorageClientRepository.add({
      name: 'Анна', phone: '+7 900 123-45-67', amountRubles: 3000,
      paidOn: '2026-08-29', durationMonths: 1,
    })
    await expect(localStorageClientRepository.list()).resolves.toMatchObject([
      { id: 'generated-1', name: 'Анна', membershipEndsOn: '2026-09-29' },
    ])
  })

  it('отклоняет повреждённые данные вместо частичного показа', async () => {
    window.localStorage.setItem('abon.clients.v2', '{"name":"Анна"}')
    await expect(localStorageClientRepository.list()).rejects.toThrow('Invalid stored clients')
  })

  it('переносит старую запись с первой оплатой в новую схему', async () => {
    window.localStorage.setItem('abon.clients.v1', JSON.stringify([{
      id: 'client-1', name: 'Анна', phone: '+7 900 123-45-67', membershipEndsOn: '2026-09-29',
      firstPayment: { amountRubles: 3000, paidOn: '2026-08-29', durationMonths: 1 },
      createdAt: '2026-08-29T00:00:00.000Z',
    }]))

    await expect(localStorageClientRepository.list()).resolves.toMatchObject([{
      id: 'client-1', payments: [{ id: 'legacy-client-1', amountRubles: 3000 }],
    }])
    expect(window.localStorage.getItem('abon.clients.v1')).not.toBeNull()
    expect(window.localStorage.getItem('abon.clients.v2')).not.toBeNull()
  })

  it('не создаёт дубль при повторе операции оплаты', async () => {
    const client = await localStorageClientRepository.add({
      name: 'Анна', phone: '9001234567', amountRubles: 3000,
      paidOn: '2026-08-29', durationMonths: 1,
    })
    const payment = { id: 'payment-2', amountRubles: 3500, paidOn: '2026-09-20', durationMonths: 1 }
    await localStorageClientRepository.addPayment(client.id, payment)
    await localStorageClientRepository.addPayment(client.id, payment)

    await expect(localStorageClientRepository.list()).resolves.toMatchObject([{
      membershipEndsOn: '2026-10-29', payments: [{ id: 'payment-2' }, { amountRubles: 3000 }],
    }])
  })
})
