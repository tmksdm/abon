import { describe, expect, it } from 'vitest'
import type { Client } from '../domain/client'
import type { SyncOperation } from '../sync/sync'
import { applyClientOperation } from './firebaseCloudStore'

const client: Client = {
  id: 'client-1', name: 'Анна', phone: '+7 999 123-45-67', note: '', membershipEndsOn: '2026-09-30',
  payments: [{
    id: 'payment-1', amountRubles: 3000, paidOn: '2026-08-30', durationMonths: 1,
    membershipEndsOn: '2026-09-30', createdAt: '2026-08-30T00:00:00.000Z',
  }],
  freezes: [], archivedAt: null, createdAt: '2026-08-30T00:00:00.000Z',
}

describe('cloud client operations', () => {
  it('объединяет две оплаты с разных устройств и повторно не добавляет ту же оплату', () => {
    const first: Extract<SyncOperation, { kind: 'add-payment' }> = {
      id: 'operation-1', kind: 'add-payment', clientId: client.id,
      input: { id: 'payment-2', amountRubles: 3000, paidOn: '2026-09-30', durationMonths: 1 },
      createdAt: '2026-09-30T00:00:00.000Z',
    }
    const second: Extract<SyncOperation, { kind: 'add-payment' }> = {
      id: 'operation-2', kind: 'add-payment', clientId: client.id,
      input: { id: 'payment-3', amountRubles: 3000, paidOn: '2026-10-30', durationMonths: 1 },
      createdAt: '2026-10-30T00:00:00.000Z',
    }

    const afterBoth = applyClientOperation(applyClientOperation(client, first), second)
    const afterRetry = applyClientOperation(afterBoth, first)

    expect(afterBoth.payments.map((payment) => payment.id)).toEqual(['payment-3', 'payment-2', 'payment-1'])
    expect(afterRetry).toBe(afterBoth)
  })
})
