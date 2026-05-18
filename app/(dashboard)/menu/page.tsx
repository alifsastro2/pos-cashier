import { verifySession } from '@/lib/dal'
import { prisma } from '@/lib/prisma'
import { MenuManager } from '@/components/menu/menu-manager'

export const metadata = { title: 'Menu & Produk — DigitalBnB POS' }

export default async function MenuPage() {
  const session = await verifySession()

  const [products, categories] = await Promise.all([
    prisma.product.findMany({
      where: { tenantId: session.tenantId },
      include: { category: { select: { id: true, name: true, icon: true } } },
      orderBy: [{ category: { sortOrder: 'asc' } }, { name: 'asc' }],
    }),
    prisma.category.findMany({
      where: { tenantId: session.tenantId },
      include: { _count: { select: { products: true } } },
      orderBy: { sortOrder: 'asc' },
    }),
  ])

  return (
    <div className="flex flex-col h-full p-6">
      <MenuManager products={products} categories={categories} />
    </div>
  )
}
