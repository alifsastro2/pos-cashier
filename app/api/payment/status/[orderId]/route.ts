import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { getTransactionStatus } from '@/lib/midtrans'

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { orderId } = await params

  const tenant = await prisma.tenant.findUnique({
    where: { id: session.tenantId },
    select: { midtransServerKey: true, midtransIsProduction: true },
  })

  if (!tenant?.midtransServerKey) {
    return NextResponse.json({ error: 'Payment gateway tidak dikonfigurasi' }, { status: 422 })
  }

  try {
    const status = await getTransactionStatus(
      tenant.midtransServerKey,
      tenant.midtransIsProduction,
      orderId,
    )
    return NextResponse.json({
      transactionStatus: status.transaction_status,
      fraudStatus: status.fraud_status,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Status check error'
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
