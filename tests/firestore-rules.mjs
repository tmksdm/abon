import { readFile } from 'node:fs/promises'
import { after, before, beforeEach, test } from 'node:test'
import {
  assertFails, assertSucceeds, initializeTestEnvironment,
} from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore'

const projectId = 'demo-abon-rules'
const gymId = 'gym-owner'
const ownerUid = 'owner-user'
const outsiderUid = 'outsider-user'
let testEnvironment

before(async () => {
  testEnvironment = await initializeTestEnvironment({
    projectId,
    firestore: {
      rules: await readFile(new URL('../firestore.rules', import.meta.url), 'utf8'),
    },
  })
})

after(async () => {
  await testEnvironment.cleanup()
})

beforeEach(async () => {
  await testEnvironment.clearFirestore()
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    const database = context.firestore()
    await setDoc(doc(database, 'gyms', gymId), {
      ownerUid,
      memberUids: [ownerUid],
      dataInitialized: true,
    })
    await setDoc(doc(database, 'gyms', gymId, 'clients', 'client-1'), {
      name: 'Тестовый клиент',
    })
  })
})

test('владелец читает и изменяет данные своего зала', async () => {
  const database = testEnvironment.authenticatedContext(ownerUid).firestore()

  await assertSucceeds(getDoc(doc(database, 'gyms', gymId)))
  await assertSucceeds(getDoc(doc(database, 'gyms', gymId, 'clients', 'client-1')))
  await assertSucceeds(setDoc(doc(database, 'gyms', gymId, 'clients', 'client-2'), {
    name: 'Новая запись',
  }))
})

test('другой авторизованный пользователь не читает и не изменяет чужой зал', async () => {
  const database = testEnvironment.authenticatedContext(outsiderUid).firestore()

  await assertFails(getDoc(doc(database, 'gyms', gymId)))
  await assertFails(getDoc(doc(database, 'gyms', gymId, 'clients', 'client-1')))
  await assertFails(setDoc(doc(database, 'gyms', gymId, 'clients', 'intruder'), {
    name: 'Чужая запись',
  }))
})

test('неавторизованный пользователь не получает доступ к залу', async () => {
  const database = testEnvironment.unauthenticatedContext().firestore()

  await assertFails(getDoc(doc(database, 'gyms', gymId)))
  await assertFails(getDoc(doc(database, 'gyms', gymId, 'clients', 'client-1')))
})

test('владелец не может обойти правила и добавить участника напрямую', async () => {
  const database = testEnvironment.authenticatedContext(ownerUid).firestore()

  await assertFails(updateDoc(doc(database, 'gyms', gymId), {
    memberUids: [ownerUid, outsiderUid],
  }))
})
