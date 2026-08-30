import { initializeApp } from 'firebase/app'
import { browserLocalPersistence, getAuth, setPersistence } from 'firebase/auth'
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
} from 'firebase/firestore'

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export const isFirebaseConfigured = Object.values(config).every((value) => typeof value === 'string' && value.length > 0)

let services: ReturnType<typeof initializeServices> | null = null

function initializeServices() {
  const app = initializeApp(config)
  const auth = getAuth(app)
  const database = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  })
  return { auth, database, prepareAuth: () => setPersistence(auth, browserLocalPersistence) }
}

export function createFirebaseServices() {
  if (!isFirebaseConfigured) throw new Error('Firebase is not configured')
  services ??= initializeServices()
  return services
}
