import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  const masterUser = await prisma.user.findUnique({
    where: { email: 'admin@alivecoffee.com' },
    include: {
      tenant: {
        include: {
          categories: { orderBy: { sortOrder: 'asc' } },
          products: { orderBy: { name: 'asc' } },
        },
      },
    },
  })

  if (!masterUser) {
    return NextResponse.json({ error: 'Master user not found' }, { status: 404 })
  }

  const { categories, products } = masterUser.tenant

  return NextResponse.json({
    categories: categories.map((c) => ({
      name: c.name,
      icon: c.icon,
      sortOrder: c.sortOrder,
    })),
    products: products.map((p) => ({
      name: p.name,
      description: p.description,
      price: p.price,
      image: p.image,
      stock: p.stock,
      isActive: p.isActive,
      categoryName: categories.find((c) => c.id === p.categoryId)?.name ?? null,
    })),
  })
}
