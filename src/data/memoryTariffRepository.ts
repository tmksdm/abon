import type { NewTariff, Tariff } from '../domain/tariff'
import { normalizeTariff } from '../domain/tariff'
import type { TariffRepository } from './tariffRepository'

function ensureUniqueName(tariffs: Tariff[], input: NewTariff, excludedId?: string) {
  const normalizedName = input.name.toLocaleLowerCase('ru-RU')
  if (tariffs.some((tariff) => tariff.id !== excludedId
    && tariff.name.toLocaleLowerCase('ru-RU') === normalizedName)) {
    throw new Error('Tariff name already exists')
  }
}

export function createMemoryTariffRepository(initialTariffs: Tariff[] = []): TariffRepository {
  let tariffs = initialTariffs.map((tariff) => ({ ...tariff }))
  return {
    async list() { return tariffs.map((tariff) => ({ ...tariff })) },
    async replaceAll(replacement) { tariffs = replacement.map((tariff) => ({ ...tariff })) },
    async add(input) {
      const normalized = normalizeTariff(input)
      ensureUniqueName(tariffs, normalized)
      const now = new Date().toISOString()
      const tariff = { ...normalized, id: crypto.randomUUID(), createdAt: now, updatedAt: now }
      tariffs = [...tariffs, tariff]
      return { ...tariff }
    },
    async update(tariffId, input) {
      const index = tariffs.findIndex((tariff) => tariff.id === tariffId)
      if (index < 0) throw new Error('Tariff not found')
      const normalized = normalizeTariff(input)
      ensureUniqueName(tariffs, normalized, tariffId)
      const updated = { ...tariffs[index], ...normalized, updatedAt: new Date().toISOString() }
      tariffs = tariffs.map((tariff) => tariff.id === tariffId ? updated : tariff)
      return { ...updated }
    },
    async delete(tariffId) {
      if (!tariffs.some((tariff) => tariff.id === tariffId)) throw new Error('Tariff not found')
      tariffs = tariffs.filter((tariff) => tariff.id !== tariffId)
    },
  }
}
