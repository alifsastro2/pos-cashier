'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { X, CheckCircle2, Loader2, User, Printer, Copy, QrCode } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { createOrder } from '@/app/actions/orders'
import { printCustomerReceipt, printKitchenTicket } from '@/lib/utils/receipt'
import type { PrintReceiptsInput } from '@/lib/utils/receipt'
import { formatRupiah } from '@/lib/utils/format'
import type { CartItem, OrderType, PaymentMethod } from '@/types/pos'
import { ORDER_TYPE_LABELS, PAYMENT_METHOD_LABELS as PML } from '@/types/pos'

type Props = {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  cart: CartItem[]
  orderType: OrderType
  subtotal: number
  taxAmount: number
  discount: number
  total: number
  notes: string
  customerName: string
  tenantName: string
  tenantLogo?: string | null
  tenantAddress?: string | null
  tenantInstagram?: string | null
  tenantReceiptFooter?: string | null
  taxRate: number
}

type ChargeResult = {
  transactionId: string
  orderId: string
  qrCodeUrl?: string
  midtransQrUrl?: string
  vaNumber?: string
  bank?: string
  expiresAt?: string
}

type PaymentPhase = 'init' | 'charging' | 'waiting' | 'expired'

const PAYMENT_METHODS: PaymentMethod[] = ['CASH', 'QRIS', 'TRANSFER']

const BANK_OPTIONS = [
  { value: 'bni', label: 'BNI' },
  { value: 'bri', label: 'BRI' },
  { value: 'permata', label: 'Permata' },
  { value: 'cimb', label: 'CIMB' },
] as const

type BankValue = (typeof BANK_OPTIONS)[number]['value']

const MONTHS_ID = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']

type OrderResult = {
  orderNumber: string
  customerName?: string | null
  tableNumber?: string | null
  queueNumber: string
  cashierName: string
  items: { product: { name: string }; quantity: number; price: number }[]
  total: number
  payment: { method: string; amount: number } | null
}

type PrintStep = 'receipt' | 'queue' | null

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Dashes() {
  return <div className="border-t border-dashed border-zinc-300 my-1.5" />
}
function SolidLine() {
  return <div className="border-t border-zinc-700 my-1.5" />
}
function PaperRow({
  left, right, bold, large,
}: { left: string; right: string; bold?: boolean; large?: boolean }) {
  return (
    <div className={`flex justify-between items-baseline leading-relaxed ${bold ? 'font-bold' : ''} ${large ? 'text-sm' : 'text-[11px]'}`}>
      <span>{left}</span>
      <span>{right}</span>
    </div>
  )
}

function rp(n: number) { return n.toLocaleString('id-ID') }

function formatCountdown(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function parseExpiryTime(timeStr: string): Date {
  if (timeStr.includes('T')) return new Date(timeStr)
  // Midtrans returns "YYYY-MM-DD HH:mm:ss" in WIB (UTC+7)
  return new Date(timeStr.replace(' ', 'T') + '+07:00')
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PaymentModal({
  open, onClose, onSuccess,
  cart, orderType, subtotal, taxAmount, discount, total, notes, customerName,
  tenantName, tenantAddress, tenantInstagram, tenantReceiptFooter, taxRate,
}: Props) {
  const [method, setMethod]             = useState<PaymentMethod>('CASH')
  const [cashReceived, setCashReceived] = useState('')
  const [tableNumber, setTableNumber]   = useState('')
  const [order, setOrder]               = useState<OrderResult | null>(null)
  const [printStep, setPrintStep]       = useState<PrintStep>(null)
  const [showConfirm, setShowConfirm]   = useState(false)
  const [isPending, startTransition]    = useTransition()

  // Midtrans state
  const [selectedBank, setSelectedBank] = useState<BankValue>('bni')
  const [paymentPhase, setPaymentPhase] = useState<PaymentPhase>('init')
  const [chargeResult, setChargeResult] = useState<ChargeResult | null>(null)
  const [midtransOrderId, setMidtransOrderId] = useState('')
  const [isCharging, setIsCharging] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [chargeError, setChargeError] = useState<string | null>(null)

  const isDineIn = orderType === 'DINE_IN'
  const isMidtransMethod = method === 'QRIS' || method === 'TRANSFER'

  const cashAmount  = parseFloat(cashReceived.replace(/\D/g, '')) || 0
  const change      = Math.max(0, cashAmount - total)
  const canConfirm  = method !== 'CASH' || cashAmount >= total

  const now        = new Date()
  const dateStr    = `${now.getDate()} ${MONTHS_ID[now.getMonth()]} ${now.getFullYear()}`
  const timeStr    = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`
  const orderLabel = ORDER_TYPE_LABELS[orderType as OrderType] ?? orderType
  const methodLabel = PML[method as PaymentMethod] ?? method

  // Keep createOrder args fresh without re-subscribing the polling effect
  const confirmPaymentRef = useRef<((txId: string) => void) | null>(null)
  confirmPaymentRef.current = (midtransTxId: string) => {
    startTransition(async () => {
      try {
        const result = await createOrder({
          cart, orderType, paymentMethod: method,
          subtotal, taxAmount, discount, total,
          notes, customerName,
          tableNumber: isDineIn ? tableNumber.trim() || undefined : undefined,
          midtransTransactionId: midtransTxId || undefined,
          midtransGatewayOrderId: midtransOrderId || undefined,
        })
        setOrder(result as unknown as OrderResult)
        setPrintStep('receipt')
        setPaymentPhase('init')
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Terjadi kesalahan'
        toast.error(msg, { duration: 5000 })
        setPaymentPhase('expired')
      }
    })
  }

  // Countdown timer
  useEffect(() => {
    if (paymentPhase !== 'waiting' || !chargeResult?.expiresAt) return
    const expiry = parseExpiryTime(chargeResult.expiresAt).getTime()
    const tick = () => {
      const remaining = Math.max(0, Math.floor((expiry - Date.now()) / 1000))
      setCountdown(remaining)
      if (remaining === 0) setPaymentPhase('expired')
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [paymentPhase, chargeResult?.expiresAt])

  // Midtrans payment polling
  useEffect(() => {
    if (paymentPhase !== 'waiting' || !midtransOrderId) return
    let active = true

    const poll = async () => {
      if (!active) return
      try {
        const res = await fetch(`/api/payment/status/${encodeURIComponent(midtransOrderId)}`)
        const data = await res.json()
        if (!active) return
        const status = data.transactionStatus as string
        if (status === 'settlement' || status === 'capture') {
          active = false
          confirmPaymentRef.current?.(chargeResult?.transactionId ?? '')
        } else if (['expire', 'cancel', 'deny', 'failure'].includes(status)) {
          setPaymentPhase('expired')
        }
      } catch { /* network error — keep polling */ }
    }

    poll()
    const interval = setInterval(poll, method === 'TRANSFER' ? 8000 : 3000)
    return () => { active = false; clearInterval(interval) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentPhase, midtransOrderId])

  async function handleCharge() {
    const tempId = `POS-${Date.now()}-${Math.floor(Math.random() * 1e6)}`
    setMidtransOrderId(tempId)
    setChargeError(null)
    setIsCharging(true)
    try {
      const res = await fetch('/api/payment/create-charge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentType: method,
          bank: method === 'TRANSFER' ? selectedBank : undefined,
          amount: total,
          orderId: tempId,
          customerName: customerName || 'Pelanggan',
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Gagal membuat charge')
      setChargeResult(data as ChargeResult)
      setPaymentPhase('waiting')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal menghubungi payment gateway'
      setChargeError(msg)
      toast.error(msg)
      setMidtransOrderId('')
    } finally {
      setIsCharging(false)
    }
  }

  function resetMidtrans() {
    setPaymentPhase('init')
    setChargeResult(null)
    setMidtransOrderId('')
    setChargeError(null)
  }

  function getPrintData(): PrintReceiptsInput | null {
    if (!order) return null
    return {
      tenantName, tenantAddress, tenantInstagram, tenantReceiptFooter,
      orderNumber: order.orderNumber,
      queueNumber: order.queueNumber,
      orderType,
      customerName: order.customerName,
      tableNumber: order.tableNumber,
      cashierName: order.cashierName,
      cart, notes, subtotal, taxAmount, taxRate, discount, total,
      paymentMethod: method,
      cashReceived: method === 'CASH' ? cashAmount : undefined,
      change: method === 'CASH' ? change : undefined,
    }
  }

  function handleClose() {
    if (order) onSuccess()
    setOrder(null)
    setPrintStep(null)
    setCashReceived('')
    setTableNumber('')
    setMethod('CASH')
    resetMidtrans()
    onClose()
  }

  function handleMethodChange(m: PaymentMethod) {
    setMethod(m)
    resetMidtrans()
  }

  function handleConfirm() {
    startTransition(async () => {
      try {
        const result = await createOrder({
          cart, orderType, paymentMethod: method,
          subtotal, taxAmount, discount, total,
          notes, customerName,
          tableNumber: isDineIn ? tableNumber.trim() || undefined : undefined,
          cashReceived: method === 'CASH' ? cashAmount : undefined,
        })
        setOrder(result as unknown as OrderResult)
        setPrintStep('receipt')
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Terjadi kesalahan, coba lagi.'
        toast.error(msg, { duration: 5000 })
      }
    })
  }

  // ── Receipt paper preview ─────────────────────────────────────────────────
  function ReceiptPaper() {
    if (!order) return null
    return (
      <div className="bg-white text-black rounded-lg border border-zinc-200 shadow-sm p-4 font-mono text-[11px] leading-relaxed">
        <div className="text-center font-bold text-sm mb-0.5">{tenantName}</div>
        {tenantAddress && (
          <div className="text-center text-[10px] mb-2 text-zinc-500">{tenantAddress}</div>
        )}
        <SolidLine />
        <PaperRow left="No. Order"   right={order.orderNumber} />
        <PaperRow left="No. Antrian" right={order.queueNumber} bold />
        <PaperRow left="Tanggal"     right={`${dateStr}, ${timeStr}`} />
        <PaperRow left="Kasir"       right={order.cashierName} />
        <PaperRow left="Tipe"        right={orderLabel} />
        {order.customerName && <PaperRow left="Pelanggan" right={order.customerName} />}
        {order.tableNumber  && <PaperRow left="No. Meja"  right={order.tableNumber} bold />}
        <Dashes />
        <div className="flex justify-between text-[10px] font-bold mb-1">
          <span>ITEM</span><span>HARGA</span>
        </div>
        <Dashes />
        {cart.map((item, i) => (
          <div key={i} className="mb-1">
            <div className="flex justify-between">
              <span>{item.quantity}x {item.name}</span>
              <span>{rp(item.price * item.quantity)}</span>
            </div>
            {item.notes && (
              <div className="pl-4 italic text-zinc-500 text-[10px]">* {item.notes}</div>
            )}
          </div>
        ))}
        <Dashes />
        <PaperRow left="Subtotal" right={rp(subtotal)} />
        {taxAmount > 0 && <PaperRow left={`Pajak (${taxRate}%)`} right={rp(taxAmount)} />}
        {discount  > 0 && <PaperRow left="Diskon" right={`-${rp(discount)}`} />}
        <SolidLine />
        <PaperRow left="TOTAL" right={rp(total)} bold large />
        <Dashes />
        {method === 'CASH' ? (
          <>
            <PaperRow left={methodLabel} right={rp(cashAmount)} />
            <PaperRow left="Kembalian"  right={rp(change)} />
          </>
        ) : (
          <PaperRow left="Pembayaran" right={methodLabel} />
        )}
        <SolidLine />
        <div className="text-center mt-2 text-[11px]">{tenantReceiptFooter || 'Terima kasih!'}</div>
        {tenantInstagram && (
          <div className="text-center text-[10px] text-zinc-500 mt-0.5">
            Instagram: @{tenantInstagram.replace('@', '')}
          </div>
        )}
      </div>
    )
  }

  // ── Queue ticket paper preview ─────────────────────────────────────────────
  function QueuePaper() {
    if (!order) return null
    return (
      <div className="bg-white text-black rounded-lg border border-zinc-200 shadow-sm p-4 font-mono text-[11px] leading-relaxed">
        <SolidLine />
        <div className="text-center my-3">
          <div className="text-xs font-bold tracking-widest">*** ANTRIAN ***</div>
          <div className="text-6xl font-black tracking-widest leading-tight my-2">
            {order.queueNumber}
          </div>
        </div>
        <SolidLine />
        <div className="flex justify-between text-sm font-bold my-1.5">
          <span>{orderLabel}</span>
          <span>{timeStr}</span>
        </div>
        {order.customerName && (
          <div className="text-[11px] mb-1">
            Pelanggan: <strong>{order.customerName}</strong>
          </div>
        )}
        {order.tableNumber && (
          <div className="text-sm font-bold mb-1.5">
            Meja: {order.tableNumber}
          </div>
        )}
        <Dashes />
        {cart.map((item, i) => (
          <div key={i} className="mb-1">
            <div className="flex gap-2 text-sm">
              <span className="font-bold w-6 shrink-0">{item.quantity}x</span>
              <span>{item.name}</span>
            </div>
            {item.notes && (
              <div className="pl-8 italic text-zinc-500 text-[10px]">! {item.notes}</div>
            )}
          </div>
        ))}
        {notes && (
          <>
            <Dashes />
            <div className="italic text-[11px]">Catatan: {notes}</div>
          </>
        )}
        <SolidLine />
        <div className="flex justify-between text-[10px] text-zinc-500">
          <span>Kasir: {order.cashierName}</span>
          <span>{dateStr}</span>
        </div>
      </div>
    )
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <>
    <AnimatePresence>
      {open && (
        <motion.div
          key="payment-modal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={(e) => e.target === e.currentTarget && !order && handleClose()}
        >
          <motion.div
            initial={{ scale: 0.95, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 20 }}
            className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-2xl w-full max-w-md overflow-hidden"
          >

            {/* ── 1. PAYMENT FORM ── */}
            {!order && (
              <>
                <div className="flex items-center justify-between p-5 border-b border-zinc-200 dark:border-white/8">
                  <div>
                    <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Konfirmasi Pembayaran</h2>
                    {customerName && (
                      <p className="text-sm text-orange-500 dark:text-orange-400 flex items-center gap-1.5 mt-0.5">
                        <User className="w-3.5 h-3.5" />
                        {customerName}
                      </p>
                    )}
                  </div>
                  <button onClick={handleClose} className="text-zinc-400 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-5 space-y-4">
                  <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-4 text-center">
                    <p className="text-zinc-500 dark:text-zinc-400 text-sm">Total Pembayaran</p>
                    <p className="text-3xl font-bold text-orange-500 dark:text-orange-400 mt-1">{formatRupiah(total)}</p>
                  </div>

                  {/* Payment method picker — hidden while waiting */}
                  {paymentPhase !== 'waiting' && (
                    <div>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-2 font-medium">Metode Pembayaran</p>
                      <div className="grid grid-cols-3 gap-2">
                        {PAYMENT_METHODS.map((m) => (
                          <button
                            key={m}
                            onClick={() => handleMethodChange(m)}
                            className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                              method === m
                                ? 'bg-orange-500 text-black'
                                : 'bg-zinc-100 dark:bg-white/5 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-white/10'
                            }`}
                          >
                            {PML[m]}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* CASH: amount input */}
                  {method === 'CASH' && (
                    <div>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-2 font-medium">Jumlah Uang Diterima</p>
                      <Input
                        type="number"
                        placeholder="Masukkan jumlah..."
                        value={cashReceived}
                        onChange={(e) => setCashReceived(e.target.value)}
                        className="bg-zinc-100 dark:bg-white/5 border-zinc-300 dark:border-white/10 text-zinc-900 dark:text-white h-11"
                        min={total}
                      />
                      {cashAmount > 0 && (
                        <div className="flex justify-between mt-2 px-1">
                          <span className="text-sm text-zinc-400">Kembalian:</span>
                          <span className={`text-sm font-semibold ${change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {formatRupiah(change)}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* QRIS: QR code flow */}
                  {method === 'QRIS' && (
                    <div className="rounded-xl border border-zinc-200 dark:border-white/10 overflow-hidden">

                      {/* ── Init ── */}
                      {paymentPhase === 'init' && (
                        <div className="p-6 flex flex-col items-center gap-3 text-center">
                          <div className="w-14 h-14 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
                            <QrCode className="w-7 h-7 text-orange-500" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Pembayaran QRIS</p>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                              Klik tombol di bawah untuk membuat QR Code
                            </p>
                          </div>
                          {chargeError && (
                            <p className="w-full text-xs text-red-500 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{chargeError}</p>
                          )}
                          <p className="text-[10px] text-zinc-400 dark:text-zinc-600">Powered by Midtrans</p>
                        </div>
                      )}

                      {/* ── Charging ── */}
                      {paymentPhase === 'charging' && (
                        <div className="flex flex-col items-center justify-center gap-3 p-10">
                          <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">Membuat QR Code...</p>
                        </div>
                      )}

                      {/* ── Waiting ── */}
                      {paymentPhase === 'waiting' && chargeResult?.qrCodeUrl && (
                        <>
                          {/* Orange header */}
                          <div className="bg-orange-500 px-4 py-3 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <QrCode className="w-4 h-4 text-black" />
                              <span className="text-sm font-bold text-black">Scan QRIS untuk Bayar</span>
                            </div>
                            {countdown > 0 && (
                              <span className="font-mono text-sm font-bold text-black/80 bg-black/10 px-2 py-0.5 rounded-md tabular-nums">
                                {formatCountdown(countdown)}
                              </span>
                            )}
                          </div>

                          {/* QR Code — white bg, no border-radius on image */}
                          <div className="bg-white flex justify-center items-center py-6 px-8">
                            {isPending ? (
                              <div className="flex flex-col items-center gap-3 py-8">
                                <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
                                <p className="text-sm text-zinc-500">Memproses pesanan...</p>
                              </div>
                            ) : (
                              <img
                                src={chargeResult.qrCodeUrl}
                                alt="QR Code Pembayaran"
                                className="w-52 h-52 block"
                              />
                            )}
                          </div>

                          {/* Info footer */}
                          <div className="bg-zinc-50 dark:bg-zinc-800/80 border-t border-zinc-200 dark:border-white/8 px-4 py-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-zinc-500 dark:text-zinc-400">Total Bayar</span>
                              <span className="text-sm font-bold text-zinc-900 dark:text-white">{formatRupiah(total)}</span>
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs text-zinc-500 dark:text-zinc-400 shrink-0">Order ID</span>
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="font-mono text-[11px] text-zinc-600 dark:text-zinc-400 truncate">{midtransOrderId}</span>
                                <button
                                  onClick={() => { navigator.clipboard.writeText(midtransOrderId); toast.success('Order ID disalin!') }}
                                  className="shrink-0 text-orange-500 hover:text-orange-600 transition-colors"
                                >
                                  <Copy className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                            {chargeResult.midtransQrUrl && (
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs text-zinc-500 dark:text-zinc-400 shrink-0">URL Simulator</span>
                                <button
                                  onClick={() => { navigator.clipboard.writeText(chargeResult.midtransQrUrl!); toast.success('URL disalin!') }}
                                  className="flex items-center gap-1 text-orange-500 hover:text-orange-600 transition-colors text-[11px] font-medium"
                                >
                                  <Copy className="w-3 h-3" /> Salin URL
                                </button>
                              </div>
                            )}
                            <div className="flex items-center justify-center gap-2 text-[11px] text-zinc-400 dark:text-zinc-500 pt-1.5 border-t border-zinc-200 dark:border-white/8">
                              <Loader2 className="w-3 h-3 animate-spin shrink-0" />
                              GoPay · OVO · Dana · DANA · m-Banking
                            </div>
                          </div>
                        </>
                      )}

                      {/* ── Expired ── */}
                      {paymentPhase === 'expired' && (
                        <div className="p-6 flex flex-col items-center gap-3 text-center">
                          <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                            <X className="w-5 h-5 text-red-500" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-red-500">QR Code Kadaluarsa</p>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Buat QR Code baru untuk melanjutkan</p>
                          </div>
                          {chargeError && (
                            <p className="w-full text-xs text-red-500 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{chargeError}</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* TRANSFER: bank picker + VA display */}
                  {method === 'TRANSFER' && (
                    <div className="space-y-3">
                      {(paymentPhase === 'init' || paymentPhase === 'expired') && (
                        <>
                          <div>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-2 font-medium">Pilih Bank</p>
                            <div className="grid grid-cols-4 gap-2">
                              {BANK_OPTIONS.map((b) => (
                                <button
                                  key={b.value}
                                  onClick={() => setSelectedBank(b.value)}
                                  className={`py-2 rounded-lg text-sm font-semibold transition-colors ${
                                    selectedBank === b.value
                                      ? 'bg-orange-500 text-black'
                                      : 'bg-zinc-100 dark:bg-white/5 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-white/10'
                                  }`}
                                >
                                  {b.label}
                                </button>
                              ))}
                            </div>
                          </div>
                          {paymentPhase === 'expired' && (
                            <p className="text-xs text-red-500 text-center">Nomor VA sudah kadaluarsa. Buat VA baru.</p>
                          )}
                          {chargeError && (
                            <p className="text-xs text-red-500 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 text-center">{chargeError}</p>
                          )}
                        </>
                      )}
                      {paymentPhase === 'charging' && (
                        <div className="flex justify-center p-8">
                          <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
                        </div>
                      )}
                      {paymentPhase === 'waiting' && chargeResult?.vaNumber && (
                        <div className="bg-zinc-50 dark:bg-white/5 rounded-xl border border-zinc-200 dark:border-white/10 p-4 space-y-3">
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-zinc-500 dark:text-zinc-400">Bank</span>
                            <span className="font-bold text-zinc-900 dark:text-white uppercase">
                              {chargeResult.bank}
                            </span>
                          </div>
                          <div>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">Nomor Virtual Account</p>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-lg font-bold text-zinc-900 dark:text-white tracking-wider flex-1">
                                {chargeResult.vaNumber}
                              </span>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(chargeResult.vaNumber!)
                                  toast.success('Nomor VA disalin!')
                                }}
                                className="text-orange-500 hover:text-orange-600 transition-colors"
                                title="Salin"
                              >
                                <Copy className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                          <div className="flex justify-between items-center text-sm border-t border-zinc-200 dark:border-white/10 pt-3">
                            <span className="text-zinc-500 dark:text-zinc-400">Total Bayar</span>
                            <span className="font-bold text-zinc-900 dark:text-white">{formatRupiah(total)}</span>
                          </div>
                          {isPending ? (
                            <div className="flex items-center justify-center gap-2 text-sm text-zinc-400 pt-1">
                              <Loader2 className="w-4 h-4 animate-spin text-orange-500" />
                              Memproses pesanan...
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-2 text-xs text-zinc-400 dark:text-zinc-500 pt-1">
                              <Loader2 className="w-3 h-3 animate-spin" />
                              Menunggu konfirmasi pembayaran...
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Table number — hidden while waiting for payment */}
                  {isDineIn && paymentPhase !== 'waiting' && (
                    <div>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-2 font-medium">
                        Nomor Meja <span className="text-zinc-400 dark:text-zinc-500 font-normal text-xs">(opsional)</span>
                      </p>
                      <Input
                        placeholder="Contoh: 1, 2A, VIP..."
                        value={tableNumber}
                        onChange={(e) => setTableNumber(e.target.value)}
                        className="bg-zinc-100 dark:bg-white/5 border-zinc-300 dark:border-white/10 text-zinc-900 dark:text-white h-11"
                        maxLength={10}
                      />
                    </div>
                  )}

                  {/* Bottom action buttons */}
                  {!isMidtransMethod && (
                    <Button
                      onClick={() => setShowConfirm(true)}
                      disabled={!canConfirm || isPending}
                      className="w-full h-11 bg-orange-500 hover:bg-orange-600 text-black font-semibold rounded-xl"
                    >
                      {isPending ? (
                        <span className="flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Memproses...
                        </span>
                      ) : `Konfirmasi Bayar ${formatRupiah(total)}`}
                    </Button>
                  )}

                  {isMidtransMethod && (paymentPhase === 'init' || paymentPhase === 'expired') && (
                    <Button
                      onClick={handleCharge}
                      disabled={isCharging}
                      className="w-full h-11 bg-orange-500 hover:bg-orange-600 text-black font-semibold rounded-xl"
                    >
                      {isCharging ? (
                        <span className="flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Memuat...
                        </span>
                      ) : method === 'QRIS'
                        ? (paymentPhase === 'expired' ? 'Buat QR Baru' : 'Buat QR Code')
                        : (paymentPhase === 'expired' ? 'Dapatkan VA Baru' : 'Dapatkan Nomor VA')}
                    </Button>
                  )}

                  {isMidtransMethod && paymentPhase === 'charging' && (
                    <Button disabled className="w-full h-11 rounded-xl">
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Menghubungi payment gateway...
                    </Button>
                  )}

                  {isMidtransMethod && paymentPhase === 'waiting' && !isPending && (
                    <Button
                      variant="outline"
                      onClick={resetMidtrans}
                      className="w-full h-11 rounded-xl text-zinc-600 dark:text-zinc-400"
                    >
                      Batalkan
                    </Button>
                  )}
                </div>
              </>
            )}

            {/* ── 2. RECEIPT PREVIEW ── */}
            {order && printStep === 'receipt' && (
              <>
                <div className="flex items-center justify-between p-5 border-b border-zinc-200 dark:border-white/8">
                  <div>
                    <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Preview Struk</h2>
                    <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">Langkah 1 dari 2</p>
                  </div>
                  <button
                    onClick={() => setPrintStep('queue')}
                    className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-4 max-h-[55vh] overflow-y-auto">
                  <ReceiptPaper />
                </div>

                <div className="p-4 border-t border-zinc-200 dark:border-white/8 flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setPrintStep('queue')}
                  >
                    Lewati
                  </Button>
                  <Button
                    className="flex-1 bg-orange-500 hover:bg-orange-600 text-black font-semibold"
                    onClick={() => {
                      const d = getPrintData()
                      if (d) printCustomerReceipt(d)
                      setPrintStep('queue')
                    }}
                  >
                    <Printer className="w-4 h-4 mr-1.5" />
                    Print Struk
                  </Button>
                </div>
              </>
            )}

            {/* ── 3. QUEUE TICKET PREVIEW ── */}
            {order && printStep === 'queue' && (
              <>
                <div className="flex items-center justify-between p-5 border-b border-zinc-200 dark:border-white/8">
                  <div>
                    <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Preview Tiket Antrian</h2>
                    <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">Langkah 2 dari 2</p>
                  </div>
                  <button
                    onClick={() => setPrintStep(null)}
                    className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-4 max-h-[55vh] overflow-y-auto">
                  <QueuePaper />
                </div>

                <div className="p-4 border-t border-zinc-200 dark:border-white/8 flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setPrintStep(null)}
                  >
                    Lewati
                  </Button>
                  <Button
                    className="flex-1 bg-orange-500 hover:bg-orange-600 text-black font-semibold"
                    onClick={() => {
                      const d = getPrintData()
                      if (d) printKitchenTicket(d)
                      setPrintStep(null)
                    }}
                  >
                    <Printer className="w-4 h-4 mr-1.5" />
                    Print Tiket Antrian
                  </Button>
                </div>
              </>
            )}

            {/* ── 4. SUCCESS SCREEN ── */}
            {order && printStep === null && (
              <div className="p-6">
                <div className="text-center mb-6">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 300 }}
                    className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/15 border border-green-500/30 mb-3"
                  >
                    <CheckCircle2 className="w-8 h-8 text-green-400" />
                  </motion.div>
                  <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Pembayaran Berhasil!</h2>
                  <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">{order.orderNumber}</p>
                  {order.customerName && (
                    <motion.div
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.15 }}
                      className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500/15 border border-orange-500/30"
                    >
                      <User className="w-4 h-4 text-orange-500 dark:text-orange-400" />
                      <span className="text-orange-600 dark:text-orange-300 font-semibold text-lg">{order.customerName}</span>
                    </motion.div>
                  )}
                  <div className="mt-3 flex items-center justify-center gap-2">
                    <span className="text-xs text-zinc-400 dark:text-zinc-500 font-mono bg-zinc-100 dark:bg-white/5 px-3 py-1 rounded-full">
                      Antrian #{order.queueNumber}
                    </span>
                    <span className="text-xs text-zinc-400 dark:text-zinc-500 font-mono bg-zinc-100 dark:bg-white/5 px-3 py-1 rounded-full">
                      {PML[order.payment?.method as PaymentMethod] ?? order.payment?.method ?? ''}
                    </span>
                  </div>
                </div>

                <Button
                  onClick={handleClose}
                  className="w-full bg-orange-500 hover:bg-orange-600 text-black font-semibold"
                >
                  Selesai
                </Button>
              </div>
            )}

          </motion.div>
        </motion.div>
      )}

    </AnimatePresence>

    {/* ── Confirm dialog (CASH only) ── */}
    <AnimatePresence>
      {showConfirm && (
        <motion.div
          key="confirm-dialog"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setShowConfirm(false)}
        >
          <motion.div
            initial={{ scale: 0.93, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.93, y: 12 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-sm p-6"
          >
            <h3 className="text-base font-bold text-zinc-900 dark:text-white mb-4 text-center">
              Konfirmasi Transaksi
            </h3>
            <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-4 text-center mb-4">
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">Total Pembayaran</p>
              <p className="text-3xl font-bold text-orange-500 dark:text-orange-400">{formatRupiah(total)}</p>
            </div>
            <div className="space-y-2 mb-5 text-sm">
              <div className="flex justify-between">
                <span className="text-zinc-500 dark:text-zinc-400">Metode</span>
                <span className="font-semibold text-zinc-900 dark:text-white">{methodLabel}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500 dark:text-zinc-400">Tipe Pesanan</span>
                <span className="font-semibold text-zinc-900 dark:text-white">{orderLabel}</span>
              </div>
              {method === 'CASH' && cashAmount > 0 && (
                <>
                  <div className="flex justify-between">
                    <span className="text-zinc-500 dark:text-zinc-400">Uang Diterima</span>
                    <span className="font-semibold text-zinc-900 dark:text-white">{formatRupiah(cashAmount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500 dark:text-zinc-400">Kembalian</span>
                    <span className="font-semibold text-green-500">{formatRupiah(change)}</span>
                  </div>
                </>
              )}
              {customerName && (
                <div className="flex justify-between">
                  <span className="text-zinc-500 dark:text-zinc-400">Pelanggan</span>
                  <span className="font-semibold text-zinc-900 dark:text-white">{customerName}</span>
                </div>
              )}
              {isDineIn && tableNumber && (
                <div className="flex justify-between">
                  <span className="text-zinc-500 dark:text-zinc-400">No. Meja</span>
                  <span className="font-semibold text-zinc-900 dark:text-white">{tableNumber}</span>
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setShowConfirm(false)}>
                Kembali
              </Button>
              <Button
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-black font-semibold"
                disabled={isPending}
                onClick={() => { setShowConfirm(false); handleConfirm() }}
              >
                {isPending ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Memproses...
                  </span>
                ) : 'Proses Pembayaran'}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
    </>
  )
}
