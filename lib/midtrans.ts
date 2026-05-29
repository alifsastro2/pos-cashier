import MidtransClient from 'midtrans-client'

export function createMidtransCore(serverKey: string, isProduction: boolean) {
  return new MidtransClient.CoreApi({
    isProduction,
    serverKey,
    clientKey: '',
  })
}

export type MidtransChargeResult = {
  transactionId: string
  orderId: string
  qrCodeUrl?: string        // QRIS display (QR server URL)
  midtransQrUrl?: string    // QRIS original Midtrans URL (for simulator)
  vaNumber?: string         // Virtual Account
  bank?: string             // VA bank name
  expiresAt?: string
}

export async function chargeQris(
  serverKey: string,
  isProduction: boolean,
  orderId: string,
  amount: number,
  customerName: string,
): Promise<MidtransChargeResult> {
  const core = createMidtransCore(serverKey, isProduction)
  const res = await core.charge({
    payment_type: 'qris',
    transaction_details: { order_id: orderId, gross_amount: Math.round(amount) },
    customer_details: { first_name: customerName || 'Pelanggan' },
    qris: { acquirer: 'gopay' },
  })
  const midtransQrUrl = res.actions?.find((a: { name: string; url: string }) => a.name === 'generate-qr-code')?.url
  return {
    transactionId: res.transaction_id,
    orderId: res.order_id,
    qrCodeUrl: res.qr_string
      ? `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(res.qr_string)}`
      : midtransQrUrl,
    midtransQrUrl,
    expiresAt: res.expiry_time,
  }
}

export async function chargeVa(
  serverKey: string,
  isProduction: boolean,
  orderId: string,
  amount: number,
  customerName: string,
  bank: 'bni' | 'bri' | 'permata' | 'cimb',
): Promise<MidtransChargeResult> {
  const core = createMidtransCore(serverKey, isProduction)
  const res = await core.charge({
    payment_type: 'bank_transfer',
    transaction_details: { order_id: orderId, gross_amount: Math.round(amount) },
    customer_details: { first_name: customerName || 'Pelanggan' },
    bank_transfer: { bank },
  })
  const vaArr: { bank: string; va_number: string }[] = res.va_numbers ?? []
  const va = vaArr[0]
  return {
    transactionId: res.transaction_id,
    orderId: res.order_id,
    vaNumber: va?.va_number ?? res.permata_va_number,
    bank: va?.bank ?? bank,
    expiresAt: res.expiry_time,
  }
}

export async function getTransactionStatus(serverKey: string, isProduction: boolean, orderId: string) {
  const core = createMidtransCore(serverKey, isProduction)
  return core.transaction.status(orderId)
}
