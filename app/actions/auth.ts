'use server'

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

  const { demoUserId, demoTenantId } = await prisma.$transaction(async (tx) => {
    const cloneTenant = await tx.tenant.create({
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

    const categoryIdMap: Record<string, string> = {}
    for (const cat of master.categories) {
      const newCat = await tx.category.create({
        data: { name: cat.name, icon: cat.icon, tenantId: cloneTenant.id, sortOrder: cat.sortOrder },
      })
      categoryIdMap[cat.id] = newCat.id
    }

    for (const product of master.products) {
      await tx.product.create({
        data: {
          name: product.name,
          description: product.description,
          price: product.price,
          image: product.image,
          stock: product.stock,
          isActive: product.isActive,
          categoryId: product.categoryId ? categoryIdMap[product.categoryId] : null,
          tenantId: cloneTenant.id,
        },
      })
    }

    const demoUser = await tx.user.create({
      data: {
        name: masterUser.name,
        email: `demo-${stamp}@demo.pos`,
        password: demoPassword,
        role: 'ADMIN',
        tenantId: cloneTenant.id,
        isActive: true,
      },
    })

    return { demoUserId: demoUser.id, demoTenantId: cloneTenant.id }
  })

  await createSession(demoUserId, demoTenantId, 'ADMIN', true)
  redirect('/kasir')
}

async function deleteDemoTenant(tenantId: string) {
  const orders = await prisma.order.findMany({ where: { tenantId }, select: { id: true } })
  const orderIds = orders.map((o) => o.id)

  await prisma.$transaction([
    prisma.payment.deleteMany({ where: { orderId: { in: orderIds } } }),
    prisma.orderItem.deleteMany({ where: { orderId: { in: orderIds } } }),
    prisma.order.deleteMany({ where: { tenantId } }),
    prisma.product.deleteMany({ where: { tenantId } }),
    prisma.category.deleteMany({ where: { tenantId } }),
    prisma.user.deleteMany({ where: { tenantId } }),
    prisma.tenant.delete({ where: { id: tenantId } }),
  ])
}

export async function logout() {
  const session = await getSession()
  if (session?.isDemo && session.tenantId) {
    await deleteDemoTenant(session.tenantId)
  }
  await deleteSession()
  redirect('/login')
}
