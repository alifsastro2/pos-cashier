'use server'

import { revalidatePath } from 'next/cache'
import { verifySession } from '@/lib/dal'
import { prisma } from '@/lib/prisma'

export async function updateSettings(formData: FormData) {
  const session = await verifySession()

  const name = formData.get('name') as string
  const address = formData.get('address') as string
  const phone = formData.get('phone') as string
  const email = formData.get('email') as string
  const instagram = formData.get('instagram') as string
  const taxRate = parseFloat(formData.get('taxRate') as string)

  if (!name) return { error: 'Nama toko wajib diisi' }
  if (isNaN(taxRate) || taxRate < 0 || taxRate > 100) return { error: 'Pajak harus antara 0–100%' }

  const logo = formData.get('logo') as string | null
  const accentColor = formData.get('accentColor') as string | null
  const theme = formData.get('theme') as string | null
  const receiptFooter = (formData.get('receiptFooter') as string)?.trim() || null

  await prisma.tenant.update({
    where: { id: session.tenantId },
    data: {
      name,
      address: address || null,
      phone: phone || null,
      email: email || null,
      instagram: instagram || null,
      taxRate,
      receiptFooter,
      ...(logo !== null ? { logo: logo || null } : {}),
      ...(accentColor ? { accentColor } : {}),
      ...(theme ? { theme } : {}),
    },
  })

  revalidatePath('/', 'layout')
  revalidatePath('/pengaturan')
  revalidatePath('/kasir')
  return { success: true }
}

export async function updateUserTheme(theme: string) {
  const session = await verifySession()
  await prisma.user.update({
    where: { id: session.userId },
    data: { theme },
  })
  revalidatePath('/', 'layout')
  revalidatePath('/pengaturan')
  return { success: true }
}

export async function updateAccentColor(accentColor: string) {
  const session = await verifySession()
  if (session.role !== 'ADMIN') return { error: 'Tidak diizinkan' }
  await prisma.tenant.update({
    where: { id: session.tenantId },
    data: { accentColor },
  })
  revalidatePath('/', 'layout')
  revalidatePath('/pengaturan')
  return { success: true }
}

export async function updateMidtransSettings(formData: FormData) {
  const session = await verifySession()
  if (session.role !== 'ADMIN') return { error: 'Tidak diizinkan' }
  if (session.isDemo) return { error: 'Pengaturan payment gateway tidak dapat diubah di mode demo' }

  const serverKey = (formData.get('midtransServerKey') as string)?.trim()
  const clientKey = (formData.get('midtransClientKey') as string)?.trim()
  const isProduction = formData.get('midtransIsProduction') === 'true'

  const data: Record<string, unknown> = { midtransIsProduction: isProduction }
  if (serverKey) data.midtransServerKey = serverKey
  if (clientKey) data.midtransClientKey = clientKey

  await prisma.tenant.update({ where: { id: session.tenantId }, data })
  revalidatePath('/pengaturan')
  return { success: true }
}

export async function updatePassword(formData: FormData) {
  const session = await verifySession()

  const currentPassword = formData.get('currentPassword') as string
  const newPassword = formData.get('newPassword') as string
  const confirmPassword = formData.get('confirmPassword') as string

  if (!currentPassword || !newPassword || !confirmPassword) {
    return { error: 'Semua field wajib diisi' }
  }
  if (newPassword !== confirmPassword) {
    return { error: 'Password baru tidak cocok' }
  }
  if (newPassword.length < 8) {
    return { error: 'Password minimal 8 karakter' }
  }

  const { default: bcrypt } = await import('bcryptjs')

  const user = await prisma.user.findUnique({ where: { id: session.userId } })
  if (!user) return { error: 'Pengguna tidak ditemukan' }

  const valid = await bcrypt.compare(currentPassword, user.password)
  if (!valid) return { error: 'Password saat ini tidak benar' }

  const hashed = await bcrypt.hash(newPassword, 10)
  await prisma.user.update({ where: { id: session.userId }, data: { password: hashed } })

  return { success: true }
}
