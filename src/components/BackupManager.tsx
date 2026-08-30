import { useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { BACKUP_META_KEY, backupFileName, createBackup, formatBackupAge, MAX_BACKUP_BYTES, parseBackup } from '../backup'
import type { BackupPreview } from '../backup'
import type { Client } from '../domain/client'
import type { Tariff } from '../domain/tariff'

type BackupManagerProps = {
  clients: Client[]
  tariffs: Tariff[]
  disabled: boolean
  onRestore(preview: BackupPreview): Promise<void>
}

function readFile(file: File) {
  if (file.size > MAX_BACKUP_BYTES) return Promise.reject(new Error('File too large'))
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Invalid file'))
    reader.onerror = () => reject(reader.error ?? new Error('File read failed'))
    reader.readAsText(file)
  })
}

export function BackupManager({ clients, tariffs, disabled, onRestore }: BackupManagerProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [lastExportAt, setLastExportAt] = useState(() => window.localStorage.getItem(BACKUP_META_KEY))
  const [preview, setPreview] = useState<BackupPreview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isRestoring, setIsRestoring] = useState(false)

  const exportBackup = () => {
    try {
      const createdAt = new Date().toISOString()
      const content = JSON.stringify(createBackup(clients, tariffs, createdAt), null, 2)
      const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }))
      const link = document.createElement('a')
      link.href = url
      link.download = backupFileName(new Date(createdAt))
      document.body.append(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 0)
      window.localStorage.setItem(BACKUP_META_KEY, createdAt)
      setLastExportAt(createdAt)
      setError(null)
    } catch {
      setError('Не удалось создать файл. Попробуйте ещё раз.')
    }
  }

  const chooseFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      setPreview(parseBackup(await readFile(file)))
      setError(null)
    } catch {
      setPreview(null)
      setError('Файл не прошёл проверку. Выберите версионированную резервную копию Abon.')
    }
  }

  const restore = async () => {
    if (!preview) return
    setIsRestoring(true)
    try {
      await onRestore(preview)
      setPreview(null)
      setError(null)
    } catch {
      setError('Не удалось восстановить данные. Проверьте текущую базу и попробуйте ещё раз.')
    } finally {
      setIsRestoring(false)
    }
  }

  return <section className="settings-card" aria-labelledby="backup-settings-title">
    <div><p className="eyebrow">Независимая копия</p><h2 id="backup-settings-title">Резервная копия</h2></div>
    <p>Сохраните клиентов и тарифы в JSON-файл. При восстановлении файл сначала проверяется без изменения базы.</p>
    {disabled ? <p className="backup-status">Выйдите из demo-режима, чтобы работать с реальной базой.</p> : <>
      <div className="backup-actions">
        <button className="primary-button" type="button" onClick={exportBackup}>Скачать копию</button>
        <button className="quiet-button" type="button" onClick={() => inputRef.current?.click()}>Проверить файл</button>
        <input ref={inputRef} className="visually-hidden" type="file" accept="application/json,.json"
          aria-label="Выбрать файл резервной копии" onChange={(event) => void chooseFile(event)} />
      </div>
      <p className="backup-status">{lastExportAt
        ? `Последняя независимая копия: ${formatBackupAge(lastExportAt)}.`
        : 'Независимая копия ещё не создавалась.'}</p>
    </>}
    {error && <p className="field-error" role="alert">{error}</p>}
    {preview && <div className="backup-preview" role="status">
      <strong>Файл проверен</strong>
      <p>Abon · клиентов: {preview.clients.length} · тарифов: {preview.tariffs.length}</p>
      <p>Текущие данные будут полностью заменены только после подтверждения.</p>
      <div className="form-actions">
        <button className="quiet-button" type="button" onClick={() => setPreview(null)}>Отмена</button>
        <button className="danger-button" type="button" disabled={isRestoring} onClick={() => void restore()}>
          {isRestoring ? 'Восстанавливаем…' : 'Подтвердить замену базы'}
        </button>
      </div>
    </div>}
  </section>
}
