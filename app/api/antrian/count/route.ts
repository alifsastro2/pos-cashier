import { NextResponse } from 'next/server'
import { verifySession } from '@/lib/dal'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const session = await verifySession()
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const count = await prisma.order.count({
      where: { tenantId: session.tenantId, status: 'COMPLETED', isDelivered: false, createdAt: { gte: todayStart } },
    })
    return NextResponse.json({ count })
  } catch {
    return NextResponse.json({ count: 0 })
  }
}
