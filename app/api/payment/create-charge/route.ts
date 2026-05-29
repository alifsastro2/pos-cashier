import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { chargeQris, chargeVa } from '@/lib/midtrans'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { paymentType?: string; bank?: string; amount?: number; orderId?: string; customerName?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { paymentType, bank, amount, orderId, customerName } = body
  if (!paymentType || !amount || !orderId) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: session.tenantId },
    select: { midtransServerKey: true, midtransIsProduction: true },
  })

  if (!tenant?.midtransServerKey) {
    return NextResponse.json(
      { error: 'Payment gateway belum dikonfigurasi. Hubungi admin toko.' },
      { status: 422 },
    )
  }

  try {
    if (paymentType === 'QRIS') {
      const result = await chargeQris(
        tenant.midtransServerKey,
        tenant.midtransIsProduction,
        orderId,
        amount,
        customerName || 'Pelanggan',
      )
      return NextResponse.json(result)
    }

    if (paymentType === 'TRANSFER') {
      const validBanks = ['bni', 'bri', 'permata', 'cimb'] as const
      type ValidBank = (typeof validBanks)[number]
      const bankLower = bank?.toLowerCase() as ValidBank
      if (!validBanks.includes(bankLower)) {
        return NextResponse.json({ error: 'Bank tidak valid' }, { status: 400 })
      }
      const result = await chargeVa(
        tenant.midtransServerKey,
        tenant.midtransIsProduction,
        orderId,
        amount,
        customerName || 'Pelanggan',
        bankLower,
      )
      return NextResponse.json(result)
    }

    return NextResponse.json({ error: 'Tipe pembayaran tidak valid' }, { status: 400 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Payment gateway error'
    console.error('[payment/create-charge]', err)
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
