import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { demoCategories, demoProducts, demoOrders } from '@/lib/demo-seed'

export const dynamic = 'force-dynamic'

const DEMO_TAX_RATE = 0.1

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const masterUser = await prisma.user.findUnique({
    where: { email: 'admin@alivecoffee.com' },
    select: { tenantId: true, id: true },
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

  // 4. Re-seed products via raw SQL — also track name → {id, price} for order seeding
  const productNameToInfo: Record<string, { id: string; price: number }> = {}
  const prodParams: unknown[] = []
  const prodPlaceholders: string[] = []
  let pi = 1
  for (const prod of demoProducts) {
    const newId = randomUUID()
    productNameToInfo[prod.name] = { id: newId, price: prod.price }
    const categoryId = prod.categoryName ? (categoryNameToId[prod.categoryName] ?? null) : null
    prodPlaceholders.push(`($${pi++}, $${pi++}, $${pi++}, $${pi++}, $${pi++}, $${pi++}, $${pi++}, $${pi++}, $${pi++}, NOW(), NOW())`)
    prodParams.push(
      newId,
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

  // 5. Re-seed demo orders with historical timestamps
  let ordersSeeded = 0
  for (let idx = 0; idx < demoOrders.length; idx++) {
    const template = demoOrders[idx]

    // Resolve product IDs and compute subtotal
    let subtotal = 0
    const resolvedItems: Array<{ productId: string; price: number; quantity: number }> = []
    let missingProduct = false
    for (const item of template.items) {
      const info = productNameToInfo[item.productName]
      if (!info) { missingProduct = true; break }
      subtotal += info.price * item.quantity
      resolvedItems.push({ productId: info.id, price: info.price, quantity: item.quantity })
    }
    if (missingProduct) continue

    const discount = template.discount ?? 0
    const taxAmount = Math.round((subtotal - discount) * DEMO_TAX_RATE)
    const total = subtotal - discount + taxAmount

    // Compute backdated timestamp
    const createdAt = new Date()
    createdAt.setDate(createdAt.getDate() - template.daysAgo)
    createdAt.setHours(createdAt.getHours() - (template.hoursAgo ?? 0), 0, 0, 0)

    const dateStr = createdAt.toISOString().slice(0, 10).replace(/-/g, '')
    const orderNumber = `ORD-${dateStr}-${String(idx + 1).padStart(6, '0')}`
    const orderId = randomUUID()
    const isDelivered = template.status === 'COMPLETED'

    await prisma.$executeRawUnsafe(
      `INSERT INTO "Order" (id, "orderNumber", status, type, subtotal, discount, tax, total, "customerName", "tableNumber", "isDelivered", notes, "tenantId", "cashierId", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $15)`,
      orderId,
      orderNumber,
      template.status,
      template.type,
      subtotal,
      discount,
      taxAmount,
      total,
      template.customerName ?? null,
      template.tableNumber ?? null,
      isDelivered,
      null,
      tenantId,
      masterUser.id,
      createdAt,
    )

    // Insert order items
    for (const item of resolvedItems) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "OrderItem" (id, quantity, price, discount, notes, "orderId", "productId")
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        randomUUID(), item.quantity, item.price, 0, null, orderId, item.productId,
      )
    }

    // Insert payment only for COMPLETED orders
    if (template.status === 'COMPLETED') {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "Payment" (id, amount, method, status, "transactionId", "gatewayData", "orderId", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)`,
        randomUUID(), total, template.paymentMethod, 'SUCCESS', null, null, orderId, createdAt,
      )
    }

    ordersSeeded++
  }

  return NextResponse.json({
    ok: true,
    ordersDeleted: orderIds.length,
    categoriesReseeded: demoCategories.length,
    productsReseeded: demoProducts.length,
    ordersSeeded,
    at: new Date().toISOString(),
  })
}
