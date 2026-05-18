'use server'

import { revalidatePath } from 'next/cache'
import bcrypt from 'bcryptjs'
import { verifySession } from '@/lib/dal'
import { prisma } from '@/lib/prisma'

async function requireAdmin() {
  const session = await verifySession()
  if (session.role !== 'ADMIN') throw new Error('Akses ditolak')
  return session
}

export async function createUser(formData: FormData) {
  const session = await requireAdmin()

  const name = (formData.get('name') as string)?.trim()
  const email = (formData.get('email') as string)?.trim().toLowerCase()
  const password = formData.get('password') as string

  if (!name || !email || !password) return { error: 'Semua field wajib diisi' }
  if (password.length < 6) return { error: 'Password minimal 6 karakter' }

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) return { error: 'Email sudah terdaftar' }

  const hashed = await bcrypt.hash(password, 10)

  await prisma.user.create({
    data: { name, email, password: hashed, role: 'CASHIER', tenantId: session.tenantId, isActive: true },
  })

  revalidatePath('/staff')
}

export async function updateUser(id: string, formData: FormData) {
  const session = await requireAdmin()

  const name = (formData.get('name') as string)?.trim()
  const email = (formData.get('email') as string)?.trim().toLowerCase()

  if (!name || !email) return { error: 'Nama dan email wajib diisi' }

  const target = await prisma.user.findUnique({ where: { id } })
  if (!target || target.tenantId !== session.tenantId) return { error: 'User tidak ditemukan' }

  const conflict = await prisma.user.findUnique({ where: { email } })
  if (conflict && conflict.id !== id) return { error: 'Email sudah digunakan user lain' }

  await prisma.user.update({ where: { id }, data: { name, email } })
  revalidatePath('/staff')
}

export async function resetPassword(id: string, formData: FormData) {
  const session = await requireAdmin()

  const password = formData.get('password') as string
  if (!password || password.length < 6) return { error: 'Password minimal 6 karakter' }

  const target = await prisma.user.findUnique({ where: { id } })
  if (!target || target.tenantId !== session.tenantId) return { error: 'User tidak ditemukan' }

  const hashed = await bcrypt.hash(password, 10)
  await prisma.user.update({ where: { id }, data: { password: hashed } })
  revalidatePath('/staff')
}

export async function toggleUserActive(id: string) {
  const session = await requireAdmin()
  if (id === session.userId) return { error: 'Tidak bisa menonaktifkan akun sendiri' }

  const target = await prisma.user.findUnique({ where: { id } })
  if (!target || target.tenantId !== session.tenantId) return { error: 'User tidak ditemukan' }

  await prisma.user.update({ where: { id }, data: { isActive: !target.isActive } })
  revalidatePath('/staff')
}

export async function deleteUser(id: string) {
  const session = await requireAdmin()
  if (id === session.userId) return { error: 'Tidak bisa menghapus akun sendiri' }

  const target = await prisma.user.findUnique({ where: { id } })
  if (!target || target.tenantId !== session.tenantId) return { error: 'User tidak ditemukan' }

  await prisma.user.delete({ where: { id } })
  revalidatePath('/staff')
}
