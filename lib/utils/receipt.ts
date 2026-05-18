import type { CartItem, OrderType, PaymentMethod } from '@/types/pos'
import { ORDER_TYPE_LABELS, PAYMENT_METHOD_LABELS } from '@/types/pos'

export type PrintReceiptsInput = {
  tenantName: string
  tenantAddress?: string | null
  tenantInstagram?: string | null
  tenantReceiptFooter?: string | null
  orderNumber: string
  queueNumber: string
  orderType: string
  customerName?: string | null
  tableNumber?: string | null
  cashierName: string
  cart: CartItem[]
  notes?: string | null
  subtotal: number
  taxAmount: number
  taxRate: number
  discount: number
  total: number
  paymentMethod: string
  cashReceived?: number
  change?: number
}

function rp(n: number) {
  return n.toLocaleString('id-ID')
}

function nowDateTime() {
  const d = new Date()
  const MONTHS = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']
  const date = `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const ss = String(d.getSeconds()).padStart(2, '0')
  return { date, time: `${hh}:${mm}:${ss}` }
}

const css = `
  @page { size: 80mm auto; margin: 3mm 2mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Courier New', monospace; font-size: 11px; color: #000; width: 100%; }
  .c  { text-align: center; }
  .b  { font-weight: bold; }
  .sep  { border-top: 1px dashed #000; margin: 4px 0; }
  .sep2 { border-top: 1px solid  #000; margin: 4px 0; }
  .row { display: flex; justify-content: space-between; align-items: baseline; margin: 1px 0; }
  .note { padding-left: 12px; font-style: italic; color: #333; }
  .pb { page-break-after: always; }
  .item-row { display: flex; align-items: baseline; margin: 3px 0; }
  .qty  { width: 22px; font-weight: bold; flex-shrink: 0; }
  .name { flex: 1; min-width: 0; }
  .price { margin-left: 6px; text-align: right; flex-shrink: 0; }
  .q-box { text-align:center; margin: 6px 0; }
  .q-num { font-size: 38px; font-weight: bold; letter-spacing: 6px; }
  .q-lbl { font-size: 13px; font-weight: bold; }
  .k-item { display:flex; align-items:baseline; margin: 5px 0; }
  .k-qty  { width: 26px; font-weight: bold; font-size: 13px; flex-shrink: 0; }
  .k-name { font-size: 13px; }
  .k-note { padding-left: 10px; font-style: italic; font-size: 11px; }
`

function buildReceiptHtml(input: PrintReceiptsInput, date: string, time: string): string {
  const orderLabel  = ORDER_TYPE_LABELS[input.orderType as OrderType] ?? input.orderType
  const methodLabel = PAYMENT_METHOD_LABELS[input.paymentMethod as PaymentMethod] ?? input.paymentMethod
  const isCash      = input.paymentMethod === 'CASH'

  const itemsHtml = input.cart.map(item => `
    <div class="item-row">
      <span class="qty">${item.quantity}x</span>
      <div class="name">
        <div>${item.name}</div>
        ${item.notes ? `<div class="note">* ${item.notes}</div>` : ''}
      </div>
      <span class="price">${rp(item.price * item.quantity)}</span>
    </div>
  `).join('')

  return `
    <div class="pb">
      <div class="c b" style="font-size:15px;margin-bottom:2px;">${input.tenantName}</div>
      ${input.tenantAddress ? `<div class="c" style="font-size:10px;margin-bottom:4px;">${input.tenantAddress}</div>` : ''}
      <div class="sep2"></div>
      <div class="row"><span>No. Order</span><span>${input.orderNumber}</span></div>
      <div class="row"><span>No. Antrian</span><span class="b">${input.queueNumber}</span></div>
      <div class="row"><span>Tanggal</span><span>${date}, ${time}</span></div>
      <div class="row"><span>Kasir</span><span>${input.cashierName}</span></div>
      <div class="row"><span>Tipe</span><span>${orderLabel}</span></div>
      ${input.customerName ? `<div class="row"><span>Pelanggan</span><span>${input.customerName}</span></div>` : ''}
      ${input.tableNumber  ? `<div class="row"><span>No. Meja</span><span class="b">${input.tableNumber}</span></div>` : ''}
      <div class="sep"></div>
      <div class="row b" style="font-size:10px;"><span>ITEM</span><span>HARGA</span></div>
      <div class="sep"></div>
      ${itemsHtml}
      <div class="sep"></div>
      <div class="row"><span>Subtotal</span><span>${rp(input.subtotal)}</span></div>
      ${input.taxAmount > 0 ? `<div class="row"><span>Pajak (${input.taxRate}%)</span><span>${rp(input.taxAmount)}</span></div>` : ''}
      ${input.discount > 0 ? `<div class="row"><span>Diskon</span><span>-${rp(input.discount)}</span></div>` : ''}
      <div class="sep2"></div>
      <div class="row b" style="font-size:14px;"><span>TOTAL</span><span>${rp(input.total)}</span></div>
      <div class="sep"></div>
      ${isCash && input.cashReceived ? `
        <div class="row"><span>${methodLabel}</span><span>${rp(input.cashReceived)}</span></div>
        <div class="row"><span>Kembalian</span><span>${rp(input.change ?? 0)}</span></div>
      ` : `
        <div class="row"><span>Pembayaran</span><span>${methodLabel}</span></div>
      `}
      <div class="sep2"></div>
      <div class="c" style="margin-top:6px;">${input.tenantReceiptFooter || 'Terima kasih!'}</div>
      ${input.tenantInstagram ? `<div class="c" style="font-size:10px;">Instagram: @${input.tenantInstagram.replace('@', '')}</div>` : ''}
    </div>
  `
}

function buildKitchenHtml(input: PrintReceiptsInput, date: string, time: string): string {
  const orderLabel = ORDER_TYPE_LABELS[input.orderType as OrderType] ?? input.orderType

  const kItemsHtml = input.cart.map(item => `
    <div class="k-item">
      <span class="k-qty">${item.quantity}x</span>
      <div>
        <div class="k-name">${item.name}</div>
        ${item.notes ? `<div class="k-note">! ${item.notes}</div>` : ''}
      </div>
    </div>
  `).join('')

  return `
    <div>
      <div class="sep2" style="margin-top:4px;"></div>
      <div class="q-box">
        <div class="q-lbl">*** ANTRIAN ***</div>
        <div class="q-num">${input.queueNumber}</div>
      </div>
      <div class="sep2"></div>
      <div class="row" style="margin:4px 0;">
        <span class="b" style="font-size:13px;">${orderLabel}</span>
        <span class="b" style="font-size:13px;">${time}</span>
      </div>
      ${input.customerName ? `<div style="margin-bottom:4px;">Pelanggan: <strong>${input.customerName}</strong></div>` : ''}
      ${input.tableNumber  ? `<div class="b" style="font-size:13px;margin-bottom:4px;">Meja: ${input.tableNumber}</div>` : ''}
      <div class="sep"></div>
      ${kItemsHtml}
      ${input.notes ? `<div class="sep"></div><div style="font-style:italic;">Catatan: ${input.notes}</div>` : ''}
      <div class="sep2"></div>
      <div class="row" style="font-size:10px;">
        <span>Kasir: ${input.cashierName}</span>
        <span>${date}</span>
      </div>
    </div>
  `
}

function printHtml(bodyHtml: string) {
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${css}</style></head><body>${bodyHtml}</body></html>`
  const iframe = document.createElement('iframe')
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;'
  document.body.appendChild(iframe)
  const doc = iframe.contentWindow?.document
  if (!doc) { document.body.removeChild(iframe); return }
  doc.open(); doc.write(html); doc.close()
  setTimeout(() => {
    iframe.contentWindow?.focus()
    iframe.contentWindow?.print()
    setTimeout(() => { try { document.body.removeChild(iframe) } catch { /* ignore */ } }, 1000)
  }, 300)
}

export function printCustomerReceipt(input: PrintReceiptsInput) {
  const { date, time } = nowDateTime()
  printHtml(buildReceiptHtml(input, date, time))
}

export function printKitchenTicket(input: PrintReceiptsInput) {
  const { date, time } = nowDateTime()
  printHtml(buildKitchenHtml(input, date, time))
}

export function printReceipts(input: PrintReceiptsInput) {
  const { date, time } = nowDateTime()
  printHtml(buildReceiptHtml(input, date, time) + buildKitchenHtml(input, date, time))
}
