import { describe, expect, it } from 'vitest'
import {
  addCalendarMonths, formatDisplayDate, getMembershipStatus, localCalendarDate,
  normalizeRussianPhone, parseWholeRubles, renewClient,
} from './client'

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
  })

  it('берёт сегодняшний день из локального календаря устройства', () => {
    expect(localCalendarDate(new Date(2026, 7, 29, 23, 50))).toBe('2026-08-29')
  })

  it('определяет срочность относительно календарной даты', () => {
    expect(getMembershipStatus('2026-09-20', '2026-09-10').kind).toBe('active')
    expect(getMembershipStatus('2026-09-17', '2026-09-10').kind).toBe('due-soon')
    expect(getMembershipStatus('2026-09-09', '2026-09-10').kind).toBe('expired')
  })

  it('продлевает действующий абонемент и не дублирует повторную оплату', () => {
    const client = {
      id: 'client-1', name: 'Анна', phone: '+7 900 123-45-67',
      note: '',
      membershipEndsOn: '2026-09-29', createdAt: '2026-08-29T00:00:00.000Z',
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
})
