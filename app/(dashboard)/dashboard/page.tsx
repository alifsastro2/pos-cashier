import { verifySession } from '@/lib/dal'
import { prisma } from '@/lib/prisma'
import { formatRupiah } from '@/lib/utils/format'
import { ShoppingCart, TrendingUp, Package, ClipboardList } from 'lucide-react'
import { ORDER_TYPE_LABELS, PAYMENT_METHOD_LABELS as PML } from '@/types/pos'
import type { OrderType, PaymentMethod } from '@/types/pos'

export const metadata = { title: 'Dashboard — DigitalBnB POS' }

export default async function DashboardPage() {
  const session = await verifySession()

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [todayOrders, totalProducts, activeQueue, topProductsRaw, todayAllOrders] = await Promise.all([
    prisma.order.findMany({
      where: { tenantId: session.tenantId, createdAt: { gte: today }, status: 'COMPLETED' },
      select: { total: true },
    }),
    prisma.product.count({ where: { tenantId: session.tenantId, isActive: true } }),
    prisma.order.count({
      where: { tenantId: session.tenantId, status: 'COMPLETED', isDelivered: false, createdAt: { gte: today } },
    }),
    prisma.orderItem.groupBy({
      by: ['productId'],
      where: { order: { tenantId: session.tenantId, status: 'COMPLETED', createdAt: { gte: today } } },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 5,
    }),
    prisma.order.findMany({
      where: { tenantId: session.tenantId, createdAt: { gte: today } },
      orderBy: { createdAt: 'desc' },
      select: {
        orderNumber: true, total: true, type: true, status: true,
        customerName: true, createdAt: true,
        payment: { select: { method: true } },
      },
    }),
  ])

  const productIds = topProductsRaw.map((p) => p.productId)
  const topProductDetails = productIds.length > 0
    ? await prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, name: true } })
    : []
  const productMap = new Map(topProductDetails.map((p) => [p.id, p.name]))

  const topProducts = topProductsRaw.map((p) => ({
    name: productMap.get(p.productId) ?? '?',
    qty: p._sum.quantity ?? 0,
  }))
  const maxQty = topProducts[0]?.qty ?? 1

  const todayRevenue = todayOrders.reduce((sum, o) => sum + o.total, 0)
  const todayCount = todayOrders.length

  const stats = [
    { label: 'Pesanan Hari Ini', value: todayCount.toString(), icon: ShoppingCart, color: 'text-blue-500 dark:text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
    { label: 'Pendapatan Hari Ini', value: formatRupiah(todayRevenue), icon: TrendingUp, color: 'text-orange-500 dark:text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20' },
    { label: 'Total Produk Aktif', value: totalProducts.toString(), icon: Package, color: 'text-green-500 dark:text-green-400', bg: 'bg-green-500/10 border-green-500/20' },
    { label: 'Antrian Aktif', value: activeQueue.toString(), icon: ClipboardList, color: 'text-purple-500 dark:text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20' },
  ]

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Dashboard</h1>
        <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">Ringkasan aktivitas bisnis hari ini</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className={`bg-white dark:bg-white/[0.04] border rounded-xl p-5 ${stat.bg}`}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-zinc-500 dark:text-zinc-400">{stat.label}</p>
              <stat.icon className={`w-5 h-5 ${stat.color}`} />
            </div>
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Top 5 Produk Terlaris */}
        <div className="lg:col-span-2 bg-white dark:bg-white/[0.03] border border-zinc-200 dark:border-white/8 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-200 dark:border-white/6">
            <h2 className="text-base font-semibold text-zinc-900 dark:text-white">Top 5 Produk Terlaris</h2>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">Berdasarkan jumlah item terjual hari ini</p>
          </div>
          {topProducts.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm text-zinc-400 dark:text-zinc-600">Belum ada data penjualan hari ini</p>
            </div>
          ) : (
            <div className="p-4 space-y-3">
              {topProducts.map((product, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className={`text-xs font-bold w-5 shrink-0 ${i === 0 ? 'text-orange-500' : 'text-zinc-400 dark:text-zinc-600'}`}>
                        #{i + 1}
                      </span>
                      <span className="text-sm font-medium text-zinc-900 dark:text-white truncate">{product.name}</span>
                    </div>
                    <span className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 shrink-0 ml-2">{product.qty}x</span>
                  </div>
                  <div className="ml-7 h-1.5 bg-zinc-100 dark:bg-white/5 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${i === 0 ? 'bg-orange-500' : 'bg-zinc-300 dark:bg-zinc-600'}`}
                      style={{ width: `${(product.qty / maxQty) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Transaksi Hari Ini */}
        <div className="lg:col-span-3 bg-white dark:bg-white/[0.03] border border-zinc-200 dark:border-white/8 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-200 dark:border-white/6 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-white">Transaksi Hari Ini</h2>
              <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">{todayAllOrders.length} transaksi</p>
            </div>
          </div>
          {todayAllOrders.length === 0 ? (
            <div className="py-12 text-center">
              <ShoppingCart className="w-10 h-10 mx-auto mb-2 text-zinc-300 dark:text-zinc-700" />
              <p className="text-sm text-zinc-400 dark:text-zinc-600">Belum ada transaksi hari ini</p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-100 dark:divide-white/5 max-h-72 overflow-y-auto">
              {todayAllOrders.map((order) => {
                const isCancelled = order.status === 'CANCELLED'
                const typeLabel = ORDER_TYPE_LABELS[order.type as OrderType] ?? order.type
                const time = new Date(order.createdAt).toLocaleString('id-ID', { hour: '2-digit', minute: '2-digit' })
                return (
                  <div key={order.orderNumber} className={`flex items-center justify-between px-5 py-3 gap-3 ${isCancelled ? 'opacity-50' : ''}`}>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-zinc-900 dark:text-white">{order.orderNumber}</p>
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-zinc-100 dark:bg-white/8 text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-white/10">
                          {typeLabel}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5 truncate">
                        {order.customerName ? `👤 ${order.customerName} · ` : ''}{time}
                        {order.payment?.method ? ` · ${PML[order.payment.method as PaymentMethod] ?? order.payment.method}` : ''}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-sm font-semibold ${isCancelled ? 'text-zinc-400 line-through' : 'text-orange-500 dark:text-orange-400'}`}>
                        {formatRupiah(order.total)}
                      </p>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                        isCancelled
                          ? 'bg-red-500/15 text-red-500'
                          : 'bg-green-500/15 text-green-500'
                      }`}>
                        {isCancelled ? 'Dibatalkan' : 'Selesai'}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
