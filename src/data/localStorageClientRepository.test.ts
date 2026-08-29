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

  it('отклоняет заморозку с числом дней, которое не совпадает с периодом', async () => {
    window.localStorage.setItem('abon.clients.v4', JSON.stringify([{
      id: 'client-1', name: 'Анна', phone: '+7 900 123-45-67', note: '', membershipEndsOn: '2026-10-09',
      payments: [{
        id: 'payment-1', amountRubles: 3000, paidOn: '2026-08-29', durationMonths: 1,
        membershipEndsOn: '2026-09-29', createdAt: '2026-08-29T00:00:00.000Z',
      }],
      freezes: [{
        id: 'freeze-1', batchId: null, startsOn: '2026-09-01', plannedResumesOn: '2026-09-11',
        resumedOn: null, daysApplied: 11, createdAt: '2026-09-01T00:00:00.000Z', resumedAt: null,
      }],
      createdAt: '2026-08-29T00:00:00.000Z',
    }]))

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
    expect(window.localStorage.getItem('abon.clients.v4')).not.toBeNull()
  })

  it('переносит данные v2 с пустой заметкой без потери оплат', async () => {
    window.localStorage.setItem('abon.clients.v2', JSON.stringify([{
      id: 'client-1', name: 'Анна', phone: '+7 900 123-45-67', membershipEndsOn: '2026-09-29',
      payments: [{
        id: 'payment-1', amountRubles: 3000, paidOn: '2026-08-29', durationMonths: 1,
        membershipEndsOn: '2026-09-29', createdAt: '2026-08-29T00:00:00.000Z',
      }],
      createdAt: '2026-08-29T00:00:00.000Z',
    }]))

    await expect(localStorageClientRepository.list()).resolves.toMatchObject([{
      id: 'client-1', note: '', payments: [{ id: 'payment-1' }],
    }])
    expect(window.localStorage.getItem('abon.clients.v2')).not.toBeNull()
    expect(window.localStorage.getItem('abon.clients.v4')).not.toBeNull()
  })

  it('переносит данные v3 с пустой историей заморозок', async () => {
    window.localStorage.setItem('abon.clients.v3', JSON.stringify([{
      id: 'client-1', name: 'Анна', phone: '+7 900 123-45-67', note: 'Вечером', membershipEndsOn: '2026-09-29',
      payments: [{
        id: 'payment-1', amountRubles: 3000, paidOn: '2026-08-29', durationMonths: 1,
        membershipEndsOn: '2026-09-29', createdAt: '2026-08-29T00:00:00.000Z',
      }],
      createdAt: '2026-08-29T00:00:00.000Z',
    }]))

    await expect(localStorageClientRepository.list()).resolves.toMatchObject([{
      id: 'client-1', note: 'Вечером', freezes: [],
    }])
    expect(window.localStorage.getItem('abon.clients.v3')).not.toBeNull()
    expect(window.localStorage.getItem('abon.clients.v4')).not.toBeNull()
  })

  it('сохраняет обрезанную по краям заметку', async () => {
    const client = await localStorageClientRepository.add({
      name: 'Анна', phone: '9001234567', amountRubles: 3000,
      paidOn: '2026-08-29', durationMonths: 1,
    })
    await localStorageClientRepository.updateNote(client.id, '  Вечерние тренировки.  ')

    await expect(localStorageClientRepository.list()).resolves.toMatchObject([{
      id: client.id, note: 'Вечерние тренировки.',
    }])
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

  it('сохраняет заморозку и не расходует неиспользованные дни при досрочной разморозке', async () => {
    const client = await localStorageClientRepository.add({
      name: 'Анна', phone: '9001234567', amountRubles: 3000,
      paidOn: '2026-08-29', durationMonths: 1,
    })
    const freeze = { id: 'freeze-1', startsOn: '2026-09-01', plannedResumesOn: '2026-09-11' }
    await localStorageClientRepository.freeze(client.id, freeze)
    await localStorageClientRepository.freeze(client.id, freeze)
    await localStorageClientRepository.resume(client.id, freeze.id, '2026-09-04')

    await expect(localStorageClientRepository.list()).resolves.toMatchObject([{
      membershipEndsOn: '2026-10-02',
      freezes: [{ id: 'freeze-1', batchId: null, resumedOn: '2026-09-04', daysApplied: 3 }],
    }])
  })
})
