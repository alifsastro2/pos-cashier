import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

async function deleteDemoTenant(tenantId: string) {
  const orders = await prisma.order.findMany({ where: { tenantId }, select: { id: true } })
  const orderIds = orders.map((o) => o.id)

  if (orderIds.length > 0) {
    await prisma.payment.deleteMany({ where: { orderId: { in: orderIds } } })
    await prisma.orderItem.deleteMany({ where: { orderId: { in: orderIds } } })
    await prisma.order.deleteMany({ where: { tenantId } })
  }
  await prisma.product.deleteMany({ where: { tenantId } })
  await prisma.category.deleteMany({ where: { tenantId } })
  await prisma.user.deleteMany({ where: { tenantId } })
  await prisma.tenant.delete({ where: { id: tenantId } })
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Hapus semua demo tenant yang dibuat lebih dari 23 jam yang lalu
  const cutoff = new Date(Date.now() - 23 * 60 * 60 * 1000)
  const demoTenants = await prisma.tenant.findMany({
    where: { isDemoTenant: true, createdAt: { lt: cutoff } },
    select: { id: true },
  })

  for (const tenant of demoTenants) {
    await deleteDemoTenant(tenant.id)
  }

  return NextResponse.json({ deleted: demoTenants.length, at: new Date().toISOString() })
}
