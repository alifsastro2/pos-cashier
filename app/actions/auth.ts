'use server'

import bcrypt from 'bcryptjs'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { createSession, deleteSession } from '@/lib/session'

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

export async function logout() {
  await deleteSession()
  redirect('/login')
}
