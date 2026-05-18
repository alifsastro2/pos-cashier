'use server'

import { revalidatePath } from 'next/cache'
import { verifySession } from '@/lib/dal'
import { prisma } from '@/lib/prisma'

export async function updateStock(productId: string, stock: number | null) {
  const session = await verifySession()

  await prisma.product.updateMany({
    where: { id: productId, tenantId: session.tenantId },
    data: { stock },
  })

  revalidatePath('/stok')
  return { success: true }
}
