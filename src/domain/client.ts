export type NewClient = {
  name: string
  phone: string
  amountRubles: number
  paidOn: string
  durationMonths: number
}

export type Client = {
  id: string
  name: string
  phone: string
  membershipEndsOn: string
  firstPayment: {
    amountRubles: number
    paidOn: string
    durationMonths: number
  }
  createdAt: string
}

export type MembershipStatus = {
  kind: 'active' | 'due-soon' | 'expired'
  label: string
}

const CALENDAR_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

function parseCalendarDate(value: string) {
  const match = CALENDAR_DATE.exec(value)
  if (!match) throw new Error('Invalid calendar date')

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))

  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new Error('Invalid calendar date')
  }

  return { year, month, day, time: date.getTime() }
}

export function addCalendarMonths(date: string, months: number) {
  if (!Number.isInteger(months) || months < 1) throw new Error('Invalid duration')

  const parsed = parseCalendarDate(date)
  const targetMonthIndex = parsed.month - 1 + months
  const targetYear = parsed.year + Math.floor(targetMonthIndex / 12)
  const targetMonth = ((targetMonthIndex % 12) + 12) % 12
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate()

  return new Date(Date.UTC(targetYear, targetMonth, Math.min(parsed.day, lastDay)))
    .toISOString()
    .slice(0, 10)
}

export function parseWholeRubles(value: string) {
  const normalized = value.trim()
  if (!/^\d+$/.test(normalized)) throw new Error('Invalid amount')

  const amount = Number(normalized)
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error('Invalid amount')
  return amount
}

export function normalizeRussianPhone(value: string) {
  const trimmed = value.trim()
  if (!/^\+?[\d\s()-]+$/.test(trimmed)) throw new Error('Invalid phone')

  const hasLeadingPlus = trimmed.startsWith('+')
  const digits = trimmed.replace(/\D/g, '')
  let nationalNumber: string

  if (digits.length === 10) {
    nationalNumber = digits
  } else if (digits.length === 11 && (digits.startsWith('7') || digits.startsWith('8'))) {
    nationalNumber = digits.slice(1)
  } else {
    throw new Error('Invalid phone')
  }

  if (hasLeadingPlus && !digits.startsWith('7')) throw new Error('Invalid phone')

  return `+7 ${nationalNumber.slice(0, 3)} ${nationalNumber.slice(3, 6)}-${nationalNumber.slice(6, 8)}-${nationalNumber.slice(8)}`
}

export function isCalendarDate(value: string) {
  try {
    parseCalendarDate(value)
    return true
  } catch {
    return false
  }
}

export function formatShortDate(value: string) {
  const { year, month, day } = parseCalendarDate(value)
  return `${String(year).slice(-2)}.${String(month).padStart(2, '0')}.${String(day).padStart(2, '0')}`
}

export function localCalendarDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function getMembershipStatus(
  membershipEndsOn: string,
  today = localCalendarDate(),
): MembershipStatus {
  const daysLeft = Math.round(
    (parseCalendarDate(membershipEndsOn).time - parseCalendarDate(today).time) / 86_400_000,
  )

  if (daysLeft < 0) return { kind: 'expired', label: 'Просрочен' }
  if (daysLeft <= 7) {
    return { kind: 'due-soon', label: daysLeft === 0 ? 'Сегодня' : `Осталось ${daysLeft} дн.` }
  }
  return { kind: 'active', label: 'Активен' }
}
