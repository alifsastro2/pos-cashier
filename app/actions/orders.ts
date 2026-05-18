'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { verifySession } from '@/lib/dal'
import { generateOrderNumber } from '@/lib/utils/format'
import { orderEvents } from '@/lib/order-events'
import type { NewOrderPayload, StockAlertPayload } from '@/lib/order-events'
import type { CartItem, OrderType, PaymentMethod } from '@/types/pos'

type CreateOrderInput = {
  cart: CartItem[]
  orderType: OrderType
  paymentMethod: PaymentMethod
  subtotal: number
  taxAmount: number
  discount: number
  total: number
  notes: string
  customerName?: string
  tableNumber?: string
  cashReceived?: number
}

export async function createOrder(input: CreateOrderInput) {
  const session = await verifySession()

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const cartProductIds = input.cart.map((i) => i.productId)

  // 1. Pre-check stock
  const trackedProducts = await prisma.product.findMany({
    where: { id: { in: cartProductIds }, tenantId: session.tenantId, stock: { not: null } },
    select: { id: true, name: true, stock: true },
  })
  for (const product of trackedProducts) {
    const cartItem = input.cart.find((i) => i.productId === product.id)!
    if ((product.stock ?? 0) < cartItem.quantity) {
      throw new Error(
        `Stok "${product.name}" tidak mencukupi. Tersisa: ${product.stock ?? 0}, dibutuhkan: ${cartItem.quantity}`,
      )
    }
  }

  // 2. Create order with nested items and payment
  const order = await prisma.order.create({
    data: {
      orderNumber: generateOrderNumber(),
      status: 'COMPLETED',
      type: input.orderType,
      subtotal: input.subtotal,
      discount: input.discount,
      tax: input.taxAmount,
      total: input.total,
      notes: input.notes || null,
      customerName: input.customerName || null,
      tableNumber: input.tableNumber || null,
      tenantId: session.tenantId,
      cashierId: session.userId,
      items: {
        create: input.cart.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          price: item.price,
          notes: item.notes || null,
        })),
      },
      payment: {
        create: {
          amount: input.total,
          method: input.paymentMethod,
          status: 'SUCCESS',
        },
      },
    },
    include: {
      items: { include: { product: true } },
      payment: true,
    },
  })

  // 3. Decrement stock
  await Promise.all(
    input.cart.map((item) =>
      prisma.product.updateMany({
        where: { id: item.productId, tenantId: session.tenantId, stock: { not: null } },
        data: { stock: { decrement: item.quantity } },
      }),
    ),
  )

  // 4. Fetch queue count, cashier, and updated stock levels in parallel
  const [queueCount, cashier, updatedStocks] = await Promise.all([
    prisma.order.count({ where: { tenantId: session.tenantId, createdAt: { gte: todayStart } } }),
    prisma.user.findUnique({ where: { id: session.userId }, select: { name: true } }),
    prisma.product.findMany({
      where: { id: { in: cartProductIds }, tenantId: session.tenantId, stock: { not: null } },
      select: { name: true, stock: true },
    }),
  ])

  const queueNumber = String(queueCount).padStart(3, '0')
  const cashierName = cashier?.name ?? ''

  revalidatePath('/kasir')
  revalidatePath('/stok')
  revalidatePath('/laporan')
  revalidatePath('/dashboard')
  revalidatePath('/pesanan')

  // Notify all connected SSE clients of this tenant
  const payload: NewOrderPayload = {
    tenantId: session.tenantId,
    cashierName,
    orderType: input.orderType,
    orderNumber: order.orderNumber,
  }
  orderEvents.emit('new-order', payload)

  // Emit stock alerts if any product hit low/out threshold
  const stockOut  = updatedStocks.filter((p) => p.stock === 0).map((p) => p.name)
  const stockLow  = updatedStocks.filter((p) => (p.stock ?? 0) > 0 && (p.stock ?? 0) <= 5).map((p) => p.name)
  if (stockOut.length > 0 || stockLow.length > 0) {
    const alertPayload: StockAlertPayload = {
      tenantId: session.tenantId,
      out: stockOut,
      low: stockLow,
    }
    orderEvents.emit('stock-alert', alertPayload)
  }

  return { ...order, customerName: input.customerName || null, queueNumber, cashierName }
}

export async function markOrderDelivered(orderId: string) {
  const session = await verifySession()
  await prisma.order.update({
    where: { id: orderId, tenantId: session.tenantId },
    data: { isDelivered: true },
  })
  revalidatePath('/pesanan')
}

export async function cancelOrder(orderId: string) {
  const session = await verifySession()
  const order = await prisma.order.findUnique({
    where: { id: orderId, tenantId: session.tenantId },
    include: { items: true },
  })
  if (!order) return
  await Promise.all([
    prisma.order.update({ where: { id: orderId }, data: { status: 'CANCELLED' } }),
    ...order.items.map((item) =>
      prisma.product.updateMany({
        where: { id: item.productId, tenantId: session.tenantId, stock: { not: null } },
        data: { stock: { increment: item.quantity } },
      })
    ),
  ])
  revalidatePath('/pesanan')
  revalidatePath('/stok')
  revalidatePath('/laporan')
  revalidatePath('/dashboard')
}
