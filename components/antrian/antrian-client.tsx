'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'motion/react'
import { ClipboardList, RefreshCw, Check, X, AlertTriangle } from 'lucide-react'
import { ORDER_TYPE_LABELS } from '@/types/pos'
import type { OrderType } from '@/types/pos'
import { markOrderDelivered, cancelOrder } from '@/app/actions/orders'

type OrderItem = {
  quantity: number
  notes: string | null
  productName: string
}

type AntrianOrder = {
  id: string
  orderNumber: string
  type: string
  customerName: string | null
  notes: string | null
  createdAt: string
  queueNumber: string
  items: OrderItem[]
}

const TYPE_COLORS: Record<string, string> = {
  DINE_IN:    'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20',
  TAKE_AWAY:  'bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/20',
  GOFOOD:     'bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/20',
  GRABFOOD:   'bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/20',
  SHOPEEFOOD: 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/20',
}

function formatTime(iso: string) {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
}

const LONG_PRESS_MS = 800

function OrderCard({
  order,
  isAdmin,
  onRemove,
}: {
  order: AntrianOrder
  isAdmin: boolean
  onRemove: (id: string) => void
}) {
  const [isPending, startTransition] = useTransition()
  const [showConfirm, setShowConfirm] = useState(false)
  const [progress, setProgress] = useState(0)
  const [pressing, setPressing] = useState(false)
  const rafRef = useRef<number | null>(null)
  const startRef = useRef<number>(0)

  const typeColor = TYPE_COLORS[order.type] ?? TYPE_COLORS.DINE_IN
  const typeLabel = ORDER_TYPE_LABELS[order.type as OrderType] ?? order.type

  function startPress() {
    if (isPending) return
    setPressing(true)
    setProgress(0)
    startRef.current = Date.now()
    function tick() {
      const p = Math.min((Date.now() - startRef.current) / LONG_PRESS_MS, 1)
      setProgress(p)
      if (p < 1) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        setPressing(false)
        setProgress(0)
        setShowConfirm(true)
      }
    }
    rafRef.current = requestAnimationFrame(tick)
  }

  function endPress() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    setPressing(false)
    setProgress(0)
  }

  function handleSelesai() {
    onRemove(order.id)
    startTransition(async () => { await markOrderDelivered(order.id) })
  }

  function handleCancel() {
    setShowConfirm(false)
    onRemove(order.id)
    startTransition(async () => { await cancelOrder(order.id) })
  }

  return (
    <>
      <motion.div
        layout
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden flex flex-col"
      >
        {/* Queue number */}
        <div className="bg-orange-500/10 border-b border-orange-500/20 px-4 py-3 text-center">
          <p className="text-xs font-medium text-orange-500 dark:text-orange-400 uppercase tracking-widest mb-0.5">Antrian</p>
          <p className="text-4xl font-black text-orange-500 dark:text-orange-400 leading-none tracking-wider">
            {order.queueNumber}
          </p>
        </div>

        {/* Meta */}
        <div className="px-3 pt-3 pb-2">
          <div className="flex items-center justify-between mb-2">
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${typeColor}`}>
              {typeLabel}
            </span>
            <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono">
              {formatTime(order.createdAt)}
            </span>
          </div>
          {order.customerName && (
            <p className="text-xs font-semibold text-zinc-900 dark:text-white mb-1 truncate">
              👤 {order.customerName}
            </p>
          )}
        </div>

        {/* Items */}
        <div className="px-3 pb-3 space-y-1.5 border-t border-zinc-100 dark:border-zinc-800 pt-2 flex-1">
          {order.items.map((item, j) => (
            <div key={j}>
              <div className="flex items-baseline gap-2">
                <span className="text-xs font-bold text-orange-500 dark:text-orange-400 shrink-0">{item.quantity}x</span>
                <span className="text-xs font-medium text-zinc-800 dark:text-zinc-200 leading-snug">{item.productName}</span>
              </div>
              {item.notes && (
                <p className="text-[10px] text-zinc-400 dark:text-zinc-500 italic pl-6 leading-tight">! {item.notes}</p>
              )}
            </div>
          ))}
          {order.notes && (
            <div className="mt-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400 italic leading-snug">📝 {order.notes}</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-3 pb-3 flex gap-2">
          <button
            onClick={handleSelesai}
            disabled={isPending}
            className="flex-1 py-2 rounded-lg text-xs font-semibold text-green-600 dark:text-green-400 border border-green-500/30 bg-green-500/5 hover:bg-green-500/15 transition-colors flex items-center justify-center gap-1 disabled:opacity-40"
          >
            <Check className="w-3 h-3" />
            Selesai
          </button>

          {isAdmin && (
            <button
              onPointerDown={startPress}
              onPointerUp={endPress}
              onPointerLeave={endPress}
              disabled={isPending}
              className="relative overflow-hidden flex-1 py-2 rounded-lg text-xs font-semibold text-red-500 border border-red-500/30 bg-red-500/5 select-none disabled:opacity-40"
              style={{ touchAction: 'none' }}
            >
              <div
                className="absolute inset-0 bg-red-500/25 transition-none"
                style={{ width: `${progress * 100}%` }}
              />
              <span className="relative flex items-center justify-center gap-1">
                <X className="w-3 h-3" />
                {pressing ? 'Tahan...' : 'Batalkan'}
              </span>
            </button>
          )}
        </div>
      </motion.div>

      {/* Confirmation modal */}
      <AnimatePresence>
        {showConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setShowConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.92, y: 16 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.92, y: 16 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-sm p-6"
            >
              <div className="flex flex-col items-center text-center mb-5">
                <div className="w-12 h-12 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center mb-3">
                  <AlertTriangle className="w-6 h-6 text-red-500" />
                </div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-white">Batalkan Pesanan?</h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                  Pesanan <span className="font-semibold text-zinc-700 dark:text-zinc-200">{order.orderNumber}</span> akan dibatalkan dan stok produk akan dikembalikan.
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirm(false)}
                  className="flex-1 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-sm font-medium text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  Kembali
                </button>
                <button
                  onClick={handleCancel}
                  className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition-colors"
                >
                  Ya, Batalkan
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

export function AntrianClient({
  orders: initialOrders,
  userRole,
}: {
  orders: AntrianOrder[]
  userRole: string
}) {
  const router = useRouter()
  const [orders, setOrders] = useState(initialOrders)
  const isAdmin = userRole === 'ADMIN'

  useEffect(() => { setOrders(initialOrders) }, [initialOrders])

  useEffect(() => {
    const interval = setInterval(() => router.refresh(), 30_000)
    return () => clearInterval(interval)
  }, [router])

  function removeOrder(id: string) {
    setOrders((prev) => prev.filter((o) => o.id !== id))
    window.dispatchEvent(new CustomEvent('antrian-update'))
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-white">Antrian Aktif</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            {orders.length} pesanan aktif · Auto-refresh setiap 30 detik
          </p>
        </div>
        <button
          onClick={() => router.refresh()}
          className="flex items-center gap-2 h-9 px-4 rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 text-sm font-medium hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {orders.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center">
          <ClipboardList className="w-16 h-16 mb-4 text-zinc-300 dark:text-zinc-700" />
          <p className="text-lg font-medium text-zinc-500 dark:text-zinc-400">Tidak ada antrian aktif</p>
          <p className="text-sm text-zinc-400 dark:text-zinc-600 mt-1">
            Pesanan baru akan muncul di sini setelah kasir konfirmasi pembayaran
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            <AnimatePresence mode="popLayout">
              {[...orders].reverse().map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  isAdmin={isAdmin}
                  onRemove={removeOrder}
                />
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}
    </div>
  )
}
