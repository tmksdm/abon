import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import App from './App'
import type { Client } from './domain/client'
import type { ClientRepository } from './data/clientRepository'
import { addCalendarDays, localCalendarDate } from './domain/client'

const client: Client = {
  id: 'client-1',
  name: 'Анна',
  phone: '+7 900 123-45-67',
  note: '',
  membershipEndsOn: '2026-09-29',
  freezes: [],
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
    freeze: vi.fn().mockImplementation(async (_clientId, input) => ({
      ...client,
      membershipEndsOn: addCalendarDays(client.membershipEndsOn, 7),
      freezes: [{ ...input, batchId: null, resumedOn: null, daysApplied: 7, createdAt: new Date().toISOString(), resumedAt: null }],
    })),
    resume: vi.fn().mockResolvedValue(client),
    freezeBatch: vi.fn().mockResolvedValue([client]),
    resumeBatch: vi.fn().mockResolvedValue([client]),
    updateNote: vi.fn().mockImplementation(async (_clientId, note) => ({ ...client, note: note.trim() })),
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
    expect(await screen.findByRole('button', { name: /Анна/ }))
      .toHaveTextContent(/29\.08\.2026·3 000 ₽·до 29\.09\.2026·Месяц/)
  })

  it('открывает клиента и продлевает абонемент новой оплатой', async () => {
    const repository = createRepository()
    vi.mocked(repository.list).mockResolvedValue([client])
    render(<App repository={repository} />)

    fireEvent.click(await screen.findByRole('button', { name: /Анна/ }))
    expect(screen.getByRole('heading', { name: 'История операций' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Новая оплата' }))
    fireEvent.change(screen.getByLabelText('Сумма, ₽'), { target: { value: '3500' } })
    fireEvent.change(screen.getByLabelText('Дата оплаты'), { target: { value: '2026-09-20' } })
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить оплату' }))

    await waitFor(() => expect(repository.addPayment).toHaveBeenCalledTimes(1))
    expect(await screen.findByText('29 октября 2026')).toBeInTheDocument()
    expect(screen.getByText('3 500 ₽')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('замораживает абонемент, показывает отдельный статус и записывает операцию в историю', async () => {
    const repository = createRepository()
    vi.mocked(repository.list).mockResolvedValue([client])
    render(<App repository={repository} />)

    fireEvent.click(await screen.findByRole('button', { name: /Анна/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Заморозить' }))
    const resumesOn = addCalendarDays(localCalendarDate(), 7)
    fireEvent.change(screen.getByLabelText('Возобновить с'), { target: { value: resumesOn } })
    fireEvent.click(screen.getByRole('button', { name: 'Заморозить' }))

    await waitFor(() => expect(repository.freeze).toHaveBeenCalledWith('client-1', expect.objectContaining({
      startsOn: localCalendarDate(), plannedResumesOn: resumesOn,
    })))
    expect(await screen.findByText('Заморожен', { selector: '.status-badge' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Разморозить сегодня' })).toBeInTheDocument()
    expect(screen.getByText('+7 дн. к сроку')).toBeInTheDocument()
  })

  it('показывает предварительный расчёт и сохраняет общую заморозку одной операцией', async () => {
    const repository = createRepository()
    const secondClient = { ...client, id: 'client-2', name: 'Ирина', phone: '+7 900 765-43-21' }
    vi.mocked(repository.list).mockResolvedValue([client, secondClient])
    vi.mocked(repository.freezeBatch).mockImplementation(async (input) => [client, secondClient].map((item) => ({
      ...item,
      membershipEndsOn: addCalendarDays(item.membershipEndsOn, 7),
      freezes: [{
        id: `${input.id}:${item.id}`, batchId: input.id, startsOn: input.startsOn,
        plannedResumesOn: input.plannedResumesOn, resumedOn: null, daysApplied: 7,
        createdAt: new Date().toISOString(), resumedAt: null,
      }],
    })))
    render(<App repository={repository} />)

    fireEvent.click(await screen.findByRole('button', { name: 'Настройки' }))
    fireEvent.click(screen.getByRole('button', { name: 'Настроить' }))
    expect(screen.getByText('Будут затронуты: 2')).toBeInTheDocument()
    expect(screen.getByText('Всего будет добавлено 14 клиент-дн.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Применить общую заморозку' }))

    await waitFor(() => expect(repository.freezeBatch).toHaveBeenCalledWith(expect.objectContaining({
      startsOn: localCalendarDate(), plannedResumesOn: addCalendarDays(localCalendarDate(), 7),
    })))
    expect(await screen.findByText('Затронуто клиентов: 2. Добавлено 14 клиент-дн.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Завершить сегодня' })).toBeInTheDocument()
  })

  it('сразу показывает срочных сверху в компактных карточках и фильтрует список', async () => {
    const repository = createRepository()
    const today = localCalendarDate()
    const expired = { ...client, id: 'expired', name: 'Орлов Юрий', membershipEndsOn: addCalendarDays(today, -10),
      payments: [{ ...client.payments[0], id: 'pay-expired', paidOn: addCalendarDays(today, -40), amountRubles: 3000 }] }
    const due = { ...client, id: 'due', name: 'Белова Дарья', membershipEndsOn: addCalendarDays(today, 2),
      payments: [{ ...client.payments[0], id: 'pay-due', paidOn: addCalendarDays(today, -28), amountRubles: 3500 }] }
    const active = { ...client, id: 'active', name: 'Соколов Егор', membershipEndsOn: addCalendarDays(today, 30) }
    const frozen = { ...client, id: 'frozen', name: 'Воронова Майя', membershipEndsOn: addCalendarDays(today, -30),
      freezes: [{ id: 'freeze', startsOn: addCalendarDays(today, -1), plannedResumesOn: addCalendarDays(today, 5),
        batchId: null, resumedOn: null, daysApplied: 6, createdAt: new Date().toISOString(), resumedAt: null }] }
    vi.mocked(repository.list).mockResolvedValue([active, frozen, due, expired])
    render(<App repository={repository} />)

    const list = await screen.findByRole('list', { name: 'Список клиентов' })
    expect(within(list).getAllByRole('button').map((button) => button.textContent)).toEqual([
      expect.stringContaining('Орлов Юрий'), expect.stringContaining('Белова Дарья'),
      expect.stringContaining('Соколов Егор'), expect.stringContaining('Воронова Майя'),
    ])
    expect(screen.getByRole('button', { name: /2 клиента требуют продления/ })).toBeInTheDocument()
    expect(screen.queryByText('+7 900 123-45-67')).not.toBeInTheDocument()
    expect(within(list).getAllByRole('button')[0]).toHaveTextContent('Месяц')

    fireEvent.change(screen.getByPlaceholderText('Поиск по имени'), { target: { value: 'орл' } })
    expect(within(list).getAllByRole('button')).toHaveLength(1)
    expect(within(list).getByRole('button', { name: /Орлов Юрий/ })).toBeInTheDocument()
    fireEvent.change(screen.getByRole('combobox', { name: 'Фильтр клиентов' }), { target: { value: 'active' } })
    expect(screen.getByRole('heading', { name: 'Никого не нашли' })).toBeInTheDocument()
  })

  it('сохраняет заметку в карточке и показывает её одной строкой в списке', async () => {
    const repository = createRepository()
    vi.mocked(repository.list).mockResolvedValue([client])
    render(<App repository={repository} />)

    fireEvent.click(await screen.findByRole('button', { name: /Анна/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Добавить' }))
    fireEvent.change(screen.getByLabelText('Текст заметки'), { target: { value: '  Предпочитает вечерние тренировки\nПозвонить заранее.  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить заметку' }))

    await waitFor(() => expect(repository.updateNote).toHaveBeenCalledWith(
      'client-1', '  Предпочитает вечерние тренировки\nПозвонить заранее.  ',
    ))
    expect(await screen.findByText(/Предпочитает вечерние тренировки/)).toHaveTextContent('Предпочитает вечерние тренировки Позвонить заранее.')
    fireEvent.click(screen.getByRole('button', { name: 'Abon, список клиентов' }))
    await waitFor(() => expect(screen.getByText(/Предпочитает вечерние тренировки/)).toHaveClass('client-note-preview'))
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
    expect(screen.getByLabelText('Текущая версия')).toHaveTextContent('260830.2')
    expect(screen.getByRole('heading', { name: 'История версий' })).toBeInTheDocument()
    expect(screen.getByText('Добавлены история версий в настройках и полный формат дат.')).toBeInTheDocument()
  })

  it('изолирует demo-изменения и явно очищает их при выходе', async () => {
    const repository = createRepository()
    vi.mocked(repository.list).mockResolvedValue([client])
    render(<App repository={repository} />)

    fireEvent.click(await screen.findByRole('button', { name: 'Настройки' }))
    fireEvent.click(screen.getByRole('button', { name: 'Включить demo-режим' }))

    expect(await screen.findByText('Demo')).toBeInTheDocument()
    expect(screen.getByText('28')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Алёна Соколова/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Изменить' }))
    fireEvent.change(screen.getByLabelText('Текст заметки'), { target: { value: 'Только demo' } })
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить заметку' }))

    await screen.findByText('Только demo')
    expect(repository.updateNote).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Abon, список клиентов' }))
    fireEvent.click(screen.getByRole('button', { name: 'Настройки' }))
    fireEvent.click(screen.getByRole('button', { name: 'Выйти и очистить demo-данные' }))

    expect(await screen.findByRole('button', { name: /Анна/ })).toBeInTheDocument()
    expect(screen.queryByText('Только demo')).not.toBeInTheDocument()
    expect(repository.list).toHaveBeenCalledTimes(2)
  })

  it('возвращается из настроек по системной истории браузера', async () => {
    render(<App repository={createRepository()} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Настройки' }))
    expect(screen.getByRole('heading', { name: 'Настройки' })).toBeInTheDocument()

    fireEvent(window, new PopStateEvent('popstate', {
      state: { abonView: { screen: 'clients' } },
    }))

    expect(screen.getByRole('heading', { name: 'Клиенты' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Настройки' })).not.toBeInTheDocument()
  })
})
