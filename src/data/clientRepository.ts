import type { Client, NewClient } from '../domain/client'

export interface ClientRepository {
  list(): Promise<Client[]>
  add(input: NewClient): Promise<Client>
}
