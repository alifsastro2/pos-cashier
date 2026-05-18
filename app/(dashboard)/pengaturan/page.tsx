import { verifySession } from '@/lib/dal'
import { prisma } from '@/lib/prisma'
import { SettingsForm } from '@/components/pengaturan/settings-form'

export const metadata = { title: 'Pengaturan — DigitalBnB POS' }

export default async function PengaturanPage() {
  const session = await verifySession()

  const [tenant, user] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: session.tenantId },
      select: {
        name: true,
        logo: true,
        address: true,
        phone: true,
        email: true,
        instagram: true,
        receiptFooter: true,
        taxRate: true,
        accentColor: true,
        theme: true,
      },
    }),
    prisma.user.findUnique({
      where: { id: session.userId },
      select: { theme: true },
    }),
  ])

  if (!tenant) return null

  return (
    <div className="h-full p-6 overflow-y-auto">
      <SettingsForm
        tenant={tenant}
        role={session.role}
        userTheme={user?.theme ?? null}
      />
    </div>
  )
}
