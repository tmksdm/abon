import { useRegisterSW } from 'virtual:pwa-register/react'

const UPDATE_INTERVAL_MS = 60 * 60 * 1000

export function ReloadPrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
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

  if (!offlineReady && !needRefresh) return null

  const close = () => {
    setOfflineReady(false)
    setNeedRefresh(false)
  }

  return (
    <aside className="update-prompt" role="status" aria-live="polite">
      <div>
        <strong>{needRefresh ? 'Доступно обновление' : 'Приложение готово к работе офлайн'}</strong>
        <span>
          {needRefresh
            ? 'Установить новую версию сейчас?'
            : 'Основные экраны откроются даже без сети.'}
        </span>
      </div>
      <div className="update-actions">
        {needRefresh && (
          <button type="button" className="primary-button" onClick={() => void updateServiceWorker(true)}>
            Обновить
          </button>
        )}
        <button type="button" className="quiet-button" onClick={close}>
          Позже
        </button>
      </div>
    </aside>
  )
}
