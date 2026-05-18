import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { demoCategories, demoProducts } from '@/lib/demo-seed'

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
  const tenantId = masterUser.tenantId

  // 1. Delete all orders (cascade removes order items and payments)
  const orders = await prisma.order.findMany({ where: { tenantId }, select: { id: true } })
  const orderIds = orders.map((o) => o.id)
  if (orderIds.length > 0) {
    await prisma.payment.deleteMany({ where: { orderId: { in: orderIds } } })
    await prisma.orderItem.deleteMany({ where: { orderId: { in: orderIds } } })
    await prisma.order.deleteMany({ where: { tenantId } })
  }

  // 2. Delete all products then categories (order matters for FK)
  await prisma.product.deleteMany({ where: { tenantId } })
  await prisma.category.deleteMany({ where: { tenantId } })

  // 3. Re-seed categories via raw SQL (bypasses Prisma implicit transaction)
  const categoryNameToId: Record<string, string> = {}
  const catParams: unknown[] = []
  const catPlaceholders: string[] = []
  let ci = 1
  for (const cat of demoCategories) {
    const newId = randomUUID()
    categoryNameToId[cat.name] = newId
    catPlaceholders.push(`($${ci++}, $${ci++}, $${ci++}, $${ci++}, $${ci++}, NOW(), NOW())`)
    catParams.push(newId, cat.name, cat.icon ?? null, tenantId, cat.sortOrder)
  }
  await prisma.$executeRawUnsafe(
    `INSERT INTO "Category" (id, name, icon, "tenantId", "sortOrder", "createdAt", "updatedAt") VALUES ${catPlaceholders.join(',')}`,
    ...catParams,
  )

  // 4. Re-seed products via raw SQL
  const prodParams: unknown[] = []
  const prodPlaceholders: string[] = []
  let pi = 1
  for (const prod of demoProducts) {
    const categoryId = prod.categoryName ? (categoryNameToId[prod.categoryName] ?? null) : null
    prodPlaceholders.push(`($${pi++}, $${pi++}, $${pi++}, $${pi++}, $${pi++}, $${pi++}, $${pi++}, $${pi++}, $${pi++}, NOW(), NOW())`)
    prodParams.push(
      randomUUID(),
      prod.name,
      prod.description ?? null,
      prod.price,
      prod.image ?? null,
      prod.stock ?? null,
      prod.isActive,
      categoryId,
      tenantId,
    )
  }
  await prisma.$executeRawUnsafe(
    `INSERT INTO "Product" (id, name, description, price, image, stock, "isActive", "categoryId", "tenantId", "createdAt", "updatedAt") VALUES ${prodPlaceholders.join(',')}`,
    ...prodParams,
  )

  return NextResponse.json({
    ok: true,
    ordersDeleted: orderIds.length,
    categoriesReseeded: demoCategories.length,
    productsReseeded: demoProducts.length,
    at: new Date().toISOString(),
  })
}
