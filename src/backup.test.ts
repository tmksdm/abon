import { describe, expect, it } from 'vitest'
import type { Client } from './domain/client'
import type { Tariff } from './domain/tariff'
import { createBackup, formatBackupAge, parseBackup } from './backup'

const client: Client = {
  id: 'client-1', name: 'Анна', phone: '+7 900 123-45-67', note: '',
  membershipEndsOn: '2026-09-30', freezes: [], archivedAt: null,
  payments: [{
    id: 'payment-1', amountRubles: 3000, paidOn: '2026-08-30', durationMonths: 1,
    membershipEndsOn: '2026-09-30', createdAt: '2026-08-30T00:00:00.000Z',
  }],
  createdAt: '2026-08-30T00:00:00.000Z',
}

const tariff: Tariff = {
  id: 'tariff-1', name: 'Месяц', amountRubles: 3000, durationMonths: 1,
  createdAt: '2026-08-30T00:00:00.000Z', updatedAt: '2026-08-30T00:00:00.000Z',
}

describe('backup', () => {
  it('создаёт и читает версионированную копию Abon без потери данных', () => {
    const createdAt = '2026-08-30T02:00:00.000Z'
    const backup = createBackup([client], [tariff], createdAt)
    expect(parseBackup(JSON.stringify(backup))).toEqual({
      source: 'abon', createdAt, clients: [client], tariffs: [tariff],
    })
  })

  it('отклоняет чужой формат, неизвестную версию и повреждённые записи', () => {
    expect(() => parseBackup(JSON.stringify({ app: 'gym-tracker', version: 1, createdAt: new Date().toISOString(), data: { clients: [], tariffs: [] } })))
      .toThrow('Unsupported backup app')
    expect(() => parseBackup(JSON.stringify({ app: 'abon', version: 2, createdAt: new Date().toISOString(), data: { clients: [], tariffs: [] } })))
      .toThrow('Unsupported backup version')
    expect(() => parseBackup(JSON.stringify({
      app: 'abon', version: 1, createdAt: new Date().toISOString(), data: { clients: [{ name: 'Нет ID' }], tariffs: [] },
    }))).toThrow('Invalid backup records')
  })

  it('показывает возраст последней независимой копии календарными днями', () => {
    const now = new Date('2026-08-30T12:00:00.000Z')
    expect(formatBackupAge('2026-08-30T01:00:00.000Z', now)).toBe('сегодня')
    expect(formatBackupAge('2026-08-28T01:00:00.000Z', now)).toBe('2 дн. назад')
  })
})
