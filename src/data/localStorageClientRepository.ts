import type { Client, NewClient, NewPayment, Payment } from '../domain/client'
import { addCalendarMonths, isCalendarDate, normalizeRussianPhone, renewClient } from '../domain/client'
import type { ClientRepository } from './clientRepository'

const STORAGE_KEY = 'abon.clients.v2'
const LEGACY_STORAGE_KEY = 'abon.clients.v1'

type LegacyClient = Omit<Client, 'payments'> & {
  firstPayment: Omit<Payment, 'id' | 'membershipEndsOn' | 'createdAt'>
}

function isPayment(value: unknown): value is Payment {
  if (!value || typeof value !== 'object') return false
  const payment = value as Record<string, unknown>
  return typeof payment.id === 'string'
    && payment.id.length > 0
    && typeof payment.amountRubles === 'number'
    && Number.isSafeInteger(payment.amountRubles)
    && payment.amountRubles > 0
    && typeof payment.paidOn === 'string'
    && isCalendarDate(payment.paidOn)
    && typeof payment.durationMonths === 'number'
    && Number.isInteger(payment.durationMonths)
    && payment.durationMonths > 0
    && typeof payment.membershipEndsOn === 'string'
    && isCalendarDate(payment.membershipEndsOn)
    && typeof payment.createdAt === 'string'
    && Number.isFinite(Date.parse(payment.createdAt))
}

function hasValidClientFields(client: Record<string, unknown>) {
  try {
    return typeof client.id === 'string'
      && client.id.length > 0
      && typeof client.name === 'string'
      && client.name.trim().length > 0
      && typeof client.phone === 'string'
      && normalizeRussianPhone(client.phone) === client.phone
      && typeof client.membershipEndsOn === 'string'
      && isCalendarDate(client.membershipEndsOn)
      && typeof client.createdAt === 'string'
      && Number.isFinite(Date.parse(client.createdAt))
  } catch {
    return false
  }
}

function isClient(value: unknown): value is Client {
  if (!value || typeof value !== 'object') return false
  const client = value as Record<string, unknown>
  if (!hasValidClientFields(client) || !Array.isArray(client.payments) || client.payments.length === 0) return false

  const payments = client.payments
  return payments.every(isPayment)
    && new Set(payments.map((payment) => payment.id)).size === payments.length
    && payments[0].membershipEndsOn === client.membershipEndsOn
}

function isLegacyClient(value: unknown): value is LegacyClient {
  if (!value || typeof value !== 'object') return false
  const client = value as Record<string, unknown>
  const payment = client.firstPayment
  if (!hasValidClientFields(client) || !payment || typeof payment !== 'object') return false

  const typedPayment = payment as Record<string, unknown>
  return typeof typedPayment.amountRubles === 'number'
    && Number.isSafeInteger(typedPayment.amountRubles)
    && typedPayment.amountRubles > 0
    && typeof typedPayment.paidOn === 'string'
    && isCalendarDate(typedPayment.paidOn)
    && typeof typedPayment.durationMonths === 'number'
    && Number.isInteger(typedPayment.durationMonths)
    && typedPayment.durationMonths > 0
    && client.membershipEndsOn === addCalendarMonths(typedPayment.paidOn, typedPayment.durationMonths)
}

function parseClients(stored: string, guard: (value: unknown) => boolean) {
  const parsed: unknown = JSON.parse(stored)
  if (!Array.isArray(parsed) || !parsed.every(guard)) throw new Error('Invalid stored clients')
  return parsed
}

function migrateClient(client: LegacyClient): Client {
  return {
    id: client.id,
    name: client.name,
    phone: client.phone,
    membershipEndsOn: client.membershipEndsOn,
    payments: [{
      id: `legacy-${client.id}`,
      ...client.firstPayment,
      membershipEndsOn: client.membershipEndsOn,
      createdAt: client.createdAt,
    }],
    createdAt: client.createdAt,
  }
}

function readClients(): Client[] {
  const stored = window.localStorage.getItem(STORAGE_KEY)
  if (stored) return parseClients(stored, isClient) as Client[]

  const legacyStored = window.localStorage.getItem(LEGACY_STORAGE_KEY)
  if (!legacyStored) return []

  const clients = (parseClients(legacyStored, isLegacyClient) as LegacyClient[]).map(migrateClient)
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(clients))
  return clients
}

function writeClients(clients: Client[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(clients))
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

    const createdAt = new Date().toISOString()
    const membershipEndsOn = addCalendarMonths(input.paidOn, input.durationMonths)
    const client: Client = {
      id: crypto.randomUUID(),
      name,
      phone: normalizeRussianPhone(input.phone),
      membershipEndsOn,
      payments: [{
        id: crypto.randomUUID(),
        amountRubles: input.amountRubles,
        paidOn: input.paidOn,
        durationMonths: input.durationMonths,
        membershipEndsOn,
        createdAt,
      }],
      createdAt,
    }

    writeClients([client, ...readClients()])
    return client
  },

  async addPayment(clientId: string, input: NewPayment) {
    const clients = readClients()
    const clientIndex = clients.findIndex((client) => client.id === clientId)
    if (clientIndex < 0) throw new Error('Client not found')

    const updatedClient = renewClient(clients[clientIndex], input, new Date().toISOString())
    if (updatedClient === clients[clientIndex]) return updatedClient

    const updatedClients = [...clients]
    updatedClients[clientIndex] = updatedClient
    writeClients(updatedClients)
    return updatedClient
  },
}
