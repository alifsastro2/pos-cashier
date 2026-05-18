import { verifySession } from '@/lib/dal'
import { prisma } from '@/lib/prisma'
import { PesananClient } from '@/components/pesanan/pesanan-client'

export const metadata = { title: 'Pesanan — DigitalBnB POS' }

export default async function PesananPage() {
  const session = await verifySession()

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const [orders, users, tenant] = await Promise.all([
    prisma.order.findMany({
      where: { tenantId: session.tenantId, createdAt: { gte: todayStart } },
      orderBy: { createdAt: 'asc' },
      include: {
        items: { include: { product: { select: { name: true } } } },
        payment: { select: { method: true } },
      },
    }),
    prisma.user.findMany({
      where: { tenantId: session.tenantId },
      select: { id: true, name: true },
    }),
    prisma.tenant.findUnique({
      where: { id: session.tenantId },
      select: { name: true, address: true, instagram: true, receiptFooter: true, taxRate: true },
    }),
  ])

  const userMap = new Map(users.map((u) => [u.id, u.name]))

  const pesananOrders = orders.map((order, index) => ({
    id: order.id,
    orderNumber: order.orderNumber,
    type: order.type,
    customerName: order.customerName,
    tableNumber: order.tableNumber,
    notes: order.notes,
    createdAt: order.createdAt.toISOString(),
    queueNumber: String(index + 1).padStart(3, '0'),
    status: order.status,
    isDelivered: order.isDelivered,
    subtotal: order.subtotal,
    taxAmount: order.tax,
    discount: order.discount,
    total: order.total,
    paymentMethod: order.payment?.method ?? null,
    cashierName: order.cashierId ? (userMap.get(order.cashierId) ?? null) : null,
    items: order.items.map((item) => ({
      quantity: item.quantity,
      price: item.price,
      notes: item.notes,
      productName: item.product?.name ?? '?',
    })),
  }))

  return (
    <div className="flex flex-col h-full p-6">
      <PesananClient
        orders={pesananOrders}
        userRole={session.role}
        tenant={{
          name: tenant?.name ?? '',
          address: tenant?.address ?? null,
          instagram: tenant?.instagram ?? null,
          receiptFooter: tenant?.receiptFooter ?? null,
          taxRate: tenant?.taxRate ?? 0,
        }}
      />
    </div>
  )
}
