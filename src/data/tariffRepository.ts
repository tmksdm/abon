import type { NewTariff, Tariff } from '../domain/tariff'

export interface TariffRepository {
  subscribe?(listener: () => void): () => void
  list(): Promise<Tariff[]>
  replaceAll(tariffs: Tariff[]): Promise<void>
  add(input: NewTariff): Promise<Tariff>
  update(tariffId: string, input: NewTariff): Promise<Tariff>
  delete(tariffId: string): Promise<void>
}
