import type { Client, NewClient, NewPayment } from '../domain/client'

export interface ClientRepository {
  list(): Promise<Client[]>
  add(input: NewClient): Promise<Client>
  addPayment(clientId: string, input: NewPayment): Promise<Client>
}
