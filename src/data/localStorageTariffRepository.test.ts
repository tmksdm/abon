import { beforeEach, describe, expect, it, vi } from 'vitest'
import { localStorageTariffRepository } from './localStorageTariffRepository'

describe('localStorageTariffRepository', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.stubGlobal('crypto', { randomUUID: () => 'tariff-1' })
  })

  it('создаёт, изменяет и удаляет тариф между запусками', async () => {
    await localStorageTariffRepository.add({ name: ' Стандарт ', amountRubles: 3000, durationMonths: 1 })
    await expect(localStorageTariffRepository.list()).resolves.toMatchObject([
      { id: 'tariff-1', name: 'Стандарт', amountRubles: 3000, durationMonths: 1 },
    ])

    await localStorageTariffRepository.update('tariff-1', {
      name: 'Стандарт плюс', amountRubles: 3500, durationMonths: 2,
    })
    await expect(localStorageTariffRepository.list()).resolves.toMatchObject([
      { id: 'tariff-1', name: 'Стандарт плюс', amountRubles: 3500, durationMonths: 2 },
    ])

    await localStorageTariffRepository.delete('tariff-1')
    await expect(localStorageTariffRepository.list()).resolves.toEqual([])
  })

  it('отклоняет повреждённый список тарифов', async () => {
    window.localStorage.setItem('abon.tariffs.v1', JSON.stringify([{ id: 'broken', amountRubles: -1 }]))
    await expect(localStorageTariffRepository.list()).rejects.toThrow('Invalid stored tariffs')
  })

  it('не изменяет сохранённых клиентов при редактировании шаблона', async () => {
    const storedClients = '[{"id":"client-1","payments":[{"amountRubles":3000,"durationMonths":1}]}]'
    window.localStorage.setItem('abon.clients.v5', storedClients)
    await localStorageTariffRepository.add({ name: 'Стандарт', amountRubles: 3000, durationMonths: 1 })
    await localStorageTariffRepository.update('tariff-1', { name: 'Новый стандарт', amountRubles: 4000, durationMonths: 2 })
    await localStorageTariffRepository.delete('tariff-1')

    expect(window.localStorage.getItem('abon.clients.v5')).toBe(storedClients)
  })
})
