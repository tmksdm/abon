import type {
  Client, NewClient, NewMembershipFreeze, NewMembershipFreezeBatch, NewPayment, UpdateClient,
} from '../domain/client'
import {
  addCalendarDays, addCalendarMonths, freezeClient, localCalendarDate, normalizeRussianPhone,
  previewFreezeBatch, renewClient, resumeClient,
} from '../domain/client'
import type { ClientRepository } from './clientRepository'

const DEMO_NAMES = [
  'Алёна Соколова', 'Борис Лебедев', 'Вера Орлова', 'Глеб Миронов', 'Дарья Белова',
  'Егор Власов', 'Жанна Крылова', 'Зоя Фомина', 'Илья Романов', 'Кира Громова',
  'Лев Морозов', 'Майя Воронова', 'Нина Титова', 'Олег Серов', 'Полина Ершова',
  'Роман Жуков', 'Софья Комарова', 'Тимур Данилов', 'Ульяна Гусева', 'Фёдор Зимин',
  'Элина Котова', 'Юрий Назаров', 'Яна Савина', 'Артур Волков', 'Лада Мельникова',
  'Марк Осипов', 'Таисия Кузнецова', 'Ярослав Павлов',
] as const

const END_OFFSETS = [-38, -14, -1, 0, 2, 5, 7, 9, 14, 21, 35, 62, 90, 120] as const
const NOTES = [
  'Предпочитает вечерние тренировки.',
  'Позвонить перед следующим продлением.',
  'Занимается по индивидуальной программе.',
  'Нужна справка для оформления налогового вычета.',
  '',
] as const

function timestamp(date: string, hour = 9) {
  return `${date}T${String(hour).padStart(2, '0')}:00:00.000Z`
}

export function createDemoClients(today = localCalendarDate()): Client[] {
  return DEMO_NAMES.map((name, index) => {
    const membershipEndsOn = addCalendarDays(today, END_OFFSETS[index % END_OFFSETS.length])
    const latestPaidOn = addCalendarDays(membershipEndsOn, -30)
    const hasPaymentHistory = index % 3 === 0
    const olderPaidOn = addCalendarDays(latestPaidOn, -30)
    const amountRubles = 2600 + (index % 5) * 300
    const payments = [{
      id: `demo-payment-${index + 1}-latest`, amountRubles, paidOn: latestPaidOn,
      durationMonths: 1, membershipEndsOn, createdAt: timestamp(latestPaidOn, 10),
    }]
    if (hasPaymentHistory) {
      payments.push({
        id: `demo-payment-${index + 1}-older`, amountRubles: Math.max(2000, amountRubles - 200),
        paidOn: olderPaidOn, durationMonths: 1, membershipEndsOn: latestPaidOn,
        createdAt: timestamp(olderPaidOn, 10),
      })
    }

    const completedFreeze = index % 6 === 0 ? [{
      id: `demo-freeze-${index + 1}-past`, startsOn: addCalendarDays(today, -20),
      plannedResumesOn: addCalendarDays(today, -13), batchId: null, resumedOn: addCalendarDays(today, -15),
      daysApplied: 5, createdAt: timestamp(addCalendarDays(today, -20)),
      resumedAt: timestamp(addCalendarDays(today, -15), 12),
    }] : []

    return {
      id: `demo-client-${index + 1}`,
      name,
      phone: `+7 000 000-${String(index + 1).padStart(2, '0')}-00`,
      note: NOTES[index % NOTES.length],
      membershipEndsOn,
      payments,
      freezes: completedFreeze,
      archivedAt: null,
      createdAt: timestamp(addCalendarDays(today, -90 - index), 8),
    }
  }).map((client, index) => {
    if (![3, 11, 19].includes(index)) return client
    const startsOn = addCalendarDays(today, -2)
    const plannedResumesOn = addCalendarDays(today, 5 + (index % 3))
    const daysApplied = 7 + (index % 3)
    return {
      ...client,
      membershipEndsOn: addCalendarDays(today, 35 + index),
      freezes: [{
        id: `demo-freeze-${index + 1}-active`, startsOn, plannedResumesOn, batchId: null,
        resumedOn: null, daysApplied, createdAt: timestamp(startsOn), resumedAt: null,
      }, ...client.freezes],
    }
  })
}

export function createDemoClientRepository(today = localCalendarDate()): ClientRepository {
  let clients = createDemoClients(today)

  function findClientIndex(clientId: string) {
    const index = clients.findIndex((client) => client.id === clientId)
    if (index < 0) throw new Error('Client not found')
    return index
  }

  function replaceClient(index: number, client: Client) {
    clients = clients.map((item, itemIndex) => itemIndex === index ? client : item)
    return client
  }

  function ensureActive(index: number) {
    if (clients[index].archivedAt !== null) throw new Error('Client is archived')
  }

  return {
    async list() {
      return [...clients]
    },

    async replaceAll(replacement) {
      clients = replacement.map((client) => ({
        ...client,
        payments: client.payments.map((payment) => ({ ...payment })),
        freezes: client.freezes.map((freeze) => ({ ...freeze })),
      }))
    },

    async add(input: NewClient) {
      const name = input.name.trim()
      if (!name || !Number.isSafeInteger(input.amountRubles) || input.amountRubles <= 0) {
        throw new Error('Invalid client')
      }
      const createdAt = new Date().toISOString()
      const membershipEndsOn = addCalendarMonths(input.paidOn, input.durationMonths)
      const client: Client = {
        id: crypto.randomUUID(), name, phone: normalizeRussianPhone(input.phone), note: '', membershipEndsOn,
        payments: [{
          id: crypto.randomUUID(), amountRubles: input.amountRubles, paidOn: input.paidOn,
          durationMonths: input.durationMonths, membershipEndsOn, createdAt,
        }],
        freezes: [], archivedAt: null, createdAt,
      }
      clients = [client, ...clients]
      return client
    },

    async update(clientId: string, input: UpdateClient) {
      const index = findClientIndex(clientId)
      ensureActive(index)
      const name = input.name.trim()
      if (!name) throw new Error('Invalid client')
      return replaceClient(index, { ...clients[index], name, phone: normalizeRussianPhone(input.phone) })
    },

    async archive(clientId: string) {
      const index = findClientIndex(clientId)
      if (clients[index].archivedAt !== null) return clients[index]
      return replaceClient(index, { ...clients[index], archivedAt: new Date().toISOString() })
    },

    async restore(clientId: string) {
      const index = findClientIndex(clientId)
      if (clients[index].archivedAt === null) return clients[index]
      return replaceClient(index, { ...clients[index], archivedAt: null })
    },

    async deletePermanently(clientId: string) {
      const index = findClientIndex(clientId)
      if (clients[index].archivedAt === null) throw new Error('Client must be archived')
      clients = clients.filter((client) => client.id !== clientId)
    },

    async addPayment(clientId: string, input: NewPayment) {
      const index = findClientIndex(clientId)
      ensureActive(index)
      return replaceClient(index, renewClient(clients[index], input, new Date().toISOString()))
    },

    async freeze(clientId: string, input: NewMembershipFreeze) {
      const index = findClientIndex(clientId)
      ensureActive(index)
      return replaceClient(index, freezeClient(clients[index], input, new Date().toISOString()))
    },

    async resume(clientId: string, freezeId: string, resumedOn: string) {
      const index = findClientIndex(clientId)
      ensureActive(index)
      return replaceClient(index, resumeClient(clients[index], freezeId, resumedOn, new Date().toISOString()))
    },

    async freezeBatch(input: NewMembershipFreezeBatch) {
      if (!input.id) throw new Error('Invalid freeze batch')
      previewFreezeBatch(clients, input)
      const createdAt = new Date().toISOString()
      clients = clients.map((client) => {
        if (client.archivedAt !== null) return client
        try {
          return freezeClient(client, {
            id: `${input.id}:${client.id}`, batchId: input.id,
            startsOn: input.startsOn, plannedResumesOn: input.plannedResumesOn,
          }, createdAt)
        } catch {
          return client
        }
      })
      return [...clients]
    },

    async resumeBatch(batchId: string, resumedOn: string) {
      if (!batchId) throw new Error('Invalid freeze batch')
      const resumedAt = new Date().toISOString()
      clients = clients.map((client) => {
        if (client.archivedAt !== null) return client
        const freeze = client.freezes.find((item) => item.batchId === batchId && item.resumedOn === null)
        return freeze ? resumeClient(client, freeze.id, resumedOn, resumedAt) : client
      })
      return [...clients]
    },

    async updateNote(clientId: string, note: string) {
      const index = findClientIndex(clientId)
      ensureActive(index)
      return replaceClient(index, { ...clients[index], note: note.trim() })
    },
  }
}
