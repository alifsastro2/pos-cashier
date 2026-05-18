import 'server-only'
import { cache } from 'react'
import { redirect } from 'next/navigation'
import { getSession } from './session'
import { prisma } from './prisma'

export const verifySession = cache(async () => {
  const session = await getSession()

  if (!session?.userId) {
    redirect('/login')
  }

  return {
    isAuth: true,
    userId: session.userId,
    tenantId: session.tenantId,
    role: session.role,
    isDemo: session.isDemo ?? false,
  }
})

export const getCurrentUser = cache(async () => {
  const session = await verifySession()

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      tenantId: true,
      theme: true,
      tenant: {
        select: {
          id: true,
          name: true,
          logo: true,
          slug: true,
          setupDone: true,
          taxRate: true,
          accentColor: true,
          theme: true,
          address: true,
          phone: true,
          instagram: true,
        },
      },
    },
  })

  return user
})
