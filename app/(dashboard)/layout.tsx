import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/dal'
import { getSession } from '@/lib/session'
import { Sidebar } from '@/components/layout/sidebar'
import { OrderToastProvider } from '@/components/layout/order-toast-provider'
import { buildThemeVars } from '@/lib/utils/color'
import { logout } from '@/app/actions/auth'
import { FlaskConical, LogOut } from 'lucide-react'
import type { ThemeMode } from '@/lib/utils/color'
import { Toaster } from 'sonner'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()

  if (!user) redirect('/api/auth/clear')
  if (!user.tenant.setupDone) redirect('/onboarding')

  const session   = await getSession()
  const isDemo    = session?.isDemo ?? false
  const accent    = user.tenant.accentColor ?? '#f97316'
  const theme     = ((user.theme ?? user.tenant.theme) ?? 'dark') as ThemeMode
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
      <div className="flex-1 ml-60 flex flex-col overflow-hidden">
        {isDemo && (
          <div className="flex items-center justify-between gap-3 px-5 py-2 bg-amber-400/15 border-b border-amber-400/25 text-amber-400 text-xs font-medium shrink-0">
            <div className="flex items-center gap-2">
              <FlaskConical className="w-3.5 h-3.5 shrink-0" />
              <span>Mode Demo — Data yang diubah tidak tersimpan secara permanen dan akan dihapus otomatis dalam 24 jam.</span>
            </div>
            <form action={logout}>
              <button type="submit" className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-amber-400/30 hover:bg-amber-400/10 transition-colors whitespace-nowrap">
                <LogOut className="w-3 h-3" />
                Keluar Demo
              </button>
            </form>
          </div>
        )}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
      <OrderToastProvider />
      <Toaster position="top-center" richColors toastOptions={{ style: { zIndex: 99999 } }} />
    </div>
  )
}
