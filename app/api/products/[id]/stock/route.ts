import { NextResponse } from 'next/server'
import { verifySession } from '@/lib/dal'
import { prisma } from '@/lib/prisma'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifySession()
    const { id } = await params
    const product = await prisma.product.findFirst({
      where: { id, tenantId: session.tenantId },
      select: { stock: true },
    })
    if (!product) return NextResponse.json({ stock: null }, { status: 404 })
    return NextResponse.json({ stock: product.stock })
  } catch {
    return NextResponse.json({ stock: null }, { status: 500 })
  }
}
