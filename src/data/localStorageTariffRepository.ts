import type { Tariff } from '../domain/tariff'
import { isTariff } from '../domain/tariff'
import { createMemoryTariffRepository } from './memoryTariffRepository'
import type { TariffRepository } from './tariffRepository'

const STORAGE_KEY = 'abon.tariffs.v1'

function readTariffs(): Tariff[] {
  const stored = window.localStorage.getItem(STORAGE_KEY)
  if (stored === null) return []
  const parsed: unknown = JSON.parse(stored)
  if (!Array.isArray(parsed) || !parsed.every(isTariff)
    || new Set(parsed.map((tariff) => tariff.id)).size !== parsed.length) {
    throw new Error('Invalid stored tariffs')
  }
  return parsed
}

function writeTariffs(tariffs: Tariff[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tariffs))
}

export const localStorageTariffRepository: TariffRepository = {
  async list() { return readTariffs() },
  async add(input) {
    const repository = createMemoryTariffRepository(readTariffs())
    const tariff = await repository.add(input)
    writeTariffs(await repository.list())
    return tariff
  },
  async update(tariffId, input) {
    const repository = createMemoryTariffRepository(readTariffs())
    const tariff = await repository.update(tariffId, input)
    writeTariffs(await repository.list())
    return tariff
  },
  async delete(tariffId) {
    const repository = createMemoryTariffRepository(readTariffs())
    await repository.delete(tariffId)
    writeTariffs(await repository.list())
  },
}
