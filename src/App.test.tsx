import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import App from './App'
import type { Client } from './domain/client'
import type { ClientRepository } from './data/clientRepository'

const client: Client = {
  id: 'client-1',
  name: 'Анна',
  phone: '+7 900 123-45-67',
  membershipEndsOn: '2026-09-29',
  payments: [{
    id: 'payment-1', amountRubles: 3000, paidOn: '2026-08-29', durationMonths: 1,
    membershipEndsOn: '2026-09-29', createdAt: '2026-08-29T00:00:00.000Z',
  }],
  createdAt: '2026-08-29T00:00:00.000Z',
}

function createRepository(): ClientRepository {
  return {
    list: vi.fn().mockResolvedValue([]),
    add: vi.fn().mockResolvedValue(client),
    addPayment: vi.fn().mockImplementation(async (_clientId, input) => ({
      ...client,
      membershipEndsOn: '2026-10-29',
      payments: [{ ...input, membershipEndsOn: '2026-10-29', createdAt: '2026-09-20T00:00:00.000Z' }, ...client.payments],
    })),
  }
}

describe('App', () => {
  it('объясняет пустое состояние', async () => {
    render(<App repository={createRepository()} />)
    expect(await screen.findByRole('heading', { name: 'Пока нет клиентов' })).toBeInTheDocument()
    expect(screen.getByText(/Добавьте первого клиента и оплату/i)).toBeInTheDocument()
  })

  it('добавляет клиента с первой оплатой в целых рублях', async () => {
    const repository = createRepository()
    render(<App repository={repository} />)

    fireEvent.click(await screen.findByRole('button', { name: 'Добавить клиента' }))
    fireEvent.change(screen.getByLabelText('Имя'), { target: { value: 'Анна' } })
    fireEvent.change(screen.getByLabelText('Телефон'), { target: { value: '9001234567' } })
    fireEvent.change(screen.getByLabelText('Сумма, ₽'), { target: { value: '3000' } })
    fireEvent.change(screen.getByLabelText('Дата оплаты'), { target: { value: '2026-08-29' } })
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить клиента' }))

    await waitFor(() => expect(repository.add).toHaveBeenCalledWith({
      name: 'Анна', phone: '+7 900 123-45-67', amountRubles: 3000,
      paidOn: '2026-08-29', durationMonths: 1,
    }))
    expect(await screen.findByText('3 000 ₽')).toBeInTheDocument()
    expect(screen.getByText('29 сентября 2026')).toBeInTheDocument()
  })

  it('открывает клиента и продлевает абонемент новой оплатой', async () => {
    const repository = createRepository()
    vi.mocked(repository.list).mockResolvedValue([client])
    render(<App repository={repository} />)

    fireEvent.click(await screen.findByRole('button', { name: /Анна/ }))
    expect(screen.getByRole('heading', { name: 'История оплат' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Новая оплата' }))
    fireEvent.change(screen.getByLabelText('Сумма, ₽'), { target: { value: '3500' } })
    fireEvent.change(screen.getByLabelText('Дата оплаты'), { target: { value: '2026-09-20' } })
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить оплату' }))

    await waitFor(() => expect(repository.addPayment).toHaveBeenCalledTimes(1))
    expect(await screen.findByText('29 октября 2026')).toBeInTheDocument()
    expect(screen.getByText('3 500 ₽')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('не раскрывает данные при ошибке чтения', async () => {
    const repository = createRepository()
    vi.mocked(repository.list).mockRejectedValue(new Error('Storage error'))
    render(<App repository={repository} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Данные недоступны')
    expect(screen.queryByRole('list', { name: 'Список клиентов' })).not.toBeInTheDocument()
  })

  it('показывает текущую версию и краткую историю в настройках', async () => {
    render(<App repository={createRepository()} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Настройки' }))

    expect(screen.getByRole('heading', { name: 'Настройки' })).toBeInTheDocument()
    expect(screen.getByLabelText('Текущая версия')).toHaveTextContent('260829.6')
    expect(screen.getByRole('heading', { name: 'История версий' })).toBeInTheDocument()
    expect(screen.getByText('Добавлены история версий в настройках и полный формат дат.')).toBeInTheDocument()
  })
})
