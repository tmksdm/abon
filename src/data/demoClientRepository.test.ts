import { beforeEach, describe, expect, it } from 'vitest'
import { getClientMembershipStatus } from '../domain/client'
import { createDemoClientRepository, createDemoClients } from './demoClientRepository'

const TODAY = '2026-08-29'

describe('demoClientRepository', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('создаёт 28 вымышленных клиентов с разными сценариями', () => {
    const clients = createDemoClients(TODAY)
    const statuses = new Set(clients.map((client) => getClientMembershipStatus(client, TODAY).kind))

    expect(clients).toHaveLength(28)
    expect(statuses).toEqual(new Set(['expired', 'due-soon', 'active', 'frozen']))
    expect(clients.some((client) => client.payments.length > 1)).toBe(true)
    expect(clients.some((client) => client.note.length > 0)).toBe(true)
    expect(clients.some((client) => client.freezes.some((freeze) => freeze.resumedOn !== null))).toBe(true)
    expect(clients.every((client) => client.phone.startsWith('+7 000'))).toBe(true)
  })

  it('сохраняет demo-изменения только в памяти', async () => {
    window.localStorage.setItem('abon.clients.v4', 'REAL DATA')
    const repository = createDemoClientRepository(TODAY)

    await repository.updateNote('demo-client-1', 'Изменено только в demo')

    await expect(repository.list()).resolves.toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'demo-client-1', note: 'Изменено только в demo' }),
    ]))
    expect(window.localStorage.getItem('abon.clients.v4')).toBe('REAL DATA')
    await expect(createDemoClientRepository(TODAY).list()).resolves.toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'demo-client-1', note: 'Предпочитает вечерние тренировки.' }),
    ]))
  })
})
