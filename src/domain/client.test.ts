import { describe, expect, it } from 'vitest'
import type { Client } from './client'
import {
  addCalendarMonths, formatCompactDate, formatDisplayDate, freezeClient, getClientAttentionSummary,
  getClientMembershipStatus, getMembershipStatus, localCalendarDate, normalizeRussianPhone,
  parseWholeRubles, previewFreezeBatch, renewClient, resumeClient, selectClientsForList, sortClientsByUrgency,
} from './client'

function listClient(id: string, name: string, membershipEndsOn: string, freezes: Client['freezes'] = []): Client {
  return {
    id, name, phone: '+7 900 000-00-00', note: '', membershipEndsOn, freezes, archivedAt: null,
    createdAt: '2026-08-01T00:00:00.000Z',
    payments: [{
      id: `payment-${id}`, amountRubles: 3000, paidOn: '2026-08-01', durationMonths: 1,
      membershipEndsOn, createdAt: '2026-08-01T00:00:00.000Z',
    }],
  }
}

describe('client domain', () => {
  it('считает срок календарными месяцами и ограничивает короткий месяц', () => {
    expect(addCalendarMonths('2026-08-29', 1)).toBe('2026-09-29')
    expect(addCalendarMonths('2024-01-31', 1)).toBe('2024-02-29')
  })

  it('принимает только целые рубли', () => {
    expect(parseWholeRubles('3000')).toBe(3000)
    expect(() => parseWholeRubles('1499,90')).toThrow('Invalid amount')
  })

  it('приводит российский телефон к единому формату', () => {
    expect(normalizeRussianPhone('+7 900 123-45-67')).toBe('+7 900 123-45-67')
    expect(normalizeRussianPhone('8 900 123 45 67')).toBe('+7 900 123-45-67')
    expect(normalizeRussianPhone('9001234567')).toBe('+7 900 123-45-67')
    expect(() => normalizeRussianPhone('900123')).toThrow('Invalid phone')
    expect(() => normalizeRussianPhone('тел. 9001234567')).toThrow('Invalid phone')
  })

  it('показывает дату с русским названием месяца', () => {
    expect(formatDisplayDate('2026-09-29')).toBe('29 сентября 2026')
    expect(formatCompactDate('2026-09-09')).toBe('09.09.2026')
  })

  it('берёт сегодняшний день из локального календаря устройства', () => {
    expect(localCalendarDate(new Date(2026, 7, 29, 23, 50))).toBe('2026-08-29')
  })

  it('определяет срочность относительно календарной даты', () => {
    expect(getMembershipStatus('2026-09-20', '2026-09-10').kind).toBe('active')
    expect(getMembershipStatus('2026-09-17', '2026-09-10').kind).toBe('due-soon')
    expect(getMembershipStatus('2026-09-09', '2026-09-10').kind).toBe('expired')
  })

  it('сортирует по сроку, а замороженных всегда ставит вниз', () => {
    const frozen = listClient('frozen', 'Заморожен', '2026-08-01', [{
      id: 'freeze', startsOn: '2026-09-01', plannedResumesOn: '2026-09-20', batchId: null,
      resumedOn: null, daysApplied: 19, createdAt: '2026-09-01T00:00:00.000Z', resumedAt: null,
    }])
    const clients = [
      listClient('active', 'Активный', '2026-10-10'), frozen,
      listClient('due', 'Срочный', '2026-09-12'), listClient('expired', 'Просроченный', '2026-09-01'),
    ]

    expect(sortClientsByUrgency(clients, '2026-09-10').map(({ id }) => id))
      .toEqual(['expired', 'due', 'active', 'frozen'])
    expect(getClientAttentionSummary(clients, '2026-09-10')).toEqual({ overdue: 1, dueSoon: 1, total: 2 })
  })

  it('совмещает поиск по любой части имени с фильтром', () => {
    const clients = [
      listClient('attention', 'Орлов Юрий', '2026-09-09'),
      listClient('active', 'Орлова Анна', '2026-10-10'),
      listClient('other', 'Петров Иван', '2026-09-08'),
    ]

    expect(selectClientsForList(clients, 'орл', 'attention', '2026-09-10').map(({ id }) => id))
      .toEqual(['attention'])
  })

  it('продлевает действующий абонемент и не дублирует повторную оплату', () => {
    const client = {
      id: 'client-1', name: 'Анна', phone: '+7 900 123-45-67',
      note: '',
      membershipEndsOn: '2026-09-29', archivedAt: null, createdAt: '2026-08-29T00:00:00.000Z',
      freezes: [],
      payments: [{
        id: 'payment-1', amountRubles: 3000, paidOn: '2026-08-29', durationMonths: 1,
        membershipEndsOn: '2026-09-29', createdAt: '2026-08-29T00:00:00.000Z',
      }],
    }
    const payment = { id: 'payment-2', amountRubles: 3500, paidOn: '2026-09-20', durationMonths: 1 }
    const renewed = renewClient(client, payment, '2026-09-20T00:00:00.000Z')
    expect(renewed.membershipEndsOn).toBe('2026-10-29')
    expect(renewed.payments).toHaveLength(2)
    expect(renewClient(renewed, payment, '2026-09-20T00:00:01.000Z')).toBe(renewed)
  })

  it('переносит срок на период заморозки и при досрочном завершении оставляет только использованные дни', () => {
    const client = {
      id: 'client-1', name: 'Анна', phone: '+7 900 123-45-67', note: '',
      membershipEndsOn: '2026-09-29', archivedAt: null, createdAt: '2026-08-29T00:00:00.000Z', freezes: [],
      payments: [{
        id: 'payment-1', amountRubles: 3000, paidOn: '2026-08-29', durationMonths: 1,
        membershipEndsOn: '2026-09-29', createdAt: '2026-08-29T00:00:00.000Z',
      }],
    }
    const frozen = freezeClient(client, {
      id: 'freeze-1', startsOn: '2026-09-01', plannedResumesOn: '2026-09-11',
    }, '2026-09-01T00:00:00.000Z')

    expect(frozen.membershipEndsOn).toBe('2026-10-09')
    expect(getClientMembershipStatus(frozen, '2026-09-05')).toEqual({ kind: 'frozen', label: 'Заморожен' })

    const resumed = resumeClient(frozen, 'freeze-1', '2026-09-04', '2026-09-04T00:00:00.000Z')
    expect(resumed.membershipEndsOn).toBe('2026-10-02')
    expect(resumed.freezes[0]).toMatchObject({ resumedOn: '2026-09-04', daysApplied: 3 })
    expect(resumeClient(resumed, 'freeze-1', '2026-09-04', '2026-09-04T00:00:01.000Z')).toBe(resumed)
  })

  it('добавляет общей заморозкой только непокрытые дни и согласованно завершает её досрочно', () => {
    const client = {
      id: 'client-1', name: 'Анна', phone: '+7 900 123-45-67', note: '',
      membershipEndsOn: '2026-09-29', archivedAt: null, createdAt: '2026-08-29T00:00:00.000Z', freezes: [],
      payments: [{
        id: 'payment-1', amountRubles: 3000, paidOn: '2026-08-29', durationMonths: 1,
        membershipEndsOn: '2026-09-29', createdAt: '2026-08-29T00:00:00.000Z',
      }],
    }
    const personal = freezeClient(client, {
      id: 'personal', startsOn: '2026-09-01', plannedResumesOn: '2026-09-11',
    }, '2026-09-01T00:00:00.000Z')
    const batch = freezeClient(personal, {
      id: 'batch-1:client-1', batchId: 'batch-1', startsOn: '2026-09-05', plannedResumesOn: '2026-09-15',
    }, '2026-09-02T00:00:00.000Z')

    expect(batch.membershipEndsOn).toBe('2026-10-13')
    expect(batch.freezes.find((freeze) => freeze.batchId === 'batch-1')?.daysApplied).toBe(4)
    expect(previewFreezeBatch([personal], {
      id: 'preview', startsOn: '2026-09-05', plannedResumesOn: '2026-09-15',
    })).toEqual({ affectedClients: 1, totalDaysApplied: 4 })

    const resumed = resumeClient(batch, 'batch-1:client-1', '2026-09-08', '2026-09-08T00:00:00.000Z')
    expect(resumed.membershipEndsOn).toBe('2026-10-09')
    expect(resumed.freezes.find((freeze) => freeze.batchId === 'batch-1')).toMatchObject({
      resumedOn: '2026-09-08', daysApplied: 0,
    })
  })

  it('сохраняет общую заморозку без продления, если период покрыт, и подхватывает дни при раннем завершении личной', () => {
    const client = {
      id: 'client-1', name: 'Анна', phone: '+7 900 123-45-67', note: '',
      membershipEndsOn: '2026-10-09', archivedAt: null, createdAt: '2026-08-29T00:00:00.000Z',
      payments: [{
        id: 'payment-1', amountRubles: 3000, paidOn: '2026-08-29', durationMonths: 1,
        membershipEndsOn: '2026-09-29', createdAt: '2026-08-29T00:00:00.000Z',
      }],
      freezes: [{
        id: 'personal', batchId: null, startsOn: '2026-09-01', plannedResumesOn: '2026-09-11',
        resumedOn: null, daysApplied: 10, createdAt: '2026-09-01T00:00:00.000Z', resumedAt: null,
      }],
    }
    const batch = freezeClient(client, {
      id: 'batch-1:client-1', batchId: 'batch-1', startsOn: '2026-09-03', plannedResumesOn: '2026-09-08',
    }, '2026-09-02T00:00:00.000Z')
    expect(batch.membershipEndsOn).toBe('2026-10-09')
    expect(batch.freezes.find((freeze) => freeze.batchId === 'batch-1')?.daysApplied).toBe(0)

    const resumedPersonal = resumeClient(batch, 'personal', '2026-09-04', '2026-09-04T00:00:00.000Z')
    expect(resumedPersonal.membershipEndsOn).toBe('2026-10-06')
    expect(resumedPersonal.freezes.find((freeze) => freeze.batchId === 'batch-1')?.daysApplied).toBe(4)
  })
})
