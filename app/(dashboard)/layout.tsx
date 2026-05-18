import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/dal'
import { Sidebar } from '@/components/layout/sidebar'
import { OrderToastProvider } from '@/components/layout/order-toast-provider'
import { buildThemeVars } from '@/lib/utils/color'
import type { ThemeMode } from '@/lib/utils/color'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()

  if (!user) redirect('/api/auth/clear')
  if (!user.tenant.setupDone) redirect('/onboarding')

  const accent = user.tenant.accentColor ?? '#f97316'
  const theme  = ((user.theme ?? user.tenant.theme) ?? 'dark') as ThemeMode
  const themeVars = buildThemeVars(accent, theme)

  return (
    <div
      data-theme={theme}
      style={themeVars}
      className={`flex h-screen bg-[var(--bg-base)] overflow-hidden${theme !== 'light' ? ' dark' : ''}`}
    >
      <Sidebar
        user={{
          name: user.name,
          email: user.email,
          role: user.role,
          tenant: { name: user.tenant.name, logo: user.tenant.logo },
        }}
      />
      <main className="flex-1 ml-60 overflow-y-auto">
        {children}
      </main>
      <OrderToastProvider />
    </div>
  )
}
