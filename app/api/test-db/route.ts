import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export const dynamic = 'force-dynamic'

export async function GET() {
  const results: Record<string, unknown> = {}

  try {
    results.tenants = await prisma.tenant.count()

    const masterUser = await prisma.user.findUnique({
      where: { email: 'admin@alivecoffee.com' },
      include: { tenant: { include: { categories: true, products: true } } },
    })
    results.masterFound = !!masterUser
    if (!masterUser) return NextResponse.json({ ...results, error: 'master user not found' })

    const master = masterUser.tenant
    const stamp  = Date.now()
    results.stamp = stamp

    // Test bcrypt
    const demoPassword = await bcrypt.hash(`demo-${stamp}`, 10)
    results.bcryptOk = true

    // Test $transaction
    const { demoUserId, demoTenantId } = await prisma.$transaction(async (tx) => {
      const cloneTenant = await tx.tenant.create({
        data: {
          name: master.name, slug: `test-${stamp}`, logo: master.logo,
          address: master.address, phone: master.phone, email: master.email,
          instagram: master.instagram, receiptFooter: master.receiptFooter,
          taxRate: master.taxRate, accentColor: master.accentColor,
          theme: master.theme, isActive: true, setupDone: true, isDemoTenant: true,
        },
      })
      const catMap: Record<string, string> = {}
      for (const c of master.categories) {
        const nc = await tx.category.create({ data: { name: c.name, icon: c.icon, tenantId: cloneTenant.id, sortOrder: c.sortOrder } })
        catMap[c.id] = nc.id
      }
      for (const p of master.products) {
        await tx.product.create({ data: { name: p.name, price: p.price, stock: p.stock, isActive: p.isActive, categoryId: p.categoryId ? catMap[p.categoryId] : null, tenantId: cloneTenant.id } })
      }
      const demoUser = await tx.user.create({ data: { name: 'Test Demo', email: `test-${stamp}@demo.pos`, password: demoPassword, role: 'ADMIN', tenantId: cloneTenant.id, isActive: true } })
      return { demoUserId: demoUser.id, demoTenantId: cloneTenant.id }
    })
    results.transactionOk = true
    results.demoTenantId = demoTenantId

    // Clean up immediately
    const orders = await prisma.order.findMany({ where: { tenantId: demoTenantId }, select: { id: true } })
    const orderIds = orders.map((o) => o.id)
    await prisma.$transaction([
      prisma.payment.deleteMany({ where: { orderId: { in: orderIds } } }),
      prisma.orderItem.deleteMany({ where: { orderId: { in: orderIds } } }),
      prisma.order.deleteMany({ where: { tenantId: demoTenantId } }),
      prisma.product.deleteMany({ where: { tenantId: demoTenantId } }),
      prisma.category.deleteMany({ where: { tenantId: demoTenantId } }),
      prisma.user.deleteMany({ where: { tenantId: demoTenantId } }),
      prisma.tenant.delete({ where: { id: demoTenantId } }),
    ])
    results.cleanupOk = true

    return NextResponse.json({ ok: true, ...results })
  } catch (error: unknown) {
    const err = error as Error & { code?: string; meta?: unknown }
    return NextResponse.json({ ok: false, ...results, name: err.name, message: err.message, code: err.code, meta: err.meta }, { status: 500 })
  }
}
