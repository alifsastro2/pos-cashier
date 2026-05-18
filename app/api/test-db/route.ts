import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const tenantCount = await prisma.tenant.count()

    const masterUser = await prisma.user.findUnique({
      where: { email: 'admin@alivecoffee.com' },
      include: {
        tenant: { include: { categories: true, products: true } },
      },
    })

    return NextResponse.json({
      ok: true,
      tenants: tenantCount,
      masterUserFound: !!masterUser,
      masterTenant: masterUser?.tenant?.name ?? null,
      categories: masterUser?.tenant?.categories?.length ?? 0,
      products: masterUser?.tenant?.products?.length ?? 0,
    })
  } catch (error: unknown) {
    const err = error as Error & { code?: string; meta?: unknown }
    return NextResponse.json({
      ok: false,
      name: err.name,
      message: err.message,
      code: err.code,
      meta: err.meta,
    }, { status: 500 })
  }
}
