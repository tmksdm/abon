import type { Client, NewClient, NewMembershipFreeze, NewMembershipFreezeBatch, NewPayment } from '../domain/client'

export interface ClientRepository {
  list(): Promise<Client[]>
  add(input: NewClient): Promise<Client>
  addPayment(clientId: string, input: NewPayment): Promise<Client>
  freeze(clientId: string, input: NewMembershipFreeze): Promise<Client>
  resume(clientId: string, freezeId: string, resumedOn: string): Promise<Client>
  freezeBatch(input: NewMembershipFreezeBatch): Promise<Client[]>
  resumeBatch(batchId: string, resumedOn: string): Promise<Client[]>
  updateNote(clientId: string, note: string): Promise<Client>
}
