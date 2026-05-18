'use server'

import { revalidatePath } from 'next/cache'
import { verifySession } from '@/lib/dal'
import { prisma } from '@/lib/prisma'

export async function createProduct(formData: FormData) {
  const session = await verifySession()

  const name = formData.get('name') as string
  const description = formData.get('description') as string
  const price = parseFloat(formData.get('price') as string)
  const categoryId = formData.get('categoryId') as string
  const stock = formData.get('stock') ? parseInt(formData.get('stock') as string) : null

  if (!name || isNaN(price)) {
    return { error: 'Nama dan harga produk wajib diisi' }
  }

  const image = formData.get('image') as string | null

  await prisma.product.create({
    data: {
      name,
      description: description || null,
      price,
      image: image || null,
      categoryId: categoryId || null,
      stock,
      tenantId: session.tenantId,
    },
  })

  revalidatePath('/menu')
  return { success: true }
}

export async function updateProduct(id: string, formData: FormData) {
  const session = await verifySession()

  const name = formData.get('name') as string
  const description = formData.get('description') as string
  const price = parseFloat(formData.get('price') as string)
  const categoryId = formData.get('categoryId') as string
  const stock = formData.get('stock') ? parseInt(formData.get('stock') as string) : null
  const isActive = formData.get('isActive') === 'true'

  if (!name || isNaN(price)) {
    return { error: 'Nama dan harga produk wajib diisi' }
  }

  const image = formData.get('image') as string | null

  await prisma.product.updateMany({
    where: { id, tenantId: session.tenantId },
    data: {
      name,
      description: description || null,
      price,
      image: image || null,
      categoryId: categoryId || null,
      stock,
      isActive,
    },
  })

  revalidatePath('/menu')
  return { success: true }
}

export async function deleteProduct(id: string) {
  const session = await verifySession()

  await prisma.product.updateMany({
    where: { id, tenantId: session.tenantId },
    data: { isActive: false },
  })

  revalidatePath('/menu')
  return { success: true }
}

export async function toggleProductActive(id: string, isActive: boolean) {
  const session = await verifySession()

  await prisma.product.updateMany({
    where: { id, tenantId: session.tenantId },
    data: { isActive },
  })

  revalidatePath('/menu')
  return { success: true }
}

export async function createCategory(formData: FormData) {
  const session = await verifySession()

  const name = formData.get('name') as string
  const icon = formData.get('icon') as string

  if (!name) {
    return { error: 'Nama kategori wajib diisi' }
  }

  const lastCategory = await prisma.category.findFirst({
    where: { tenantId: session.tenantId },
    orderBy: { sortOrder: 'desc' },
  })

  await prisma.category.create({
    data: {
      name,
      icon: icon || null,
      tenantId: session.tenantId,
      sortOrder: (lastCategory?.sortOrder ?? 0) + 1,
    },
  })

  revalidatePath('/menu')
  revalidatePath('/kategori')
  return { success: true }
}

export async function updateCategory(id: string, formData: FormData) {
  const session = await verifySession()

  const name = formData.get('name') as string
  const icon = formData.get('icon') as string

  if (!name) {
    return { error: 'Nama kategori wajib diisi' }
  }

  await prisma.category.updateMany({
    where: { id, tenantId: session.tenantId },
    data: { name, icon: icon || null },
  })

  revalidatePath('/menu')
  revalidatePath('/kategori')
  return { success: true }
}

export async function deleteCategory(id: string) {
  const session = await verifySession()

  // Unlink products from this category first
  await prisma.product.updateMany({
    where: { categoryId: id, tenantId: session.tenantId },
    data: { categoryId: null },
  })

  await prisma.category.deleteMany({
    where: { id, tenantId: session.tenantId },
  })

  revalidatePath('/menu')
  revalidatePath('/kategori')
  return { success: true }
}
