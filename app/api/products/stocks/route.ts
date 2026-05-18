import { NextResponse } from 'next/server'
import { verifySession } from '@/lib/dal'
import { prisma } from '@/lib/prisma'

// Returns { [productId]: stock } for all active products in the tenant
export async function GET() {
  try {
    const session = await verifySession()
    const products = await prisma.product.findMany({
      where: { tenantId: session.tenantId, isActive: true },
      select: { id: true, stock: true },
    })
    const result: Record<string, number | null> = {}
    for (const p of products) result[p.id] = p.stock
    return NextResponse.json(result)
  } catch {
    return NextResponse.json({}, { status: 500 })
  }
}
