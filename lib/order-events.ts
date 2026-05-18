import { EventEmitter } from 'events'

export type NewOrderPayload = {
  tenantId: string
  cashierName: string
  orderType: string
  orderNumber: string
}

export type StockAlertPayload = {
  tenantId: string
  low: string[]  // product names with stock 1–5
  out: string[]  // product names with stock 0
}

// Persist across hot-reloads in development
const g = global as typeof globalThis & { _orderEvents?: EventEmitter }
if (!g._orderEvents) {
  g._orderEvents = new EventEmitter()
  g._orderEvents.setMaxListeners(200)
}
export const orderEvents = g._orderEvents
