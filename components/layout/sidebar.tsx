'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { motion } from 'motion/react'
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  BarChart3,
  FileText,
  Settings,
  LogOut,
  Store,
  Users,
  ClipboardList,
} from 'lucide-react'
import { logout } from '@/app/actions/auth'

const navItems = [
  { href: '/kasir', icon: ShoppingCart, label: 'Kasir / POS', adminOnly: false },
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', adminOnly: false },
  { href: '/pesanan', icon: ClipboardList, label: 'Pesanan', hasBadge: true, adminOnly: false },
  { href: '/menu', icon: Package, label: 'Menu & Produk', adminOnly: false },
  { href: '/stok', icon: BarChart3, label: 'Stok', adminOnly: false },
  { href: '/laporan', icon: FileText, label: 'Laporan', adminOnly: true },
]

const bottomItems = [
  { href: '/pengaturan', icon: Settings, label: 'Pengaturan' },
]

type SidebarProps = {
  user: {
    name: string
    email: string
    role: string
    tenant: { name: string; logo?: string | null }
  }
}

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname()
  const [antrianCount, setAntrianCount] = useState(0)

  useEffect(() => {
    async function fetchCount() {
      try {
        const res = await fetch('/api/antrian/count')
        if (res.ok) {
          const data = await res.json()
          setAntrianCount(data.count ?? 0)
        }
      } catch {}
    }
    fetchCount()
    const interval = setInterval(fetchCount, 30_000)
    window.addEventListener('antrian-update', fetchCount)
    return () => {
      clearInterval(interval)
      window.removeEventListener('antrian-update', fetchCount)
    }
  }, [])

  return (
    <aside className="fixed left-0 top-0 h-full w-60 bg-[var(--bg-sidebar)] border-r border-zinc-200 dark:border-white/6 flex flex-col z-20">
      <div className="px-4 py-5 border-b border-zinc-200 dark:border-white/6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center flex-shrink-0 overflow-hidden">
            {user.tenant.logo ? (
              <Image src={user.tenant.logo} alt="logo" width={36} height={36} className="w-full h-full object-cover" unoptimized />
            ) : (
              <Store className="w-5 h-5 text-orange-500" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-zinc-900 dark:text-white truncate">DigitalBnB POS</p>
            <p className="text-xs text-zinc-500 truncate">{user.tenant.name}</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {[...navItems, ...(user.role === 'ADMIN' ? [{ href: '/staff', icon: Users, label: 'Manajemen Kasir', adminOnly: true }] : [])].filter(item => !item.adminOnly || user.role === 'ADMIN').map((item) => {
          const isActive = pathname.startsWith(item.href)
          return (
            <Link key={item.href} href={item.href}>
              <motion.div
                whileHover={{ x: 2 }}
                whileTap={{ scale: 0.98 }}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-orange-500/15 text-orange-400 border border-orange-500/20'
                    : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                <item.icon className={`w-4.5 h-4.5 ${isActive ? 'text-orange-400' : ''}`} />
                {item.label}
                <span className="ml-auto flex items-center gap-1.5">
                  {'hasBadge' in item && item.hasBadge && antrianCount > 0 && (
                    <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-orange-500 text-black text-[10px] font-bold leading-none">
                      {antrianCount}
                    </span>
                  )}
                  {isActive && (
                    <motion.div
                      layoutId="activeIndicator"
                      className="w-1.5 h-1.5 rounded-full bg-orange-500"
                    />
                  )}
                </span>
              </motion.div>
            </Link>
          )
        })}
      </nav>

      <div className="px-3 pb-3 space-y-1 border-t border-zinc-200 dark:border-white/6 pt-3">
        {bottomItems.map((item) => {
          const isActive = pathname.startsWith(item.href)
          return (
            <Link key={item.href} href={item.href}>
              <div
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-orange-500/15 text-orange-400'
                    : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                <item.icon className="w-4.5 h-4.5" />
                {item.label}
              </div>
            </Link>
          )
        })}

        <div className="px-3 py-2 border-t border-zinc-200 dark:border-white/6 mt-2">
          <p className="text-xs font-medium text-zinc-900 dark:text-white truncate">{user.name}</p>
          <p className="text-xs text-zinc-500 truncate mt-0.5">{user.email}</p>
          <p className="text-xs text-orange-500 dark:text-orange-400/80 mt-0.5">
            {user.role === 'ADMIN' ? 'Administrator' : user.role === 'SUPERADMIN' ? 'Super Admin' : 'Kasir'}
          </p>
        </div>

        <form action={logout}>
          <button
            type="submit"
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-zinc-500 dark:text-zinc-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <LogOut className="w-4.5 h-4.5" />
            Keluar
          </button>
        </form>
      </div>
    </aside>
  )
}
