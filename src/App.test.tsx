import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import App from './App'
import type { ClientRepository } from './data/clientRepository'

function createRepository(): ClientRepository {
  return {
    list: vi.fn().mockResolvedValue([]),
    add: vi.fn().mockImplementation(async (input) => ({
      id: 'client-1',
      name: input.name,
      phone: input.phone,
      membershipEndsOn: '2026-09-29',
      firstPayment: {
        amountRubles: input.amountRubles,
        paidOn: input.paidOn,
        durationMonths: input.durationMonths,
      },
      createdAt: '2026-08-29T00:00:00.000Z',
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
      name: 'Анна',
      phone: '+7 900 123-45-67',
      amountRubles: 3000,
      paidOn: '2026-08-29',
      durationMonths: 1,
    }))
    expect(await screen.findByRole('heading', { name: 'Анна' })).toBeInTheDocument()
    expect(screen.getByText('3 000 ₽')).toBeInTheDocument()
    expect(screen.getByText('26.09.29')).toBeInTheDocument()
  })

  it('не раскрывает данные при ошибке чтения', async () => {
    const repository = createRepository()
    vi.mocked(repository.list).mockRejectedValue(new Error('Storage error'))
    render(<App repository={repository} />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Данные недоступны')
    expect(screen.queryByRole('list', { name: 'Список клиентов' })).not.toBeInTheDocument()
  })
})
