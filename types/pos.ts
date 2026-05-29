export type CartItem = {
  id: string
  productId: string
  name: string
  price: number
  quantity: number
  notes: string
}

export type OrderType = 'DINE_IN' | 'TAKE_AWAY'
export type PaymentMethod = 'CASH' | 'QRIS' | 'TRANSFER'

export const ORDER_TYPE_LABELS: Record<OrderType, string> = {
  DINE_IN: 'Dine In',
  TAKE_AWAY: 'Take Away',
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: 'Tunai',
  QRIS: 'QRIS',
  TRANSFER: 'Transfer Bank',
}
