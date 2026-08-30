import { useEffect, useMemo, useState } from 'react'
import {
  isSignInWithEmailLink, onAuthStateChanged, sendSignInLinkToEmail, signInWithEmailLink, signOut,
} from 'firebase/auth'
import type { User } from 'firebase/auth'
import { doc, runTransaction } from 'firebase/firestore'
import type { Firestore } from 'firebase/firestore'
import App from '../App'
import { localStorageClientRepository } from '../data/localStorageClientRepository'
import { localStorageTariffRepository } from '../data/localStorageTariffRepository'
import { createSyncController } from '../sync/sync'
import type { SyncState } from '../sync/sync'
import { createFirebaseServices, isFirebaseConfigured } from './firebase'
import { createFirebaseCloudStore } from './firebaseCloudStore'

const EMAIL_KEY = 'abon.auth.email'
const LOCAL_OWNER_KEY = 'abon.local.owner.v1'

function cachedGymIdFor(user: User) {
  const owner = window.localStorage.getItem(LOCAL_OWNER_KEY)
  const prefix = `${user.uid}:`
  return owner?.startsWith(prefix) ? owner.slice(prefix.length) : null
}

async function findOrCreateGym(database: Firestore, user: User) {
  const userReference = doc(database, 'users', user.uid)
  return runTransaction(database, async (transaction) => {
    const profile = await transaction.get(userReference)
    if (profile.exists()) {
      const gymId = profile.data().gymId
      if (typeof gymId !== 'string' || !gymId) throw new Error('Invalid gym profile')
      return gymId
    }
    const gymId = crypto.randomUUID()
    transaction.set(doc(database, 'gyms', gymId), {
      ownerUid: user.uid,
      memberUids: [user.uid],
      dataInitialized: false,
      createdAt: new Date().toISOString(),
    })
    transaction.set(userReference, { gymId, email: user.email ?? '' })
    return gymId
  })
}

type LoginProps = {
  finishingLink: boolean
  onSubmit(email: string): Promise<void>
}

function LoginScreen({ finishingLink, onSubmit }: LoginProps) {
  const [email, setEmail] = useState(() => window.localStorage.getItem(EMAIL_KEY) ?? '')
  const [sent, setSent] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setIsSubmitting(true)
    setError(null)
    try { await onSubmit(email.trim()); setSent(true) }
    catch { setError('Не удалось выполнить вход. Проверьте адрес и подключение к сети.') }
    finally { setIsSubmitting(false) }
  }
  return <main className="auth-shell">
    <section className="auth-card">
      <p className="eyebrow">Abon</p>
      <h1>{finishingLink ? 'Подтвердите email' : 'Вход владельца'}</h1>
      <p>{sent && !finishingLink
        ? 'Ссылка отправлена. Откройте письмо на этом устройстве, чтобы войти.'
        : finishingLink
          ? 'Введите тот же адрес, на который пришла ссылка.'
          : 'Получите одноразовую ссылку на email. Пароль не нужен.'}</p>
      {!sent || finishingLink ? <form onSubmit={submit}>
        <label><span>Email</span><input type="email" autoComplete="email" required value={email}
          onChange={(event) => setEmail(event.target.value)} /></label>
        {error && <p className="field-error" role="alert">{error}</p>}
        <button className="primary-button" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Подождите…' : finishingLink ? 'Завершить вход' : 'Получить ссылку'}
        </button>
      </form> : <button className="text-button" type="button" onClick={() => setSent(false)}>Другой email</button>}
    </section>
  </main>
}

function ConfigurationScreen() {
  return <main className="auth-shell"><section className="auth-card" role="alert">
    <p className="eyebrow">Abon</p><h1>Облако ещё не подключено</h1>
    <p>Для входа владельца нужно завершить настройку Firebase.</p>
  </section></main>
}

export function CloudApp() {
  const services = useMemo(() => isFirebaseConfigured ? createFirebaseServices() : null, [])
  const [user, setUser] = useState<User | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [controller, setController] = useState<ReturnType<typeof createSyncController> | null>(null)
  const [syncState, setSyncState] = useState<SyncState>({ phase: 'starting', pending: 0 })
  const [startupError, setStartupError] = useState(false)
  const finishingLink = services ? isSignInWithEmailLink(services.auth, window.location.href) : false

  useEffect(() => {
    if (!services) return
    void services.prepareAuth()
    return onAuthStateChanged(services.auth, (nextUser) => {
      setController(null)
      setStartupError(false)
      setUser(nextUser)
      setAuthReady(true)
    })
  }, [services])

  useEffect(() => {
    if (!services || !user) return
    let active = true
    let nextController: ReturnType<typeof createSyncController> | null = null
    const gymIdPromise = cachedGymIdFor(user) ?? findOrCreateGym(services.database, user)
    void Promise.resolve(gymIdPromise).then(async (gymId) => {
      if (!active) return
      const localOwner = `${user.uid}:${gymId}`
      const previousOwner = window.localStorage.getItem(LOCAL_OWNER_KEY)
      if (previousOwner !== null && previousOwner !== localOwner) {
        await Promise.all([
          localStorageClientRepository.replaceAll([]),
          localStorageTariffRepository.replaceAll([]),
        ])
      }
      window.localStorage.setItem(LOCAL_OWNER_KEY, localOwner)
      if (!active) return
      nextController = createSyncController({
        localClients: localStorageClientRepository,
        localTariffs: localStorageTariffRepository,
        cloud: createFirebaseCloudStore(services.database, gymId),
        queueKey: `abon.sync.queue.v1:${user.uid}:${gymId}`,
      })
      const unsubscribeState = nextController.subscribeState(setSyncState)
      setController(nextController)
      try {
        await nextController.start()
      } catch {
        unsubscribeState()
        nextController.stop()
        if (active) {
          setController(null)
          setStartupError(true)
        }
      }
    }).catch(() => { if (active) setStartupError(true) })
    return () => { active = false; nextController?.stop() }
  }, [services, user])

  if (!services) return <ConfigurationScreen />
  if (!authReady || (user && !controller && !startupError)) {
    return <main className="auth-shell"><p className="loading" role="status">Открываем базу…</p></main>
  }
  if (startupError) return <main className="auth-shell"><section className="auth-card" role="alert">
    <h1>База недоступна</h1><p>Проверьте подключение и откройте приложение снова.</p>
  </section></main>
  if (!user) return <LoginScreen finishingLink={finishingLink} onSubmit={async (email) => {
    window.localStorage.setItem(EMAIL_KEY, email)
    if (finishingLink) {
      await signInWithEmailLink(services.auth, email, window.location.href)
      window.history.replaceState({}, '', import.meta.env.BASE_URL)
    } else {
      await sendSignInLinkToEmail(services.auth, email, {
        url: new URL(import.meta.env.BASE_URL, window.location.origin).href,
        handleCodeInApp: true,
      })
    }
  }} />
  return <App repository={controller!.clientRepository} tariffRepository={controller!.tariffRepository}
    account={{
      email: user.email ?? '', syncState,
      onSync: () => controller!.syncNow(),
      onSignOut: async () => {
        await signOut(services.auth)
        await Promise.all([
          localStorageClientRepository.replaceAll([]),
          localStorageTariffRepository.replaceAll([]),
        ])
      },
    }} />
}
