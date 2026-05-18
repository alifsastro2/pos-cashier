'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'motion/react'
import {
  TrendingUp, ShoppingBag, CreditCard, Calendar,
  ArrowUp, ArrowDown, ChevronLeft, ChevronRight, Download,
  FileSpreadsheet, FileText, ChevronDown, Clock,
} from 'lucide-react'
import { formatRupiah } from '@/lib/utils/format'

type FilterMode = 'harian' | 'bulanan' | 'tahunan'
type BarStat    = { label: string; revenue: number; orders: number }
type TopProduct = { name: string; totalQty: number; totalRevenue: number }
type RecentOrder = {
  id: string
  orderNumber: string
  type: string
  status: string
  total: number
  createdAt: string
  customerName: string | null
  cashierName: string | null
  items: { quantity: number; product: { name: string } | null }[]
  payment: { method: string; status: string } | null
}

type TenantInfo = {
  name: string
  address: string | null
  logo: string | null
  phone: string | null
  instagram: string | null
}

interface LaporanClientProps {
  mode: FilterMode
  selectedMonth: string
  selectedYear: string
  currentMonth: string
  currentYear: string
  barStats: BarStat[]
  topProducts: TopProduct[]
  recentOrders: RecentOrder[]
  isAdmin?: boolean
  tenant: TenantInfo
  summary: {
    totalRevenue: number
    totalOrders: number
    avgOrderValue: number
    period: string
    revenueChange: number | null
    ordersChange: number | null
  }
}

const ORDER_TYPE_LABELS: Record<string, string> = {
  DINE_IN: 'Dine In', TAKE_AWAY: 'Take Away',
  GOFOOD: 'GoFood', GRABFOOD: 'GrabFood', SHOPEEFOOD: 'ShopeeFood',
}
const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: 'Tunai', QRIS: 'QRIS', TRANSFER: 'Transfer', GOPAY: 'GoPay', SHOPEEPAY: 'ShopeePay',
}
const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  PENDING:   { label: 'Menunggu', color: 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20' },
  COMPLETED: { label: 'Lunas',    color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' },
  CANCELLED: { label: 'Batal',    color: 'text-red-500 bg-red-500/10 border-red-500/20' },
}

const MONTHS_ID = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']

// ─── Bar Chart ────────────────────────────────────────────────────────────────

const CHART_HEIGHT = 96

function BarChart({ data }: { data: BarStat[] }) {
  const max = Math.max(...data.map((d) => d.revenue), 1)
  return (
    <div className="space-y-1.5">
      <div className="flex items-end gap-px" style={{ height: CHART_HEIGHT }}>
        {data.map((d, i) => {
          const px = d.revenue > 0 ? Math.max((d.revenue / max) * CHART_HEIGHT, 3) : 0
          return (
            <motion.div
              key={i}
              initial={{ height: 0 }}
              animate={{ height: px }}
              transition={{ delay: i * 0.012, type: 'spring', damping: 22, stiffness: 140 }}
              className="flex-1 rounded-t-sm bg-orange-500/50 hover:bg-orange-500 transition-colors cursor-pointer"
              title={`${d.label}: ${formatRupiah(d.revenue)} (${d.orders} transaksi)`}
            />
          )
        })}
      </div>
      <div className="flex">
        {data.map((d, i) => (
          <div key={i} className="flex-1 text-center">
            {(i === 0 || i === Math.floor(data.length / 2) || i === data.length - 1) && (
              <span className="text-[9px] text-zinc-500 dark:text-zinc-400">{d.label}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Export Helpers ───────────────────────────────────────────────────────────

function orderRows(orders: RecentOrder[]) {
  return orders.map((o) => {
    const d    = new Date(o.createdAt)
    const date = d.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' })
    const time = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    return {
      'No. Order':     o.orderNumber,
      'Tanggal':       date,
      'Waktu':         time,
      'Tipe Pesanan':  ORDER_TYPE_LABELS[o.type] ?? o.type,
      'Pelanggan':     o.customerName ?? '—',
      'Kasir':         o.cashierName  ?? '—',
      'Item':          o.items.map((it) => `${it.quantity}x ${it.product?.name ?? '?'}`).join('; '),
      'Metode Bayar':  o.payment ? (PAYMENT_METHOD_LABELS[o.payment.method] ?? o.payment.method) : '—',
      'Status':        STATUS_LABELS[o.status]?.label ?? o.status,
      'Total (Rp)':    o.total,
    }
  })
}

async function exportExcel(
  orders: RecentOrder[],
  topProducts: TopProduct[],
  summary: { totalRevenue: number; totalOrders: number; avgOrderValue: number; period: string },
  period: string,
) {
  const { utils, writeFile } = await import('xlsx')

  const wb = utils.book_new()

  // Sheet 1: Ringkasan
  const summaryData = [
    ['Laporan', period],
    [],
    ['Total Pendapatan', summary.totalRevenue],
    ['Total Transaksi',  summary.totalOrders],
    ['Rata-rata Transaksi', summary.avgOrderValue],
    [],
    ['Produk Terlaris', '', ''],
    ['Nama Produk', 'Qty Terjual', 'Pendapatan (Rp)'],
    ...topProducts.map((p) => [p.name, p.totalQty, p.totalRevenue]),
  ]
  utils.book_append_sheet(wb, utils.aoa_to_sheet(summaryData), 'Ringkasan')

  // Sheet 2: Transaksi
  const txSheet = utils.json_to_sheet(orderRows(orders))
  utils.book_append_sheet(wb, txSheet, 'Transaksi')

  writeFile(wb, `laporan-${period.replace(/[\s/,]/g, '-').toLowerCase()}.xlsx`)
}

function exportPDF(
  orders: RecentOrder[],
  topProducts: TopProduct[],
  summary: { totalRevenue: number; totalOrders: number; avgOrderValue: number; period: string },
  tenant: TenantInfo,
) {
  const fmt       = formatRupiah
  const generated = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  const txRows = orders.map((o, i) => {
    const d     = new Date(o.createdAt)
    const date  = d.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' })
    const time  = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    const items = o.items.map((it) => `${it.quantity}× ${it.product?.name ?? '?'}`).join(', ')
    const method = o.payment ? (PAYMENT_METHOD_LABELS[o.payment.method] ?? o.payment.method) : '—'
    const type   = ORDER_TYPE_LABELS[o.type] ?? o.type
    const bg     = i % 2 === 0 ? '#ffffff' : '#fafafa'
    return `<tr style="background:${bg}">
      <td style="padding:7px 10px;border-bottom:1px solid #f0f0f0;font-size:10px;color:#374151">${o.orderNumber}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #f0f0f0;font-size:10px;color:#374151;white-space:nowrap">${date}<br><span style="color:#9ca3af;font-size:9px">${time}</span></td>
      <td style="padding:7px 10px;border-bottom:1px solid #f0f0f0;font-size:10px">
        <span style="background:#fff7ed;color:#c2410c;padding:2px 7px;border-radius:20px;font-size:9px;font-weight:600;white-space:nowrap">${type}</span>
      </td>
      <td style="padding:7px 10px;border-bottom:1px solid #f0f0f0;font-size:10px;color:#374151">${o.customerName ?? '—'}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #f0f0f0;font-size:10px;color:#374151">${o.cashierName ?? '—'}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #f0f0f0;font-size:10px;color:#6b7280;max-width:180px">${items}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #f0f0f0;font-size:10px">
        <span style="background:#f0fdf4;color:#166534;padding:2px 7px;border-radius:20px;font-size:9px;font-weight:600">${method}</span>
      </td>
      <td style="padding:7px 10px;border-bottom:1px solid #f0f0f0;font-size:10px;text-align:right;font-weight:700;color:#111827;white-space:nowrap">${fmt(o.total)}</td>
    </tr>`
  }).join('')

  const topRows = topProducts.slice(0, 10).map((p, i) => {
    const maxQty = topProducts[0]?.totalQty || 1
    const pct    = Math.round((p.totalQty / maxQty) * 100)
    const bg     = i % 2 === 0 ? '#ffffff' : '#fafafa'
    return `<tr style="background:${bg}">
      <td style="padding:8px 10px;border-bottom:1px solid #f0f0f0;font-size:11px;color:#9ca3af;font-weight:600;width:32px">${i + 1}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #f0f0f0">
        <div style="font-size:11px;font-weight:600;color:#111827;margin-bottom:4px">${p.name}</div>
        <div style="height:5px;background:#fee2e2;border-radius:3px;overflow:hidden">
          <div style="height:5px;width:${pct}%;background:#f97316;border-radius:3px;print-color-adjust:exact;-webkit-print-color-adjust:exact"></div>
        </div>
      </td>
      <td style="padding:8px 10px;border-bottom:1px solid #f0f0f0;text-align:center;font-size:11px;font-weight:700;color:#f97316;white-space:nowrap">${p.totalQty}x</td>
      <td style="padding:8px 10px;border-bottom:1px solid #f0f0f0;text-align:right;font-size:11px;font-weight:700;color:#111827;white-space:nowrap">${fmt(p.totalRevenue)}</td>
    </tr>`
  }).join('')

  const html = `<!DOCTYPE html>
<html lang="id"><head>
<meta charset="utf-8"/>
<title>Laporan ${summary.period}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; color: #111827; background: #fff; }
  print-color-adjust: exact;
  -webkit-print-color-adjust: exact;
  @media print {
    * { print-color-adjust: exact !important; -webkit-print-color-adjust: exact !important; }
    body { margin: 0; }
    .no-print { display: none; }
    .page-break { page-break-before: always; }
  }
</style>
</head><body style="padding:32px 36px;max-width:1100px;margin:0 auto">

  <!-- KOP SURAT -->
  <div style="margin-bottom:24px;padding-bottom:20px;border-bottom:3px solid #f97316;print-color-adjust:exact;-webkit-print-color-adjust:exact">
    <div style="display:flex;align-items:flex-start;justify-content:space-between">
      <!-- Logo + Identitas Toko -->
      <div style="display:flex;align-items:center;gap:16px">
        ${tenant.logo
          ? `<img src="${tenant.logo}" alt="logo" style="width:64px;height:64px;object-fit:cover;border-radius:10px;border:1px solid #e5e7eb;print-color-adjust:exact;-webkit-print-color-adjust:exact" />`
          : `<div style="width:64px;height:64px;background:#f97316;border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0;print-color-adjust:exact;-webkit-print-color-adjust:exact">
               <span style="color:#000;font-size:28px;font-weight:900;line-height:1">${tenant.name.charAt(0).toUpperCase()}</span>
             </div>`
        }
        <div>
          <div style="font-size:22px;font-weight:800;color:#111827;letter-spacing:-0.5px;line-height:1.1">${tenant.name}</div>
          ${tenant.address ? `<div style="font-size:11px;color:#6b7280;margin-top:4px;max-width:320px;line-height:1.4">${tenant.address}</div>` : ''}
          <div style="display:flex;gap:16px;margin-top:5px">
            ${tenant.phone ? `<span style="font-size:10px;color:#9ca3af">☎ ${tenant.phone}</span>` : ''}
            ${tenant.instagram ? `<span style="font-size:10px;color:#9ca3af">@ ${tenant.instagram}</span>` : ''}
          </div>
        </div>
      </div>
      <!-- Judul Laporan -->
      <div style="text-align:right;flex-shrink:0">
        <div style="font-size:18px;font-weight:800;color:#111827;letter-spacing:-0.3px">Laporan Penjualan</div>
        <div style="font-size:12px;color:#f97316;font-weight:600;margin-top:2px">${summary.period}</div>
        <div style="font-size:10px;color:#9ca3af;margin-top:6px">Digenerate: ${generated}</div>
      </div>
    </div>
  </div>

  <!-- SUMMARY CARDS -->
  <div style="display:flex;gap:14px;margin-bottom:28px">
    <div style="flex:1;background:#fff7ed;border:1.5px solid #fed7aa;border-radius:12px;padding:16px;print-color-adjust:exact;-webkit-print-color-adjust:exact">
      <div style="font-size:10px;font-weight:600;color:#9a3412;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">Total Pendapatan</div>
      <div style="font-size:22px;font-weight:800;color:#111827;letter-spacing:-0.5px">${fmt(summary.totalRevenue)}</div>
      <div style="width:36px;height:3px;background:#f97316;border-radius:2px;margin-top:10px;print-color-adjust:exact;-webkit-print-color-adjust:exact"></div>
    </div>
    <div style="flex:1;background:#eff6ff;border:1.5px solid #bfdbfe;border-radius:12px;padding:16px;print-color-adjust:exact;-webkit-print-color-adjust:exact">
      <div style="font-size:10px;font-weight:600;color:#1e40af;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">Total Transaksi</div>
      <div style="font-size:22px;font-weight:800;color:#111827">${summary.totalOrders}</div>
      <div style="width:36px;height:3px;background:#3b82f6;border-radius:2px;margin-top:10px;print-color-adjust:exact;-webkit-print-color-adjust:exact"></div>
    </div>
    <div style="flex:1;background:#f0fdf4;border:1.5px solid #bbf7d0;border-radius:12px;padding:16px;print-color-adjust:exact;-webkit-print-color-adjust:exact">
      <div style="font-size:10px;font-weight:600;color:#166534;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">Rata-rata Transaksi</div>
      <div style="font-size:22px;font-weight:800;color:#111827">${fmt(summary.avgOrderValue)}</div>
      <div style="width:36px;height:3px;background:#22c55e;border-radius:2px;margin-top:10px;print-color-adjust:exact;-webkit-print-color-adjust:exact"></div>
    </div>
  </div>

  <!-- TWO COLUMNS: Top Products + Payment Breakdown -->
  <div style="display:flex;gap:14px;margin-bottom:28px">
    <!-- Top Products -->
    <div style="flex:1;border:1.5px solid #e5e7eb;border-radius:12px;overflow:hidden">
      <div style="background:#f97316;padding:12px 16px;print-color-adjust:exact;-webkit-print-color-adjust:exact">
        <div style="font-size:12px;font-weight:700;color:#000">Produk Terlaris</div>
        <div style="font-size:10px;color:#7c2d12;margin-top:1px">${summary.period}</div>
      </div>
      <table style="width:100%;border-collapse:collapse">
        <thead>
          <tr style="background:#fff7ed;print-color-adjust:exact;-webkit-print-color-adjust:exact">
            <th style="padding:8px 10px;font-size:10px;font-weight:600;color:#9a3412;text-align:left">#</th>
            <th style="padding:8px 10px;font-size:10px;font-weight:600;color:#9a3412;text-align:left">Produk</th>
            <th style="padding:8px 10px;font-size:10px;font-weight:600;color:#9a3412;text-align:center">Qty</th>
            <th style="padding:8px 10px;font-size:10px;font-weight:600;color:#9a3412;text-align:right">Pendapatan</th>
          </tr>
        </thead>
        <tbody>${topRows}</tbody>
      </table>
    </div>

    <!-- Payment Method Breakdown -->
    <div style="width:200px;border:1.5px solid #e5e7eb;border-radius:12px;overflow:hidden;flex-shrink:0">
      <div style="background:#1e293b;padding:12px 16px;print-color-adjust:exact;-webkit-print-color-adjust:exact">
        <div style="font-size:12px;font-weight:700;color:#fff">Metode Pembayaran</div>
        <div style="font-size:10px;color:#94a3b8;margin-top:1px">${orders.length} transaksi</div>
      </div>
      <div style="padding:12px 14px">
        ${(() => {
          const methodCount: Record<string, number> = {}
          for (const o of orders) {
            const m = o.payment?.method ?? 'UNKNOWN'
            methodCount[m] = (methodCount[m] ?? 0) + 1
          }
          const colors: Record<string, string> = {
            CASH: '#f97316', QRIS: '#8b5cf6', TRANSFER: '#3b82f6',
            GOPAY: '#22c55e', SHOPEEPAY: '#f43f5e',
          }
          return Object.entries(methodCount)
            .sort((a, b) => b[1] - a[1])
            .map(([method, count]) => {
              const pct  = Math.round((count / orders.length) * 100)
              const color = colors[method] ?? '#6b7280'
              const label = PAYMENT_METHOD_LABELS[method] ?? method
              return `<div style="margin-bottom:10px">
                <div style="display:flex;justify-content:space-between;margin-bottom:4px">
                  <span style="font-size:10px;font-weight:600;color:#374151">${label}</span>
                  <span style="font-size:10px;color:#6b7280">${count}x · ${pct}%</span>
                </div>
                <div style="height:6px;background:#f3f4f6;border-radius:3px;overflow:hidden;print-color-adjust:exact;-webkit-print-color-adjust:exact">
                  <div style="height:6px;width:${pct}%;background:${color};border-radius:3px;print-color-adjust:exact;-webkit-print-color-adjust:exact"></div>
                </div>
              </div>`
            }).join('')
        })()}
      </div>
    </div>
  </div>

  <!-- TRANSACTIONS TABLE -->
  <div style="border:1.5px solid #e5e7eb;border-radius:12px;overflow:hidden">
    <div style="background:#1e293b;padding:12px 16px;display:flex;align-items:center;justify-content:space-between;print-color-adjust:exact;-webkit-print-color-adjust:exact">
      <div style="font-size:12px;font-weight:700;color:#fff">Daftar Transaksi</div>
      <div style="font-size:10px;color:#94a3b8">${orders.length} transaksi · ${summary.period}</div>
    </div>
    <table style="width:100%;border-collapse:collapse">
      <thead>
        <tr style="background:#f8fafc;print-color-adjust:exact;-webkit-print-color-adjust:exact">
          <th style="padding:9px 10px;font-size:10px;font-weight:600;color:#374151;text-align:left;border-bottom:1.5px solid #e5e7eb">No. Order</th>
          <th style="padding:9px 10px;font-size:10px;font-weight:600;color:#374151;text-align:left;border-bottom:1.5px solid #e5e7eb">Waktu</th>
          <th style="padding:9px 10px;font-size:10px;font-weight:600;color:#374151;text-align:left;border-bottom:1.5px solid #e5e7eb">Tipe</th>
          <th style="padding:9px 10px;font-size:10px;font-weight:600;color:#374151;text-align:left;border-bottom:1.5px solid #e5e7eb">Pelanggan</th>
          <th style="padding:9px 10px;font-size:10px;font-weight:600;color:#374151;text-align:left;border-bottom:1.5px solid #e5e7eb">Kasir</th>
          <th style="padding:9px 10px;font-size:10px;font-weight:600;color:#374151;text-align:left;border-bottom:1.5px solid #e5e7eb">Item</th>
          <th style="padding:9px 10px;font-size:10px;font-weight:600;color:#374151;text-align:left;border-bottom:1.5px solid #e5e7eb">Metode</th>
          <th style="padding:9px 10px;font-size:10px;font-weight:600;color:#374151;text-align:right;border-bottom:1.5px solid #e5e7eb">Total</th>
        </tr>
      </thead>
      <tbody>${txRows}</tbody>
    </table>
    <!-- Footer row -->
    <div style="background:#f8fafc;padding:10px 16px;display:flex;justify-content:space-between;align-items:center;border-top:1.5px solid #e5e7eb;print-color-adjust:exact;-webkit-print-color-adjust:exact">
      <span style="font-size:10px;color:#6b7280">${orders.length} transaksi</span>
      <span style="font-size:12px;font-weight:800;color:#111827">Total: ${fmt(summary.totalRevenue)}</span>
    </div>
  </div>

  <!-- FOOTER -->
  <div style="margin-top:24px;padding-top:16px;border-top:1px solid #e5e7eb;display:flex;justify-content:space-between;align-items:center">
    <span style="font-size:10px;color:#9ca3af">${tenant.name} · Laporan ${summary.period}</span>
    <span style="font-size:10px;color:#9ca3af">DigitalBnB POS</span>
  </div>

<script>
  window.onload = function() {
    window.print()
    window.onafterprint = function() { window.close() }
  }
<\/script>
</body></html>`

  const win = window.open('', '_blank')
  if (!win) return
  win.document.write(html)
  win.document.close()
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ChangeTag({ value }: { value: number | null }) {
  if (value === null) return null
  const pos = value >= 0
  return (
    <span className={`flex items-center gap-0.5 text-xs font-medium ${pos ? 'text-emerald-500' : 'text-red-500'}`}>
      {pos ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
      {Math.abs(value).toFixed(1)}%
    </span>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function LaporanClient({
  mode, selectedMonth, selectedYear, currentMonth, currentYear,
  barStats, topProducts, recentOrders, isAdmin = false, summary, tenant,
}: LaporanClientProps) {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()
  const [activeTab, setActiveTab] = useState<'overview' | 'orders'>('overview')
  const [exportOpen, setExportOpen] = useState(false)
  const exportRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!exportOpen) return
    function handleClick(e: MouseEvent) {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) setExportOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [exportOpen])

  function navigate(updates: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString())
    Object.entries(updates).forEach(([k, v]) => params.set(k, v))
    startTransition(() => router.push(`/laporan?${params.toString()}`))
  }

  function setMode(m: FilterMode) { navigate({ filter: m }) }
  function shiftMonth(delta: number) {
    const [y, m] = selectedMonth.split('-').map(Number)
    const d = new Date(y, m - 1 + delta, 1)
    navigate({ filter: 'bulanan', month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` })
  }
  function shiftYear(delta: number) {
    navigate({ filter: 'tahunan', year: String(parseInt(selectedYear) + delta) })
  }

  const [selY, selM] = selectedMonth.split('-').map(Number)
  const chartTitle = mode === 'harian' ? 'Per Jam (Hari Ini)'
    : mode === 'bulanan' ? `Per Hari — ${MONTHS_ID[selM - 1]} ${selY}`
    : `Per Bulan — ${selectedYear}`

  const comparLabel = mode === 'harian' ? 'vs kemarin'
    : mode === 'bulanan' ? 'vs bulan lalu' : 'vs tahun lalu'

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-white">Laporan</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            {summary.period}
          </p>
        </div>

        {isAdmin && (
          <div className="flex flex-col items-end gap-2">
            <div className="flex gap-1 p-1 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl">
              {(['harian', 'bulanan', 'tahunan'] as FilterMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`h-7 px-3 rounded-lg text-xs font-medium transition-colors capitalize ${
                    mode === m ? 'bg-orange-500 text-black' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                  }`}
                >
                  {m.charAt(0).toUpperCase() + m.slice(1)}
                </button>
              ))}
            </div>

            {mode === 'bulanan' && (
              <div className="flex items-center gap-1">
                <button onClick={() => shiftMonth(-1)} className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <select
                  value={selectedMonth}
                  onChange={(e) => navigate({ filter: 'bulanan', month: e.target.value })}
                  className="h-7 px-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white text-xs focus:outline-none focus:border-orange-500"
                >
                  {Array.from({ length: 12 }, (_, i) => {
                    const val = `${selY}-${String(i + 1).padStart(2, '0')}`
                    return <option key={val} value={val}>{MONTHS_ID[i]} {selY}</option>
                  })}
                  {selY !== parseInt(currentYear) && Array.from({ length: 12 }, (_, i) => {
                    const val = `${currentYear}-${String(i + 1).padStart(2, '0')}`
                    return <option key={`cur-${val}`} value={val}>{MONTHS_ID[i]} {currentYear}</option>
                  })}
                </select>
                <button onClick={() => shiftMonth(1)} disabled={selectedMonth >= currentMonth} className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors disabled:opacity-30">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {mode === 'tahunan' && (
              <div className="flex items-center gap-1">
                <button onClick={() => shiftYear(-1)} className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <select
                  value={selectedYear}
                  onChange={(e) => navigate({ filter: 'tahunan', year: e.target.value })}
                  className="h-7 px-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white text-xs focus:outline-none focus:border-orange-500"
                >
                  {Array.from({ length: 5 }, (_, i) => {
                    const y = String(parseInt(currentYear) - i)
                    return <option key={y} value={y}>{y}</option>
                  })}
                </select>
                <button onClick={() => shiftYear(1)} disabled={selectedYear >= currentYear} className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors disabled:opacity-30">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label: 'Total Pendapatan', value: formatRupiah(summary.totalRevenue), icon: TrendingUp, change: summary.revenueChange, sub: comparLabel },
          { label: 'Total Transaksi',  value: summary.totalOrders.toString(),     icon: ShoppingBag, change: summary.ordersChange,  sub: comparLabel },
          { label: 'Rata-rata Transaksi', value: formatRupiah(summary.avgOrderValue), icon: CreditCard, change: null, sub: 'per transaksi' },
        ].map((card, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
            className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
                <card.icon className="w-4.5 h-4.5 text-orange-500" />
              </div>
              <ChangeTag value={card.change} />
            </div>
            <p className="text-lg font-bold text-zinc-900 dark:text-white mb-0.5">{card.value}</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{card.label}</p>
            <p className="text-xs text-zinc-400 dark:text-zinc-600 mt-0.5">{card.sub}</p>
          </motion.div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex gap-1 p-1 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl w-fit">
          {[{ key: 'overview', label: 'Ringkasan' }, { key: 'orders', label: 'Daftar Transaksi' }].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key as typeof activeTab)}
              className={`h-8 px-4 rounded-lg text-sm font-medium transition-colors ${
                activeTab === key ? 'bg-orange-500 text-black' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {recentOrders.length > 0 && (
          <div className="relative" ref={exportRef}>
            <button
              onClick={() => setExportOpen((v) => !v)}
              className="flex items-center gap-1.5 h-8 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 text-xs font-medium hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Export
              <ChevronDown className="w-3 h-3" />
            </button>
            <AnimatePresence>
              {exportOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.96 }}
                  transition={{ duration: 0.12 }}
                  className="absolute right-0 top-10 z-50 w-44 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl overflow-hidden"
                >
                  <button
                    onClick={() => { setExportOpen(false); exportExcel(recentOrders, topProducts, summary, summary.period) }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-green-500" />
                    Export Excel (.xlsx)
                  </button>
                  <button
                    onClick={() => { setExportOpen(false); exportPDF(recentOrders, topProducts, summary, tenant) }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                  >
                    <FileText className="w-4 h-4 text-red-500" />
                    Export PDF
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-2 gap-4 flex-1 overflow-y-auto pb-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-white mb-0.5">{chartTitle}</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">{formatRupiah(summary.totalRevenue)} total</p>
            {barStats.some((d) => d.revenue > 0) ? (
              <BarChart data={barStats} />
            ) : (
              <div className="flex items-center justify-center text-zinc-400 dark:text-zinc-600 text-sm" style={{ height: CHART_HEIGHT }}>
                Belum ada data
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-white mb-0.5">Produk Terlaris</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">{summary.period}</p>
            {topProducts.length === 0 ? (
              <div className="flex items-center justify-center text-zinc-400 dark:text-zinc-600 text-sm" style={{ height: CHART_HEIGHT }}>
                Belum ada data
              </div>
            ) : (
              <div className="space-y-2.5">
                {topProducts.slice(0, 6).map((product, i) => {
                  const maxQty = topProducts[0].totalQty
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-xs text-zinc-400 dark:text-zinc-600 w-4 text-right shrink-0">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-zinc-900 dark:text-white truncate">{product.name}</span>
                          <span className="text-xs text-zinc-500 dark:text-zinc-400 ml-2 shrink-0">{product.totalQty}x</span>
                        </div>
                        <div className="h-1 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${(product.totalQty / maxQty) * 100}%` }}
                            transition={{ delay: i * 0.07, type: 'spring' }}
                            className="h-full bg-orange-500 rounded-full"
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Orders Tab */}
      {activeTab === 'orders' && (
        <div className="flex-1 overflow-y-auto pb-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden">
            <div className="grid grid-cols-[160px_1fr_80px_110px_90px] px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
              {['No. Order', 'Item', 'Tipe', 'Pembayaran', 'Total'].map((h) => (
                <span key={h} className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">{h}</span>
              ))}
            </div>
            {recentOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Clock className="w-10 h-10 text-zinc-300 dark:text-zinc-700 mb-3" />
                <p className="text-zinc-500 dark:text-zinc-400 text-sm">Belum ada transaksi</p>
              </div>
            ) : (
              recentOrders.map((order, i) => {
                const statusInfo = STATUS_LABELS[order.status] ?? STATUS_LABELS.PENDING
                const d = new Date(order.createdAt)
                const dateStr = d.toLocaleDateString('id-ID', {
                  day: '2-digit', month: 'short',
                  ...(mode !== 'harian' ? { year: 'numeric' } : {}),
                })
                const timeStr = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
                return (
                  <motion.div
                    key={order.id}
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                    className="grid grid-cols-[160px_1fr_80px_110px_90px] items-start px-4 py-3 border-b border-zinc-100 dark:border-zinc-800/50 last:border-0 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors"
                  >
                    {/* No. Order + meta */}
                    <div className="min-w-0 pr-2">
                      <p className="text-xs font-mono font-semibold text-zinc-900 dark:text-white truncate">{order.orderNumber}</p>
                      <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5">{dateStr} · {timeStr}</p>
                      {order.customerName && (
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 truncate">👤 {order.customerName}</p>
                      )}
                      {order.cashierName && (
                        <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5 truncate">🧑‍💼 {order.cashierName}</p>
                      )}
                    </div>

                    {/* Items */}
                    <div className="min-w-0 pr-2">
                      <p className="text-xs text-zinc-600 dark:text-zinc-300 truncate">
                        {order.items.map((it) => `${it.quantity}x ${it.product?.name ?? '?'}`).join(', ')}
                      </p>
                    </div>

                    {/* Tipe */}
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                      {ORDER_TYPE_LABELS[order.type] ?? order.type}
                    </span>

                    {/* Pembayaran + status */}
                    <div>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        {order.payment ? (PAYMENT_METHOD_LABELS[order.payment.method] ?? order.payment.method) : '—'}
                      </p>
                      <span className={`inline-flex mt-1 text-[10px] px-1.5 py-0.5 rounded border font-medium ${statusInfo.color}`}>
                        {statusInfo.label}
                      </span>
                    </div>

                    {/* Total */}
                    <span className="text-sm font-semibold text-orange-500 dark:text-orange-400">
                      {formatRupiah(order.total)}
                    </span>
                  </motion.div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
