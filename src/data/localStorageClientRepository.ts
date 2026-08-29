import type { Client, NewClient } from '../domain/client'
import { addCalendarMonths, isCalendarDate, normalizeRussianPhone } from '../domain/client'
import type { ClientRepository } from './clientRepository'

const STORAGE_KEY = 'abon.clients.v1'

function isClient(value: unknown): value is Client {
  if (!value || typeof value !== 'object') return false
  const client = value as Record<string, unknown>
  const payment = client.firstPayment

  if (!(typeof client.id === 'string'
    && typeof client.name === 'string'
    && client.name.trim().length > 0
    && typeof client.phone === 'string'
    && typeof client.membershipEndsOn === 'string'
    && typeof client.createdAt === 'string'
    && !!payment
    && typeof payment === 'object'
    && typeof (payment as Record<string, unknown>).amountRubles === 'number'
    && typeof (payment as Record<string, unknown>).paidOn === 'string'
    && typeof (payment as Record<string, unknown>).durationMonths === 'number')) return false

  const typedPayment = payment as Record<string, unknown>
  const amountRubles = typedPayment.amountRubles as number
  const paidOn = typedPayment.paidOn as string
  const durationMonths = typedPayment.durationMonths as number

  try {
    return normalizeRussianPhone(client.phone) === client.phone
      && Number.isSafeInteger(amountRubles)
      && amountRubles > 0
      && Number.isInteger(durationMonths)
      && durationMonths > 0
      && isCalendarDate(paidOn)
      && client.membershipEndsOn === addCalendarMonths(paidOn, durationMonths)
      && Number.isFinite(Date.parse(client.createdAt))
  } catch {
    return false
  }
}

function readClients() {
  const stored = window.localStorage.getItem(STORAGE_KEY)
  if (!stored) return []

  const parsed: unknown = JSON.parse(stored)
  if (!Array.isArray(parsed) || !parsed.every(isClient)) throw new Error('Invalid stored clients')
  return parsed
}

export const localStorageClientRepository: ClientRepository = {
  async list() {
    return readClients().sort((left, right) => right.createdAt.localeCompare(left.createdAt))
  },

  async add(input: NewClient) {
    const name = input.name.trim()
    if (!name || !Number.isSafeInteger(input.amountRubles) || input.amountRubles <= 0) {
      throw new Error('Invalid client')
    }

    const client: Client = {
      id: crypto.randomUUID(),
      name,
      phone: normalizeRussianPhone(input.phone),
      membershipEndsOn: addCalendarMonths(input.paidOn, input.durationMonths),
      firstPayment: {
        amountRubles: input.amountRubles,
        paidOn: input.paidOn,
        durationMonths: input.durationMonths,
      },
      createdAt: new Date().toISOString(),
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([client, ...readClients()]))
    return client
  },
}
