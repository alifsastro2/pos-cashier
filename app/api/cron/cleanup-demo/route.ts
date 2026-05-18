import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const masterUser = await prisma.user.findUnique({
    where: { email: 'admin@alivecoffee.com' },
    select: { tenantId: true },
  })

  if (!masterUser) {
    return NextResponse.json({ error: 'Master user not found' }, { status: 500 })
  }

  const orders = await prisma.order.findMany({
    where: { tenantId: masterUser.tenantId },
    select: { id: true },
  })
  const orderIds = orders.map((o) => o.id)

  if (orderIds.length > 0) {
    await prisma.payment.deleteMany({ where: { orderId: { in: orderIds } } })
    await prisma.orderItem.deleteMany({ where: { orderId: { in: orderIds } } })
    await prisma.order.deleteMany({ where: { tenantId: masterUser.tenantId } })
  }

  return NextResponse.json({ deleted: orderIds.length, at: new Date().toISOString() })
}
