'use server'

import { randomUUID } from 'crypto'
import bcrypt from 'bcryptjs'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { createSession, deleteSession, getSession } from '@/lib/session'

export type LoginState = {
  error?: string
  success?: boolean
} | undefined

export async function login(state: LoginState, formData: FormData): Promise<LoginState> {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!email || !password) {
    return { error: 'Email dan password wajib diisi.' }
  }

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
    include: { tenant: true },
  })

  if (!user || !user.isActive) {
    return { error: 'Email atau password tidak valid.' }
  }

  const isPasswordValid = await bcrypt.compare(password, user.password)

  if (!isPasswordValid) {
    return { error: 'Email atau password tidak valid.' }
  }

  await createSession(user.id, user.tenantId, user.role)

  redirect(user.tenant.setupDone ? '/kasir' : '/onboarding')
}

export async function loginDemo() {
  const masterUser = await prisma.user.findUnique({
    where: { email: 'admin@alivecoffee.com' },
    include: {
      tenant: {
        include: { categories: true, products: true },
      },
    },
  })

  if (!masterUser) redirect('/login')

  const master = masterUser.tenant
  const stamp  = Date.now()
  const demoPassword = await bcrypt.hash(`demo-${stamp}`, 10)

  let demoTenantId: string | null = null
  let demoUserId: string | null = null

  try {
    const cloneTenant = await prisma.tenant.create({
      data: {
        name: master.name,
        slug: `demo-${stamp}`,
        logo: master.logo,
        address: master.address,
        phone: master.phone,
        email: master.email,
        instagram: master.instagram,
        receiptFooter: master.receiptFooter,
        taxRate: master.taxRate,
        accentColor: master.accentColor,
        theme: master.theme,
        isActive: true,
        setupDone: true,
        isDemoTenant: true,
      },
    })
    demoTenantId = cloneTenant.id

    // Bulk-insert categories via raw SQL — bypasses Prisma's implicit transaction wrapper
    const categoryIdMap: Record<string, string> = {}
    if (master.categories.length > 0) {
      const catParams: unknown[] = []
      const catPlaceholders: string[] = []
      let ci = 1
      for (const cat of master.categories) {
        const newId = randomUUID()
        categoryIdMap[cat.id] = newId
        catPlaceholders.push(`($${ci++}, $${ci++}, $${ci++}, $${ci++}, $${ci++}, NOW(), NOW())`)
        catParams.push(newId, cat.name, cat.icon ?? null, cloneTenant.id, cat.sortOrder)
      }
      await prisma.$executeRawUnsafe(
        `INSERT INTO "Category" (id, name, icon, "tenantId", "sortOrder", "createdAt", "updatedAt") VALUES ${catPlaceholders.join(',')}`,
        ...catParams,
      )
    }

    // Bulk-insert products via raw SQL
    if (master.products.length > 0) {
      const prodParams: unknown[] = []
      const prodPlaceholders: string[] = []
      let pi = 1
      for (const product of master.products) {
        prodPlaceholders.push(`($${pi++}, $${pi++}, $${pi++}, $${pi++}, $${pi++}, $${pi++}, $${pi++}, $${pi++}, $${pi++}, NOW(), NOW())`)
        prodParams.push(
          randomUUID(),
          product.name,
          product.description ?? null,
          product.price,
          product.image ?? null,
          product.stock ?? null,
          product.isActive,
          product.categoryId ? (categoryIdMap[product.categoryId] ?? null) : null,
          cloneTenant.id,
        )
      }
      await prisma.$executeRawUnsafe(
        `INSERT INTO "Product" (id, name, description, price, image, stock, "isActive", "categoryId", "tenantId", "createdAt", "updatedAt") VALUES ${prodPlaceholders.join(',')}`,
        ...prodParams,
      )
    }

    const demoUser = await prisma.user.create({
      data: {
        name: masterUser.name,
        email: `demo-${stamp}@demo.pos`,
        password: demoPassword,
        role: 'ADMIN',
        tenantId: cloneTenant.id,
        isActive: true,
      },
    })
    demoUserId = demoUser.id
  } catch {
    if (demoTenantId) {
      await prisma.product.deleteMany({ where: { tenantId: demoTenantId } }).catch(() => {})
      await prisma.category.deleteMany({ where: { tenantId: demoTenantId } }).catch(() => {})
      await prisma.user.deleteMany({ where: { tenantId: demoTenantId } }).catch(() => {})
      await prisma.tenant.delete({ where: { id: demoTenantId } }).catch(() => {})
    }
    redirect('/login')
  }

  await createSession(demoUserId!, demoTenantId!, 'ADMIN', true)
  redirect('/kasir')
}

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

export async function logout() {
  const session = await getSession()
  if (session?.isDemo && session.tenantId) {
    await deleteDemoTenant(session.tenantId)
  }
  await deleteSession()
  redirect('/login')
}
