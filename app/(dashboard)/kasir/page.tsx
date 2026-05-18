import { verifySession } from '@/lib/dal'
import { prisma } from '@/lib/prisma'
import { PosInterface } from '@/components/pos/pos-interface'

export const metadata = { title: 'Kasir — DigitalBnB POS' }

export default async function KasirPage() {
  const session = await verifySession()

  const [products, categories, tenant] = await Promise.all([
    prisma.product.findMany({
      where: { tenantId: session.tenantId, isActive: true },
      include: { category: true },
      orderBy: [{ category: { sortOrder: 'asc' } }, { name: 'asc' }],
    }),
    prisma.category.findMany({
      where: { tenantId: session.tenantId },
      orderBy: { sortOrder: 'asc' },
    }),
    prisma.tenant.findUnique({
      where: { id: session.tenantId },
      select: { name: true, taxRate: true, logo: true, address: true, instagram: true, receiptFooter: true },
    }),
  ])

  return (
    <PosInterface
      products={products}
      categories={categories}
      tenantName={tenant?.name ?? ''}
      tenantLogo={tenant?.logo ?? null}
      tenantAddress={tenant?.address ?? null}
      tenantInstagram={tenant?.instagram ?? null}
      tenantReceiptFooter={tenant?.receiptFooter ?? null}
      taxRate={tenant?.taxRate ?? 0}
    />
  )
}
