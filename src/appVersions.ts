export type AppVersion = {
  version: string
  summary: string
}

export const APP_VERSIONS: AppVersion[] = [
  { version: '260829.6', summary: 'Добавлены история версий в настройках и полный формат дат.' },
  { version: '260829.5', summary: 'Добавлены карточка клиента, история оплат и продление.' },
  { version: '260829.4', summary: 'Отключено случайное обновление жестом вниз.' },
  { version: '260829.3', summary: 'Убрано техническое уведомление о готовности офлайн.' },
  { version: '260829.2', summary: 'Добавлены список клиентов, первая оплата и локальное сохранение.' },
  { version: '260829', summary: 'Создана устанавливаемая PWA и настроена публикация.' },
]

export const CURRENT_APP_VERSION = APP_VERSIONS[0].version
