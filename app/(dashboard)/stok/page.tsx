import { verifySession } from '@/lib/dal'
import { prisma } from '@/lib/prisma'
import { StockManager } from '@/components/stok/stock-manager'

export const metadata = { title: 'Stok — DigitalBnB POS' }

export default async function StokPage() {
  const session = await verifySession()

  const products = await prisma.product.findMany({
    where: { tenantId: session.tenantId },
    select: {
      id: true,
      name: true,
      stock: true,
      isActive: true,
      category: { select: { name: true, icon: true } },
    },
    orderBy: [{ category: { sortOrder: 'asc' } }, { name: 'asc' }],
  })

  return (
    <div className="flex flex-col h-full p-6">
      <StockManager products={products} />
    </div>
  )
}
