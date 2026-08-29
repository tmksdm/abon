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

export type NewMembershipFreezeBatch = {
  id: string
  startsOn: string
  plannedResumesOn: string
}

export type MembershipFreezeBatchPreview = {
  affectedClients: number
  totalDaysApplied: number
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

export type ClientListFilter = 'all' | 'attention' | 'active' | 'frozen'

export type ClientAttentionSummary = {
  overdue: number
  dueSoon: number
  total: number
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

export function formatCompactDate(value: string) {
  const { year, month, day } = parseCalendarDate(value)
  return `${String(day).padStart(2, '0')}.${String(month).padStart(2, '0')}.${year}`
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

export function getMembershipDaysLeft(membershipEndsOn: string, today = localCalendarDate()) {
  return Math.round(
    (parseCalendarDate(membershipEndsOn).time - parseCalendarDate(today).time) / 86_400_000,
  )
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

export function sortClientsByUrgency(clients: Client[], today = localCalendarDate()) {
  return [...clients].sort((left, right) => {
    const leftFrozen = getActiveFreeze(left, today) !== null
    const rightFrozen = getActiveFreeze(right, today) !== null
    if (leftFrozen !== rightFrozen) return leftFrozen ? 1 : -1
    if (left.membershipEndsOn !== right.membershipEndsOn) {
      return left.membershipEndsOn.localeCompare(right.membershipEndsOn)
    }
    return left.name.localeCompare(right.name, 'ru')
  })
}

export function getClientAttentionSummary(clients: Client[], today = localCalendarDate()): ClientAttentionSummary {
  let overdue = 0
  let dueSoon = 0
  for (const client of clients) {
    const status = getClientMembershipStatus(client, today)
    if (status.kind === 'expired') overdue += 1
    if (status.kind === 'due-soon') dueSoon += 1
  }
  return { overdue, dueSoon, total: overdue + dueSoon }
}

export function selectClientsForList(
  clients: Client[], query: string, filter: ClientListFilter, today = localCalendarDate(),
) {
  const normalizedQuery = query.trim().toLocaleLowerCase('ru-RU')
  return sortClientsByUrgency(clients, today).filter((client) => {
    const matchesQuery = normalizedQuery === ''
      || client.name.toLocaleLowerCase('ru-RU').includes(normalizedQuery)
    if (!matchesQuery) return false
    const status = getClientMembershipStatus(client, today)
    if (filter === 'attention') return status.kind === 'expired' || status.kind === 'due-soon'
    if (filter === 'active') return status.kind === 'active'
    if (filter === 'frozen') return status.kind === 'frozen'
    return true
  })
}

function freezeResumesOn(freeze: MembershipFreeze) {
  return freeze.resumedOn ?? freeze.plannedResumesOn
}

export function countCoveredFreezeDays(freezes: MembershipFreeze[]) {
  const intervals = freezes
    .map((freeze) => ({ startsOn: freeze.startsOn, resumesOn: freezeResumesOn(freeze) }))
    .filter((interval) => interval.startsOn < interval.resumesOn)
    .sort((left, right) => left.startsOn.localeCompare(right.startsOn) || left.resumesOn.localeCompare(right.resumesOn))

  let total = 0
  let currentStart: string | null = null
  let currentEnd: string | null = null
  for (const interval of intervals) {
    if (currentStart === null || currentEnd === null) {
      currentStart = interval.startsOn
      currentEnd = interval.resumesOn
    } else if (interval.startsOn > currentEnd) {
      total += calendarDaysBetween(currentStart, currentEnd)
      currentStart = interval.startsOn
      currentEnd = interval.resumesOn
    } else if (interval.resumesOn > currentEnd) {
      currentEnd = interval.resumesOn
    }
  }
  return currentStart === null || currentEnd === null
    ? total
    : total + calendarDaysBetween(currentStart, currentEnd)
}

function distributeFreezeDays(freezes: MembershipFreeze[]) {
  const covered: MembershipFreeze[] = []
  const daysById = new Map<string, number>()
  const ordered = freezes.map((freeze, index) => ({ freeze, index })).sort((left, right) =>
    left.freeze.createdAt.localeCompare(right.freeze.createdAt) || right.index - left.index)

  for (const { freeze } of ordered) {
    const before = countCoveredFreezeDays(covered)
    covered.push(freeze)
    daysById.set(freeze.id, countCoveredFreezeDays(covered) - before)
  }

  return freezes.map((freeze) => ({ ...freeze, daysApplied: daysById.get(freeze.id) ?? 0 }))
}

function validateNewFreeze(input: NewMembershipFreeze, createdAt: string) {
  if (!input.id || !isCalendarDate(input.startsOn) || !isCalendarDate(input.plannedResumesOn)
    || !Number.isFinite(Date.parse(createdAt))
    || (input.batchId !== undefined && input.batchId !== null && !input.batchId)) {
    throw new Error('Invalid freeze')
  }
  if (calendarDaysBetween(input.startsOn, input.plannedResumesOn) < 1) throw new Error('Invalid freeze')
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
  validateNewFreeze(input, createdAt)
  if (client.freezes.some((freeze) => freeze.id === input.id)) return client

  if (getMembershipStatus(client.membershipEndsOn, input.startsOn).kind === 'expired') {
    throw new Error('Invalid freeze')
  }

  const overlapsExisting = client.freezes.some((freeze) => {
    const existingResumesOn = freezeResumesOn(freeze)
    return input.startsOn < existingResumesOn && freeze.startsOn < input.plannedResumesOn
  })
  if (overlapsExisting && !input.batchId) throw new Error('Overlapping freeze')

  const coveredBefore = countCoveredFreezeDays(client.freezes)
  const freezes = distributeFreezeDays([
    { ...input, batchId: input.batchId ?? null, resumedOn: null, daysApplied: 0, createdAt, resumedAt: null },
    ...client.freezes,
  ])
  const addedDays = countCoveredFreezeDays(freezes) - coveredBefore

  return {
    ...client,
    membershipEndsOn: addCalendarDays(client.membershipEndsOn, addedDays),
    freezes,
  }
}

export function previewFreezeBatch(clients: Client[], input: NewMembershipFreezeBatch): MembershipFreezeBatchPreview {
  validateNewFreeze({ ...input, batchId: input.id }, new Date(0).toISOString())
  let affectedClients = 0
  let totalDaysApplied = 0

  for (const client of clients) {
    try {
      const coveredBefore = countCoveredFreezeDays(client.freezes)
      const candidate: MembershipFreeze = {
        ...input, batchId: input.id, resumedOn: null, daysApplied: 0,
        createdAt: new Date(0).toISOString(), resumedAt: null,
      }
      const addedDays = countCoveredFreezeDays([...client.freezes, candidate]) - coveredBefore
      if (getMembershipStatus(client.membershipEndsOn, input.startsOn).kind !== 'expired') {
        affectedClients += 1
        totalDaysApplied += addedDays
      }
    } catch {
      continue
    }
  }
  return { affectedClients, totalDaysApplied }
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

  const coveredBefore = countCoveredFreezeDays(client.freezes)
  const freezes = [...client.freezes]
  freezes[freezeIndex] = { ...freeze, resumedOn, resumedAt }
  const distributedFreezes = distributeFreezeDays(freezes)
  const coveredAfter = countCoveredFreezeDays(distributedFreezes)

  return {
    ...client,
    membershipEndsOn: addCalendarDays(client.membershipEndsOn, coveredAfter - coveredBefore),
    freezes: distributedFreezes,
  }
}
