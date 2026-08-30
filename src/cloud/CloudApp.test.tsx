import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const start = vi.fn(() => new Promise<void>(() => undefined))
  const stop = vi.fn()
  const subscribeState = vi.fn((listener: (state: { phase: 'starting'; pending: number }) => void) => {
    listener({ phase: 'starting', pending: 0 })
    return () => undefined
  })
  return {
    prepareAuth: vi.fn(async () => undefined),
    start,
    stop,
    subscribeState,
    onAuthStateChanged: vi.fn((_auth: unknown, listener: (user: unknown) => void) => {
      listener({ uid: 'owner-1', email: 'owner@example.test' })
      return () => undefined
    }),
  }
})

vi.mock('firebase/auth', () => ({
  isSignInWithEmailLink: vi.fn(() => false),
  onAuthStateChanged: mocks.onAuthStateChanged,
  sendSignInLinkToEmail: vi.fn(),
  signInWithEmailLink: vi.fn(),
  signOut: vi.fn(),
}))

vi.mock('firebase/firestore', () => ({ doc: vi.fn(), runTransaction: vi.fn() }))

vi.mock('./firebase', () => ({
  isFirebaseConfigured: true,
  createFirebaseServices: () => ({ auth: {}, database: {}, prepareAuth: mocks.prepareAuth }),
}))

vi.mock('./firebaseCloudStore', () => ({ createFirebaseCloudStore: vi.fn(() => ({})) }))

vi.mock('../sync/sync', () => ({
  createSyncController: vi.fn(() => ({
    clientRepository: {},
    tariffRepository: {},
    subscribeState: mocks.subscribeState,
    start: mocks.start,
    stop: mocks.stop,
    syncNow: vi.fn(),
  })),
}))

vi.mock('../App', () => ({ default: () => <main>Локальная база открыта</main> }))

import { CloudApp } from './CloudApp'

describe('CloudApp', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.clearAllMocks()
  })

  it('показывает локальную базу, не дожидаясь облачной загрузки', async () => {
    window.localStorage.setItem('abon.local.owner.v1', 'owner-1:gym-1')

    render(<CloudApp />)

    expect(await screen.findByText('Локальная база открыта')).toBeInTheDocument()
    expect(mocks.start).toHaveBeenCalledTimes(1)
  })
})
