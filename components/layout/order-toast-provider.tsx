'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'motion/react'
import { Bell, PackageX, PackageOpen, X } from 'lucide-react'
import { ORDER_TYPE_LABELS } from '@/types/pos'
import type { OrderType } from '@/types/pos'

type OrderToast = {
  cashierName: string
  orderType: string
  orderNumber: string
}

type StockToastItem = {
  id: number
  kind: 'out' | 'low'
  names: string[]
}

let _toastId = 0

function playSound(src: string) {
  try {
    const audio = new Audio(src)
    audio.volume = 0.8
    audio.play().catch(() => {})
  } catch {}
}

export function OrderToastProvider() {
  const router = useRouter()
  const [orderToast, setOrderToast]   = useState<OrderToast | null>(null)
  const [stockToast, setStockToast]   = useState<StockToastItem | null>(null)

  const orderTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const stockTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const stockQueueRef    = useRef<StockToastItem[]>([])
  const processingRef    = useRef(false)
  const orderActiveRef   = useRef(false) // true while order toast is visible

  const processNextStock = useCallback(() => {
    if (stockQueueRef.current.length === 0) {
      processingRef.current = false
      return
    }
    processingRef.current = true
    const next = stockQueueRef.current.shift()!

    // If order toast is still up, delay a bit so sounds don't overlap
    const delay = orderActiveRef.current ? 1_500 : 0

    setTimeout(() => {
      playSound(next.kind === 'out' ? '/stock-habis.mp3' : '/stock-hampir-habis.mp3')
      setStockToast(next)
      if (stockTimerRef.current) clearTimeout(stockTimerRef.current)
      stockTimerRef.current = setTimeout(() => {
        setStockToast(null)
        // Short pause before showing next stock toast
        setTimeout(processNextStock, 400)
      }, 7_000)
    }, delay)
  }, [])

  const dismissStockToast = useCallback(() => {
    if (stockTimerRef.current) clearTimeout(stockTimerRef.current)
    setStockToast(null)
    processingRef.current = false
    setTimeout(processNextStock, 400)
  }, [processNextStock])

  const showOrderToast = useCallback((data: OrderToast) => {
    playSound('/pesanan-masuk.mp3')
    orderActiveRef.current = true
    setOrderToast(data)
    if (orderTimerRef.current) clearTimeout(orderTimerRef.current)
    orderTimerRef.current = setTimeout(() => {
      setOrderToast(null)
      orderActiveRef.current = false
    }, 5_000)
  }, [])

  const dismissOrderToast = useCallback(() => {
    if (orderTimerRef.current) clearTimeout(orderTimerRef.current)
    setOrderToast(null)
    orderActiveRef.current = false
  }, [])

  const enqueueStockAlert = useCallback((data: { low: string[]; out: string[] }) => {
    // "out" items are more urgent — queue them first
    if (data.out.length > 0) stockQueueRef.current.push({ id: ++_toastId, kind: 'out', names: data.out })
    if (data.low.length > 0) stockQueueRef.current.push({ id: ++_toastId, kind: 'low', names: data.low })
    if (!processingRef.current) processNextStock()
  }, [processNextStock])

  useEffect(() => {
    let es: EventSource | null = null

    function connect() {
      es = new EventSource('/api/orders/stream')
      es.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data)
          if (data.type === 'new-order') {
            showOrderToast(data)
            router.refresh()
          } else if (data.type === 'stock-alert') {
            enqueueStockAlert(data)
          }
        } catch { /* ignore non-JSON pings */ }
      }
      es.onerror = () => {
        es?.close()
        setTimeout(connect, 5_000)
      }
    }

    connect()

    const fallback = setInterval(() => router.refresh(), 60_000)
    return () => {
      es?.close()
      clearInterval(fallback)
      if (orderTimerRef.current) clearTimeout(orderTimerRef.current)
      if (stockTimerRef.current) clearTimeout(stockTimerRef.current)
    }
  }, [router, showOrderToast, enqueueStockAlert])

  const typeLabel = orderToast
    ? (ORDER_TYPE_LABELS[orderToast.orderType as OrderType] ?? orderToast.orderType)
    : ''

  const stockLabel = stockToast?.kind === 'out' ? 'Stok Habis' : 'Stok Hampir Habis'
  const StockIcon  = stockToast?.kind === 'out' ? PackageX : PackageOpen

  return (
    <>
      {/* ── Order toast ─────────────────────────────── */}
      <AnimatePresence>
        {orderToast && (
          <motion.div
            key="order-toast"
            initial={{ opacity: 0, y: -24, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 420, damping: 30 }}
            style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 9999 }}
            className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-orange-500 text-black shadow-xl shadow-orange-500/30 text-sm font-semibold whitespace-nowrap"
          >
            <Bell className="w-4 h-4 shrink-0" />
            <span>
              Pesanan baru —{' '}
              <span className="font-bold">{orderToast.orderNumber}</span>
              <span className="font-normal opacity-80"> · {typeLabel} · Kasir: {orderToast.cashierName}</span>
            </span>
            <button onClick={dismissOrderToast} className="ml-1 opacity-60 hover:opacity-100 transition-opacity">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Stock toast (queued, one at a time) ──────── */}
      <AnimatePresence>
        {stockToast && (
          <motion.div
            key={`stock-${stockToast.id}`}
            initial={{ opacity: 0, y: -24, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 420, damping: 30 }}
            style={{
              position: 'fixed',
              top: orderToast ? 76 : 20,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 9998,
            }}
            className={`flex items-start gap-3 px-5 py-3 rounded-2xl shadow-xl text-sm font-semibold whitespace-nowrap ${
              stockToast.kind === 'out'
                ? 'bg-red-500 text-white shadow-red-500/30'
                : 'bg-amber-400 text-black shadow-amber-400/30'
            }`}
          >
            <StockIcon className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="flex flex-col gap-0.5">
              <span className="font-bold">{stockLabel}</span>
              <span className="font-normal opacity-90">{stockToast.names.join(', ')}</span>
            </span>
            <button onClick={dismissStockToast} className="ml-1 opacity-60 hover:opacity-100 transition-opacity self-start">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
