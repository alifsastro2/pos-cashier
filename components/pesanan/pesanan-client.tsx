'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { ClipboardList, RefreshCw, Check, X, AlertTriangle, History, Printer } from 'lucide-react'
import { ORDER_TYPE_LABELS, PAYMENT_METHOD_LABELS as PML } from '@/types/pos'
import type { OrderType, PaymentMethod } from '@/types/pos'
import { markOrderDelivered, cancelOrder } from '@/app/actions/orders'
import { formatRupiah } from '@/lib/utils/format'
import { printCustomerReceipt, printKitchenTicket } from '@/lib/utils/receipt'
import type { PrintReceiptsInput } from '@/lib/utils/receipt'

type OrderItem = {
  quantity: number
  price: number
  notes: string | null
  productName: string
}

type PesananOrder = {
  id: string
  orderNumber: string
  type: string
  customerName: string | null
  tableNumber: string | null
  notes: string | null
  createdAt: string
  queueNumber: string
  status: string
  isDelivered: boolean
  subtotal: number
  taxAmount: number
  discount: number
  total: number
  paymentMethod: string | null
  cashierName: string | null
  items: OrderItem[]
}

type TenantInfo = {
  name: string
  address: string | null
  instagram: string | null
  receiptFooter: string | null
  taxRate: number
}

function buildPrintData(order: PesananOrder, tenant: TenantInfo): PrintReceiptsInput {
  return {
    tenantName: tenant.name,
    tenantAddress: tenant.address,
    tenantInstagram: tenant.instagram,
    tenantReceiptFooter: tenant.receiptFooter,
    orderNumber: order.orderNumber,
    queueNumber: order.queueNumber,
    orderType: order.type,
    customerName: order.customerName,
    tableNumber: order.tableNumber,
    cashierName: order.cashierName ?? '',
    cart: order.items.map((item, i) => ({
      id: String(i),
      productId: String(i),
      name: item.productName,
      price: item.price,
      quantity: item.quantity,
      notes: item.notes ?? '',
    })),
    notes: order.notes,
    subtotal: order.subtotal,
    taxAmount: order.taxAmount,
    taxRate: tenant.taxRate,
    discount: order.discount,
    total: order.total,
    paymentMethod: order.paymentMethod ?? 'CASH',
  }
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

function useLongPress(onComplete: () => void, disabled?: boolean) {
  const [progress, setProgress] = useState(0)
  const [pressing, setPressing] = useState(false)
  const rafRef = useRef<number | null>(null)
  const startRef = useRef<number>(0)

  function startPress() {
    if (disabled) return
    setPressing(true)
    setProgress(0)
    startRef.current = Date.now()
    function tick() {
      const p = Math.min((Date.now() - startRef.current) / LONG_PRESS_MS, 1)
      setProgress(p)
      if (p < 1) { rafRef.current = requestAnimationFrame(tick) }
      else { setPressing(false); setProgress(0); onComplete() }
    }
    rafRef.current = requestAnimationFrame(tick)
  }

  function endPress() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    setPressing(false)
    setProgress(0)
  }

  return { progress, pressing, handlers: { onPointerDown: startPress, onPointerUp: endPress, onPointerLeave: endPress } }
}

function statusBadgeProps(status: string, isDelivered: boolean) {
  if (status === 'CANCELLED') return { label: 'Dibatalkan', cls: 'bg-red-500/15 text-red-500 border-red-500/20' }
  if (isDelivered) return { label: 'Selesai', cls: 'bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/20' }
  return { label: 'On Process', cls: 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/20' }
}

// ─── Order Detail Modal ────────────────────────────────────────────────────────

function CancelConfirm({ orderNumber, onConfirm, onCancel }: { orderNumber: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onCancel}
    >
      <motion.div
        initial={{ scale: 0.92, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 16 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-sm p-6"
      >
        <div className="flex flex-col items-center text-center mb-5">
          <div className="w-12 h-12 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center mb-3">
            <AlertTriangle className="w-6 h-6 text-red-500" />
          </div>
          <h3 className="text-base font-bold text-zinc-900 dark:text-white">Batalkan Pesanan?</h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Pesanan <span className="font-semibold text-zinc-700 dark:text-zinc-200">{orderNumber}</span> akan dibatalkan dan stok produk akan dikembalikan.
          </p>
        </div>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-sm font-medium text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
            Kembali
          </button>
          <button onClick={onConfirm} className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition-colors">
            Ya, Batalkan
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

function OrderDetailModal({
  order, isAdmin, tenant, onClose, onSelesai, onCancel,
}: {
  order: PesananOrder; isAdmin: boolean; tenant: TenantInfo
  onClose: () => void; onSelesai: () => void; onCancel: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [showConfirm, setShowConfirm] = useState(false)
  const isActive = order.status === 'COMPLETED' && !order.isDelivered
  const badge = statusBadgeProps(order.status, order.isDelivered)
  const typeLabel = ORDER_TYPE_LABELS[order.type as OrderType] ?? order.type
  const typeColor = TYPE_COLORS[order.type] ?? TYPE_COLORS.DINE_IN

  const { progress, pressing, handlers } = useLongPress(() => setShowConfirm(true), isPending)

  function handleSelesai() {
    onSelesai(); onClose()
    startTransition(async () => { await markOrderDelivered(order.id) })
  }

  function handleCancel() {
    setShowConfirm(false); onCancel(); onClose()
    startTransition(async () => { await cancelOrder(order.id) })
  }

  const dateStr = new Date(order.createdAt).toLocaleString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-md max-h-[90vh] flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
            <div>
              <h2 className="text-base font-bold text-zinc-900 dark:text-white">{order.orderNumber}</h2>
              <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">{dateStr}</p>
            </div>
            <button onClick={onClose} className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors p-1">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="overflow-y-auto flex-1 p-5 space-y-4">
            {/* Queue + Status */}
            <div className="flex items-center gap-4">
              <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl px-4 py-2 text-center min-w-[76px]">
                <p className="text-[9px] text-orange-400 uppercase tracking-widest font-medium">Antrian</p>
                <p className="text-3xl font-black text-orange-500 dark:text-orange-400 leading-tight">{order.queueNumber}</p>
              </div>
              <div className="space-y-1.5">
                <span className={`inline-flex text-xs font-semibold px-2.5 py-1 rounded-full border ${badge.cls}`}>
                  {badge.label}
                </span>
                <div>
                  <span className={`inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full border ${typeColor}`}>
                    {typeLabel}
                  </span>
                </div>
              </div>
            </div>

            {/* Info */}
            <div className="bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200 dark:border-zinc-800 rounded-xl divide-y divide-zinc-100 dark:divide-zinc-800">
              <InfoRow label="Pelanggan" value={order.customerName ?? '—'} />
              {order.tableNumber && <InfoRow label="No. Meja" value={order.tableNumber} />}
              <InfoRow label="Kasir" value={order.cashierName ?? '—'} />
            </div>

            {/* Items */}
            <div>
              <p className="text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-2">Item Pesanan</p>
              <div className="space-y-3">
                {order.items.map((item, i) => (
                  <div key={i} className="flex justify-between items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className="text-xs font-bold text-orange-500 shrink-0">{item.quantity}x</span>
                        <span className="text-sm font-medium text-zinc-900 dark:text-white leading-snug">{item.productName}</span>
                      </div>
                      {item.notes && (
                        <p className="text-xs text-zinc-400 italic pl-5 mt-0.5">! {item.notes}</p>
                      )}
                    </div>
                    <span className="text-sm font-semibold text-zinc-900 dark:text-white shrink-0">
                      {formatRupiah(item.price * item.quantity)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Order notes */}
            {order.notes && (
              <div className="bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3">
                <p className="text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1">Catatan</p>
                <p className="text-sm text-zinc-700 dark:text-zinc-300">{order.notes}</p>
              </div>
            )}

            {/* Price breakdown */}
            <div className="bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                <PriceRow label="Subtotal" value={formatRupiah(order.subtotal)} />
                {order.discount > 0 && <PriceRow label="Diskon" value={`- ${formatRupiah(order.discount)}`} cls="text-green-500" />}
                {order.taxAmount > 0 && <PriceRow label="Pajak" value={formatRupiah(order.taxAmount)} />}
              </div>
              <div className="flex justify-between items-center px-4 py-3 border-t border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-white/5">
                <span className="text-sm font-bold text-zinc-900 dark:text-white">Total</span>
                <span className="text-base font-bold text-orange-500 dark:text-orange-400">{formatRupiah(order.total)}</span>
              </div>
            </div>

            {/* Payment */}
            {order.paymentMethod && (
              <div className="flex items-center justify-between bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3">
                <span className="text-sm text-zinc-500 dark:text-zinc-400">Metode Pembayaran</span>
                <span className="text-sm font-semibold text-zinc-900 dark:text-white">
                  {PML[order.paymentMethod as PaymentMethod] ?? order.paymentMethod}
                </span>
              </div>
            )}

            {/* Reprint */}
            {order.status !== 'CANCELLED' && (
              <div className="flex gap-2">
                <button
                  onClick={() => printCustomerReceipt(buildPrintData(order, tenant))}
                  className="flex-1 h-9 rounded-xl text-xs font-medium border border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors flex items-center justify-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" /> Cetak Struk
                </button>
                <button
                  onClick={() => printKitchenTicket(buildPrintData(order, tenant))}
                  className="flex-1 h-9 rounded-xl text-xs font-medium border border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors flex items-center justify-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" /> Cetak Tiket
                </button>
              </div>
            )}

            {/* Actions */}
            {isActive && (
              <div className="flex gap-3">
                <button
                  onClick={handleSelesai}
                  disabled={isPending}
                  className="flex-1 h-10 rounded-xl text-sm font-semibold text-green-600 dark:text-green-400 border border-green-500/30 bg-green-500/5 hover:bg-green-500/15 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-40"
                >
                  <Check className="w-4 h-4" /> Selesai
                </button>
                {isAdmin && (
                  <button
                    {...handlers}
                    disabled={isPending}
                    className="relative overflow-hidden flex-1 h-10 rounded-xl text-sm font-semibold text-red-500 border border-red-500/30 bg-red-500/5 select-none disabled:opacity-40"
                    style={{ touchAction: 'none' }}
                  >
                    <div className="absolute inset-0 bg-red-500/25 transition-none" style={{ width: `${progress * 100}%` }} />
                    <span className="relative flex items-center justify-center gap-1.5">
                      <X className="w-4 h-4" />
                      {pressing ? 'Tahan...' : 'Batalkan'}
                    </span>
                  </button>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>

      <AnimatePresence>
        {showConfirm && (
          <CancelConfirm
            orderNumber={order.orderNumber}
            onConfirm={handleCancel}
            onCancel={() => setShowConfirm(false)}
          />
        )}
      </AnimatePresence>
    </>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center px-4 py-2.5">
      <span className="text-xs text-zinc-500 dark:text-zinc-400">{label}</span>
      <span className="text-xs font-semibold text-zinc-900 dark:text-white">{value}</span>
    </div>
  )
}

function PriceRow({ label, value, cls }: { label: string; value: string; cls?: string }) {
  return (
    <div className="flex justify-between items-center px-4 py-2.5">
      <span className="text-sm text-zinc-500 dark:text-zinc-400">{label}</span>
      <span className={`text-sm font-medium ${cls ?? 'text-zinc-900 dark:text-white'}`}>{value}</span>
    </div>
  )
}

// ─── Order Card (Antrian tab) ──────────────────────────────────────────────────

function OrderCard({
  order, isAdmin, onSelesai, onCancel, onClick,
}: {
  order: PesananOrder; isAdmin: boolean
  onSelesai: () => void; onCancel: () => void; onClick: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [showConfirm, setShowConfirm] = useState(false)
  const typeColor = TYPE_COLORS[order.type] ?? TYPE_COLORS.DINE_IN
  const typeLabel = ORDER_TYPE_LABELS[order.type as OrderType] ?? order.type

  const { progress, pressing, handlers } = useLongPress(() => setShowConfirm(true), isPending)

  function handleSelesai(e: React.MouseEvent) {
    e.stopPropagation()
    onSelesai()
    startTransition(async () => { await markOrderDelivered(order.id) })
  }

  function handleCancel() {
    setShowConfirm(false); onCancel()
    startTransition(async () => { await cancelOrder(order.id) })
  }

  return (
    <>
      <motion.div
        layout
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }}
        onClick={onClick}
        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden flex flex-col cursor-pointer hover:border-orange-500/40 hover:shadow-md transition-all"
      >
        <div className="bg-orange-500/10 border-b border-orange-500/20 px-4 py-3 text-center">
          <p className="text-xs font-medium text-orange-500 dark:text-orange-400 uppercase tracking-widest mb-0.5">Antrian</p>
          <p className="text-4xl font-black text-orange-500 dark:text-orange-400 leading-none tracking-wider">{order.queueNumber}</p>
        </div>

        <div className="px-3 pt-3 pb-2">
          <div className="flex items-center justify-between mb-2">
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${typeColor}`}>{typeLabel}</span>
            <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono">{formatTime(order.createdAt)}</span>
          </div>
          {order.customerName && (
            <p className="text-xs font-semibold text-zinc-900 dark:text-white mb-1 truncate">👤 {order.customerName}</p>
          )}
          {order.tableNumber && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">🪑 Meja {order.tableNumber}</p>
          )}
        </div>

        <div className="px-3 pb-3 space-y-1.5 border-t border-zinc-100 dark:border-zinc-800 pt-2 flex-1">
          {order.items.map((item, j) => (
            <div key={j}>
              <div className="flex items-baseline gap-2">
                <span className="text-xs font-bold text-orange-500 dark:text-orange-400 shrink-0">{item.quantity}x</span>
                <span className="text-xs font-medium text-zinc-800 dark:text-zinc-200 leading-snug">{item.productName}</span>
              </div>
              {item.notes && <p className="text-[10px] text-zinc-400 italic pl-6 leading-tight">! {item.notes}</p>}
            </div>
          ))}
          {order.notes && (
            <div className="mt-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400 italic">📝 {order.notes}</p>
            </div>
          )}
        </div>

        <div className="px-3 pb-3 flex gap-2" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={handleSelesai}
            disabled={isPending}
            className="flex-1 py-2 rounded-lg text-xs font-semibold text-green-600 dark:text-green-400 border border-green-500/30 bg-green-500/5 hover:bg-green-500/15 transition-colors flex items-center justify-center gap-1 disabled:opacity-40"
          >
            <Check className="w-3 h-3" /> Selesai
          </button>
          {isAdmin && (
            <button
              {...handlers}
              disabled={isPending}
              className="relative overflow-hidden flex-1 py-2 rounded-lg text-xs font-semibold text-red-500 border border-red-500/30 bg-red-500/5 select-none disabled:opacity-40"
              style={{ touchAction: 'none' }}
            >
              <div className="absolute inset-0 bg-red-500/25 transition-none" style={{ width: `${progress * 100}%` }} />
              <span className="relative flex items-center justify-center gap-1">
                <X className="w-3 h-3" />
                {pressing ? 'Tahan...' : 'Batalkan'}
              </span>
            </button>
          )}
        </div>
      </motion.div>

      <AnimatePresence>
        {showConfirm && (
          <CancelConfirm
            orderNumber={order.orderNumber}
            onConfirm={handleCancel}
            onCancel={() => setShowConfirm(false)}
          />
        )}
      </AnimatePresence>
    </>
  )
}

// ─── Riwayat Card ─────────────────────────────────────────────────────────────

function RiwayatCard({ order, index, onClick }: { order: PesananOrder; index: number; onClick: () => void }) {
  const typeColor = TYPE_COLORS[order.type] ?? TYPE_COLORS.DINE_IN
  const typeLabel = ORDER_TYPE_LABELS[order.type as OrderType] ?? order.type
  const isCancelled = order.status === 'CANCELLED'
  const badge = statusBadgeProps(order.status, order.isDelivered)

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      onClick={onClick}
      className={`bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden flex flex-col cursor-pointer hover:border-orange-500/40 hover:shadow-md transition-all ${isCancelled ? 'opacity-55' : ''}`}
    >
      <div className={`px-4 py-3 text-center border-b ${isCancelled ? 'bg-zinc-100 dark:bg-white/3 border-zinc-200 dark:border-zinc-700' : 'bg-orange-500/10 border-orange-500/20'}`}>
        <p className={`text-xs font-medium uppercase tracking-widest mb-0.5 ${isCancelled ? 'text-zinc-400 dark:text-zinc-600' : 'text-orange-500 dark:text-orange-400'}`}>Antrian</p>
        <p className={`text-4xl font-black leading-none tracking-wider ${isCancelled ? 'text-zinc-300 dark:text-zinc-600 line-through' : 'text-orange-500 dark:text-orange-400'}`}>
          {order.queueNumber}
        </p>
      </div>

      <div className="px-3 pt-3 pb-2 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${typeColor}`}>{typeLabel}</span>
          <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono">{formatTime(order.createdAt)}</span>
        </div>
        <span className={`inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full border ${badge.cls}`}>{badge.label}</span>
        {order.customerName
          ? <p className="text-xs font-semibold text-zinc-900 dark:text-white truncate">👤 {order.customerName}</p>
          : <p className="text-[10px] text-zinc-400 dark:text-zinc-600 italic">Tanpa nama pelanggan</p>
        }
        {order.tableNumber && (
          <p className="text-[10px] text-zinc-400 dark:text-zinc-500">🪑 Meja {order.tableNumber}</p>
        )}
      </div>

      <div className="px-3 pb-2 space-y-1.5 border-t border-zinc-100 dark:border-zinc-800 pt-2 flex-1">
        {order.items.map((item, j) => (
          <div key={j}>
            <div className="flex items-baseline gap-2">
              <span className="text-xs font-bold text-orange-500 dark:text-orange-400 shrink-0">{item.quantity}x</span>
              <span className="text-xs font-medium text-zinc-800 dark:text-zinc-200 leading-snug">{item.productName}</span>
            </div>
            {item.notes && <p className="text-[10px] text-zinc-400 italic pl-6 leading-tight">! {item.notes}</p>}
          </div>
        ))}
        {order.notes && (
          <div className="mt-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400 italic">📝 {order.notes}</p>
          </div>
        )}
      </div>

      <div className="px-3 pb-3 pt-2 border-t border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-zinc-900 dark:text-white">{formatRupiah(order.total)}</span>
          {order.paymentMethod && (
            <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium">
              {PML[order.paymentMethod as PaymentMethod] ?? order.paymentMethod}
            </span>
          )}
        </div>
        <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5">{order.orderNumber}</p>
      </div>
    </motion.div>
  )
}

// ─── Main Client ──────────────────────────────────────────────────────────────

export function PesananClient({ orders: initialOrders, userRole, tenant }: { orders: PesananOrder[]; userRole: string; tenant: TenantInfo }) {
  const [orders, setOrders] = useState(initialOrders)
  const [tab, setTab] = useState<'antrian' | 'riwayat'>('antrian')
  const [selectedOrder, setSelectedOrder] = useState<PesananOrder | null>(null)
  const isAdmin = userRole === 'ADMIN'

  useEffect(() => { setOrders(initialOrders) }, [initialOrders])

  const activeOrders = orders.filter((o) => o.status === 'COMPLETED' && !o.isDelivered)
  const riwayatOrders = [...orders].reverse()

  function handleSelesai(id: string) {
    setOrders((prev) => prev.map((o) => o.id === id ? { ...o, isDelivered: true } : o))
    window.dispatchEvent(new CustomEvent('antrian-update'))
  }

  function handleCancel(id: string) {
    setOrders((prev) => prev.map((o) => o.id === id ? { ...o, status: 'CANCELLED' } : o))
    window.dispatchEvent(new CustomEvent('antrian-update'))
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-white">Pesanan</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            {tab === 'antrian' ? `${activeOrders.length} pesanan aktif` : `${orders.length} pesanan hari ini`}
          </p>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="flex items-center gap-2 h-9 px-4 rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 text-sm font-medium hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      <div className="flex items-center gap-1 bg-zinc-100 dark:bg-white/5 rounded-xl p-1 mb-5 self-start">
        <button
          onClick={() => setTab('antrian')}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === 'antrian' ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
        >
          Antrian
          {activeOrders.length > 0 && (
            <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-orange-500 text-black text-[10px] font-bold leading-none">
              {activeOrders.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab('riwayat')}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === 'riwayat' ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
        >
          Riwayat Hari Ini
        </button>
      </div>

      {tab === 'antrian' ? (
        activeOrders.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center">
            <ClipboardList className="w-16 h-16 mb-4 text-zinc-300 dark:text-zinc-700" />
            <p className="text-lg font-medium text-zinc-500 dark:text-zinc-400">Tidak ada antrian aktif</p>
            <p className="text-sm text-zinc-400 dark:text-zinc-600 mt-1">Pesanan baru akan muncul di sini setelah kasir konfirmasi pembayaran</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              <AnimatePresence mode="popLayout">
                {activeOrders.map((order) => (
                  <OrderCard
                    key={order.id} order={order} isAdmin={isAdmin}
                    onSelesai={() => handleSelesai(order.id)}
                    onCancel={() => handleCancel(order.id)}
                    onClick={() => setSelectedOrder(order)}
                  />
                ))}
              </AnimatePresence>
            </div>
          </div>
        )
      ) : (
        riwayatOrders.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center">
            <History className="w-16 h-16 mb-4 text-zinc-300 dark:text-zinc-700" />
            <p className="text-lg font-medium text-zinc-500 dark:text-zinc-400">Belum ada pesanan hari ini</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {riwayatOrders.map((order, i) => (
                <RiwayatCard key={order.id} order={order} index={i} onClick={() => setSelectedOrder(order)} />
              ))}
            </div>
          </div>
        )
      )}

      <AnimatePresence>
        {selectedOrder && (
          <OrderDetailModal
            order={selectedOrder}
            isAdmin={isAdmin}
            tenant={tenant}
            onClose={() => setSelectedOrder(null)}
            onSelesai={() => handleSelesai(selectedOrder.id)}
            onCancel={() => handleCancel(selectedOrder.id)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
