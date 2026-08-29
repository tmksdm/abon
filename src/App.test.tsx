import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('App', () => {
  it('показывает название и назначение приложения', () => {
    render(<App />)

    expect(screen.getByText('Abon')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Платежи и сроки/i })).toBeInTheDocument()
  })
})
