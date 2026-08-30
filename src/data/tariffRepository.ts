import type { NewTariff, Tariff } from '../domain/tariff'

export interface TariffRepository {
  list(): Promise<Tariff[]>
  add(input: NewTariff): Promise<Tariff>
  update(tariffId: string, input: NewTariff): Promise<Tariff>
  delete(tariffId: string): Promise<void>
}
