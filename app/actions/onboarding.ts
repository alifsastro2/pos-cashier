'use server'

import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { verifySession } from '@/lib/dal'

type OnboardingState = { error?: string } | undefined

export async function completeOnboarding(state: OnboardingState, formData: FormData): Promise<OnboardingState> {
  const session = await verifySession()

  const name = (formData.get('name') as string)?.trim()
  const address = (formData.get('address') as string)?.trim() || null
  const phone = (formData.get('phone') as string)?.trim() || null
  const taxRate = parseFloat(formData.get('taxRate') as string) || 0
  const logo = (formData.get('logo') as string)?.trim() || null

  if (!name) return { error: 'Nama toko wajib diisi.' }

  await prisma.tenant.update({
    where: { id: session.tenantId },
    data: { name, address, phone, taxRate, logo, setupDone: true },
  })

  redirect('/kasir')
}
