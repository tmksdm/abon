export type Tariff = {
  id: string
  name: string
  amountRubles: number
  durationMonths: number
  createdAt: string
  updatedAt: string
}

export type NewTariff = Pick<Tariff, 'name' | 'amountRubles' | 'durationMonths'>

export function normalizeTariff(input: NewTariff): NewTariff {
  const name = input.name.trim()
  if (!name
    || !Number.isSafeInteger(input.amountRubles)
    || input.amountRubles <= 0
    || !Number.isInteger(input.durationMonths)
    || input.durationMonths < 1) {
    throw new Error('Invalid tariff')
  }
  return { ...input, name }
}

export function isTariff(value: unknown): value is Tariff {
  if (!value || typeof value !== 'object') return false
  const tariff = value as Record<string, unknown>
  try {
    normalizeTariff({
      name: typeof tariff.name === 'string' ? tariff.name : '',
      amountRubles: typeof tariff.amountRubles === 'number' ? tariff.amountRubles : Number.NaN,
      durationMonths: typeof tariff.durationMonths === 'number' ? tariff.durationMonths : Number.NaN,
    })
    return typeof tariff.id === 'string'
      && tariff.id.length > 0
      && typeof tariff.createdAt === 'string'
      && Number.isFinite(Date.parse(tariff.createdAt))
      && typeof tariff.updatedAt === 'string'
      && Number.isFinite(Date.parse(tariff.updatedAt))
  } catch {
    return false
  }
}
