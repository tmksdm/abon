import { ReloadPrompt } from './components/ReloadPrompt'

function App() {
  return (
    <main className="app-shell">
      <header className="brand">
        <span className="brand-mark" aria-hidden="true">A</span>
        <span>Abon</span>
      </header>

      <section className="welcome" aria-labelledby="welcome-title">
        <p className="eyebrow">Учёт абонементов</p>
        <h1 id="welcome-title">Платежи и сроки — без лишнего шума</h1>
        <p className="lead">
          Каркас приложения готов. Следующий этап — первый рабочий сценарий:
          список клиентов, статусы и добавление оплаты.
        </p>

        <div className="status-card">
          <span className="status-dot" aria-hidden="true" />
          <div>
            <strong>Этап 0 завершён</strong>
            <span>PWA, светлая и тёмная темы, проверки проекта</span>
          </div>
        </div>
      </section>
      <ReloadPrompt />
    </main>
  )
}

export default App
