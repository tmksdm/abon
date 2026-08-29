import { useRegisterSW } from 'virtual:pwa-register/react'

const UPDATE_INTERVAL_MS = 60 * 60 * 1000

export function ReloadPrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_serviceWorkerUrl, registration) {
      if (!registration) return

      window.setInterval(() => {
        void registration.update()
      }, UPDATE_INTERVAL_MS)
    },
  })

  if (!needRefresh) return null

  const close = () => {
    setNeedRefresh(false)
  }

  return (
    <aside className="update-prompt" role="status" aria-live="polite">
      <div>
        <strong>Доступно обновление</strong>
        <span>Установить новую версию сейчас?</span>
      </div>
      <div className="update-actions">
        <button type="button" className="primary-button" onClick={() => void updateServiceWorker(true)}>
          Обновить
        </button>
        <button type="button" className="quiet-button" onClick={close}>
          Позже
        </button>
      </div>
    </aside>
  )
}
