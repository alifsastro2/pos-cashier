import { redirect } from 'next/navigation'
import { verifySession } from '@/lib/dal'
import { prisma } from '@/lib/prisma'
import { StaffManager } from '@/components/staff/staff-manager'

export const metadata = { title: 'Manajemen Kasir — DigitalBnB POS' }

export default async function StaffPage() {
  const session = await verifySession()

  if (session.role !== 'ADMIN') redirect('/kasir')

  const users = await prisma.user.findMany({
    where: { tenantId: session.tenantId },
    select: { id: true, name: true, email: true, role: true, isActive: true },
    orderBy: [{ role: 'asc' }, { name: 'asc' }],
  })

  return <StaffManager users={users} currentUserId={session.userId} />
}
