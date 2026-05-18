import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const count = await prisma.tenant.count()
    return NextResponse.json({ ok: true, tenants: count, env: process.env.NODE_ENV })
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
