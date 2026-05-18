import { redirect } from 'next/navigation'
import { verifySession } from '@/lib/dal'
import { prisma } from '@/lib/prisma'
import { LaporanClient } from '@/components/laporan/laporan-client'

export const metadata = { title: 'Laporan — DigitalBnB POS' }

type FilterMode = 'harian' | 'bulanan' | 'tahunan'

function getDateRange(mode: FilterMode, month: string, year: string) {
  const now = new Date()

  if (mode === 'harian') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0)
    const end   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
    const prevStart = new Date(start); prevStart.setDate(prevStart.getDate() - 1)
    const prevEnd   = new Date(end);   prevEnd.setDate(prevEnd.getDate() - 1)
    return { start, end, prevStart, prevEnd }
  }

  if (mode === 'bulanan') {
    const [y, m] = month.split('-').map(Number)
    const start = new Date(y, m - 1, 1, 0, 0, 0)
    const end   = new Date(y, m, 0, 23, 59, 59, 999)
    const prevStart = new Date(y, m - 2, 1, 0, 0, 0)
    const prevEnd   = new Date(y, m - 1, 0, 23, 59, 59, 999)
    return { start, end, prevStart, prevEnd }
  }

  // tahunan
  const y = parseInt(year)
  const start = new Date(y, 0, 1, 0, 0, 0)
  const end   = new Date(y, 11, 31, 23, 59, 59, 999)
  const prevStart = new Date(y - 1, 0, 1, 0, 0, 0)
  const prevEnd   = new Date(y - 1, 11, 31, 23, 59, 59, 999)
  return { start, end, prevStart, prevEnd }
}

function buildBarStats(
  orders: { total: number; createdAt: Date }[],
  mode: FilterMode,
  year: number,
  month: number,
) {
  if (mode === 'harian') {
    const stats = Array.from({ length: 24 }, (_, i) => ({
      label: `${String(i).padStart(2, '0')}:00`,
      revenue: 0,
      orders: 0,
    }))
    for (const o of orders) {
      const h = new Date(o.createdAt).getHours()
      stats[h].revenue += o.total
      stats[h].orders  += 1
    }
    return stats
  }

  if (mode === 'bulanan') {
    const daysInMonth = new Date(year, month, 0).getDate()
    const stats = Array.from({ length: daysInMonth }, (_, i) => ({
      label: String(i + 1),
      revenue: 0,
      orders: 0,
    }))
    for (const o of orders) {
      const d = new Date(o.createdAt).getDate() - 1
      if (d >= 0 && d < stats.length) {
        stats[d].revenue += o.total
        stats[d].orders  += 1
      }
    }
    return stats
  }

  // tahunan
  const MONTHS = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des']
  const stats = MONTHS.map((label) => ({ label, revenue: 0, orders: 0 }))
  for (const o of orders) {
    const m = new Date(o.createdAt).getMonth()
    stats[m].revenue += o.total
    stats[m].orders  += 1
  }
  return stats
}

function periodLabel(mode: FilterMode, month: string, year: string) {
  const now = new Date()
  if (mode === 'harian') {
    return now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  }
  if (mode === 'bulanan') {
    const [y, m] = month.split('-').map(Number)
    return new Date(y, m - 1, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
  }
  return `Tahun ${year}`
}

export default async function LaporanPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; month?: string; year?: string }>
}) {
  const session = await verifySession()

  if (session.role !== 'ADMIN') {
    redirect('/kasir')
  }

  const params  = await searchParams
  const isAdmin = true

  const now          = new Date()
  const mode         = isAdmin ? ((params.filter as FilterMode) || 'harian') : 'harian'
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const currentYear  = String(now.getFullYear())
  const month        = params.month || currentMonth
  const year         = params.year  || currentYear

  const [y, m] = month.split('-').map(Number)
  const { start, end, prevStart, prevEnd } = getDateRange(mode, month, year)

  const [orders, prevOrders, orderItems, users, tenant] = await Promise.all([
    prisma.order.findMany({
      where: { tenantId: session.tenantId, status: 'COMPLETED', createdAt: { gte: start, lte: end } },
      include: {
        items: { include: { product: { select: { name: true } } } },
        payment: { select: { method: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.order.findMany({
      where: { tenantId: session.tenantId, status: 'COMPLETED', createdAt: { gte: prevStart, lte: prevEnd } },
      select: { total: true },
    }),
    prisma.orderItem.findMany({
      where: { order: { tenantId: session.tenantId, status: 'COMPLETED', createdAt: { gte: start, lte: end } } },
      include: { product: { select: { name: true } } },
    }),
    prisma.user.findMany({
      where: { tenantId: session.tenantId },
      select: { id: true, name: true },
    }),
    prisma.tenant.findUnique({
      where: { id: session.tenantId },
      select: { name: true, address: true, logo: true, phone: true, instagram: true },
    }),
  ])

  const userMap = new Map(users.map((u) => [u.id, u.name]))

  const barStats = buildBarStats(orders, mode, y, m)

  // Top products
  const productMap = new Map<string, { name: string; totalQty: number; totalRevenue: number }>()
  for (const item of orderItems) {
    if (!item.product) continue
    const ex = productMap.get(item.productId)
    if (ex) {
      ex.totalQty     += item.quantity
      ex.totalRevenue += item.price * item.quantity
    } else {
      productMap.set(item.productId, {
        name: item.product.name,
        totalQty: item.quantity,
        totalRevenue: item.price * item.quantity,
      })
    }
  }
  const topProducts = Array.from(productMap.values()).sort((a, b) => b.totalQty - a.totalQty)

  const totalRevenue  = orders.reduce((s, o) => s + o.total, 0)
  const prevRevenue   = prevOrders.reduce((s, o) => s + o.total, 0)
  const totalOrders   = orders.length
  const prevCount     = prevOrders.length
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0
  const revenueChange = prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : null
  const ordersChange  = prevCount   > 0 ? ((totalOrders  - prevCount)   / prevCount)   * 100 : null

  return (
    <div className="flex flex-col h-full p-6">
      <LaporanClient
        mode={mode}
        selectedMonth={month}
        selectedYear={year}
        currentMonth={currentMonth}
        currentYear={currentYear}
        barStats={barStats}
        topProducts={topProducts}
        isAdmin={isAdmin}
        recentOrders={orders.map((o) => ({
          id: o.id,
          orderNumber: o.orderNumber,
          type: o.type,
          status: o.status,
          total: o.total,
          createdAt: o.createdAt.toISOString(),
          customerName: o.customerName,
          cashierName: o.cashierId ? (userMap.get(o.cashierId) ?? null) : null,
          items: o.items,
          payment: o.payment,
        }))}
        summary={{
          totalRevenue,
          totalOrders,
          avgOrderValue,
          period: periodLabel(mode, month, year),
          revenueChange,
          ordersChange,
        }}
        tenant={{
          name: tenant?.name ?? '',
          address: tenant?.address ?? null,
          logo: tenant?.logo ?? null,
          phone: tenant?.phone ?? null,
          instagram: tenant?.instagram ?? null,
        }}
      />
    </div>
  )
}
