export type NewClient = {
  name: string
  phone: string
  amountRubles: number
  paidOn: string
  durationMonths: number
}

export type NewPayment = {
  id: string
  amountRubles: number
  paidOn: string
  durationMonths: number
}

export type Payment = NewPayment & {
  membershipEndsOn: string
  createdAt: string
}

export type NewMembershipFreeze = {
  id: string
  startsOn: string
  plannedResumesOn: string
  batchId?: string | null
}

export type MembershipFreeze = NewMembershipFreeze & {
  resumedOn: string | null
  daysApplied: number
  createdAt: string
  resumedAt: string | null
}

export type Client = {
  id: string
  name: string
  phone: string
  note: string
  membershipEndsOn: string
  payments: Payment[]
  freezes: MembershipFreeze[]
  createdAt: string
}

export type MembershipStatus = {
  kind: 'active' | 'due-soon' | 'expired' | 'frozen'
  label: string
}

const CALENDAR_DATE = /^(\d{4})-(\d{2})-(\d{2})$/
const MONTH_NAMES = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
]

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

export function addCalendarDays(date: string, days: number) {
  if (!Number.isInteger(days)) throw new Error('Invalid duration')
  const parsed = parseCalendarDate(date)
  return new Date(parsed.time + days * 86_400_000).toISOString().slice(0, 10)
}

export function calendarDaysBetween(startsOn: string, resumesOn: string) {
  const days = (parseCalendarDate(resumesOn).time - parseCalendarDate(startsOn).time) / 86_400_000
  if (!Number.isInteger(days) || days < 0) throw new Error('Invalid date range')
  return days
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

export function formatDisplayDate(value: string) {
  const { year, month, day } = parseCalendarDate(value)
  return `${day} ${MONTH_NAMES[month - 1]} ${year}`
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

export function getActiveFreeze(client: Client, today = localCalendarDate()) {
  return client.freezes.find((freeze) => {
    const resumesOn = freeze.resumedOn ?? freeze.plannedResumesOn
    return freeze.startsOn <= today && today < resumesOn
  }) ?? null
}

export function getClientMembershipStatus(client: Client, today = localCalendarDate()): MembershipStatus {
  if (getActiveFreeze(client, today)) return { kind: 'frozen', label: 'Заморожен' }
  return getMembershipStatus(client.membershipEndsOn, today)
}

export function renewClient(client: Client, input: NewPayment, createdAt: string): Client {
  if (!input.id
    || !Number.isSafeInteger(input.amountRubles)
    || input.amountRubles <= 0
    || !Number.isInteger(input.durationMonths)
    || input.durationMonths < 1
    || !isCalendarDate(input.paidOn)
    || !Number.isFinite(Date.parse(createdAt))) {
    throw new Error('Invalid payment')
  }

  if (client.payments.some((payment) => payment.id === input.id)) return client

  const membershipStartsOn = input.paidOn > client.membershipEndsOn
    ? input.paidOn
    : client.membershipEndsOn
  const membershipEndsOn = addCalendarMonths(membershipStartsOn, input.durationMonths)
  const payment: Payment = { ...input, membershipEndsOn, createdAt }

  return {
    ...client,
    membershipEndsOn,
    payments: [payment, ...client.payments],
  }
}

export function freezeClient(client: Client, input: NewMembershipFreeze, createdAt: string): Client {
  if (!input.id || !isCalendarDate(input.startsOn) || !isCalendarDate(input.plannedResumesOn)
    || !Number.isFinite(Date.parse(createdAt))) {
    throw new Error('Invalid freeze')
  }
  if (client.freezes.some((freeze) => freeze.id === input.id)) return client

  const daysApplied = calendarDaysBetween(input.startsOn, input.plannedResumesOn)
  if (daysApplied < 1 || getMembershipStatus(client.membershipEndsOn, input.startsOn).kind === 'expired') {
    throw new Error('Invalid freeze')
  }

  const overlapsExisting = client.freezes.some((freeze) => {
    const existingResumesOn = freeze.resumedOn ?? freeze.plannedResumesOn
    return input.startsOn < existingResumesOn && freeze.startsOn < input.plannedResumesOn
  })
  if (overlapsExisting) throw new Error('Overlapping freeze')

  return {
    ...client,
    membershipEndsOn: addCalendarDays(client.membershipEndsOn, daysApplied),
    freezes: [{ ...input, batchId: input.batchId ?? null, resumedOn: null, daysApplied, createdAt, resumedAt: null }, ...client.freezes],
  }
}

export function resumeClient(client: Client, freezeId: string, resumedOn: string, resumedAt: string): Client {
  if (!freezeId || !isCalendarDate(resumedOn) || !Number.isFinite(Date.parse(resumedAt))) {
    throw new Error('Invalid resume')
  }

  const freezeIndex = client.freezes.findIndex((freeze) => freeze.id === freezeId)
  if (freezeIndex < 0) throw new Error('Freeze not found')
  const freeze = client.freezes[freezeIndex]
  if (freeze.resumedOn !== null) return client
  if (resumedOn < freeze.startsOn || resumedOn > freeze.plannedResumesOn) throw new Error('Invalid resume')

  const actualDays = calendarDaysBetween(freeze.startsOn, resumedOn)
  const unusedDays = freeze.daysApplied - actualDays
  const freezes = [...client.freezes]
  freezes[freezeIndex] = { ...freeze, resumedOn, daysApplied: actualDays, resumedAt }

  return {
    ...client,
    membershipEndsOn: addCalendarDays(client.membershipEndsOn, -unusedDays),
    freezes,
  }
}
