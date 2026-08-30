import type {
  Client, NewClient, NewMembershipFreeze, NewMembershipFreezeBatch, NewPayment, UpdateClient,
} from '../domain/client'

export interface ClientRepository {
  subscribe?(listener: () => void): () => void
  list(): Promise<Client[]>
  replaceAll(clients: Client[]): Promise<void>
  add(input: NewClient): Promise<Client>
  update(clientId: string, input: UpdateClient): Promise<Client>
  archive(clientId: string): Promise<Client>
  restore(clientId: string): Promise<Client>
  deletePermanently(clientId: string): Promise<void>
  addPayment(clientId: string, input: NewPayment): Promise<Client>
  freeze(clientId: string, input: NewMembershipFreeze): Promise<Client>
  resume(clientId: string, freezeId: string, resumedOn: string): Promise<Client>
  freezeBatch(input: NewMembershipFreezeBatch): Promise<Client[]>
  resumeBatch(batchId: string, resumedOn: string): Promise<Client[]>
  updateNote(clientId: string, note: string): Promise<Client>
}
