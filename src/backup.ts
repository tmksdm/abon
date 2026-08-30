import type { Client } from './domain/client'
import { isClient } from './data/localStorageClientRepository'
import type { Tariff } from './domain/tariff'
import { isTariff } from './domain/tariff'

export const BACKUP_META_KEY = 'abon.backup-meta.v1'
export const MAX_BACKUP_BYTES = 5 * 1024 * 1024

export type BackupPreview = {
  source: 'abon'
  createdAt: string
  clients: Client[]
  tariffs: Tariff[]
}

type AbonBackup = {
  app: 'abon'
  version: 1
  createdAt: string
  data: { clients: Client[]; tariffs: Tariff[] }
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid backup structure')
  return value as Record<string, unknown>
}

function ensureUniqueIds<T extends { id: string }>(items: T[]) {
  if (new Set(items.map((item) => item.id)).size !== items.length) throw new Error('Duplicate backup ids')
}

export function createBackup(clients: Client[], tariffs: Tariff[], createdAt = new Date().toISOString()): AbonBackup {
  if (!Number.isFinite(Date.parse(createdAt)) || !clients.every(isClient) || !tariffs.every(isTariff)) {
    throw new Error('Invalid backup data')
  }
  ensureUniqueIds(clients)
  ensureUniqueIds(tariffs)
  return { app: 'abon', version: 1, createdAt, data: { clients, tariffs } }
}

export function parseBackup(content: string): BackupPreview {
  if (new TextEncoder().encode(content).byteLength > MAX_BACKUP_BYTES) throw new Error('Backup file is too large')
  const root = record(JSON.parse(content) as unknown)
  const app = root.app
  if (app !== 'abon') throw new Error('Unsupported backup app')
  if (root.version !== 1) throw new Error('Unsupported backup version')
  if (typeof root.createdAt !== 'string' || !Number.isFinite(Date.parse(root.createdAt))) {
    throw new Error('Invalid backup timestamp')
  }
  const createdAt = new Date(root.createdAt).toISOString()
  const data = record(root.data)
  if (!Array.isArray(data.clients) || !Array.isArray(data.tariffs)) throw new Error('Invalid backup data')

  const clients = data.clients.filter(isClient)
  const tariffs = data.tariffs.filter(isTariff)
  if (clients.length !== data.clients.length || tariffs.length !== data.tariffs.length) throw new Error('Invalid backup records')
  ensureUniqueIds(clients)
  ensureUniqueIds(tariffs)
  return { source: app, createdAt, clients, tariffs }
}

export function backupFileName(date = new Date()) {
  const stamp = date.toISOString().replace(/[-:]/g, '').slice(0, 13).replace('T', '_')
  return `abon_backup_${stamp}.json`
}

export function formatBackupAge(iso: string, now = new Date()) {
  const elapsed = now.getTime() - Date.parse(iso)
  if (!Number.isFinite(elapsed) || elapsed < 0) return 'дата неизвестна'
  const days = Math.floor(elapsed / 86_400_000)
  if (days === 0) return 'сегодня'
  if (days === 1) return 'вчера'
  return `${days} дн. назад`
}
