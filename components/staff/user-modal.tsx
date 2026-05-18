'use client'

import { useEffect, useState, useTransition } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { X, UserPlus, Eye, EyeOff } from 'lucide-react'
import { createUser, updateUser, resetPassword } from '@/app/actions/users'

type User = { id: string; name: string; email: string; role: string; isActive: boolean }

interface UserModalProps {
  open: boolean
  onClose: () => void
  mode: 'create' | 'edit' | 'reset-password'
  user?: User | null
}

export function UserModal({ open, onClose, mode, user }: UserModalProps) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    if (open) { setError(null); setShowPassword(false) }
  }, [open])

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)

    startTransition(async () => {
      let result
      if (mode === 'create') result = await createUser(formData)
      else if (mode === 'edit') result = await updateUser(user!.id, formData)
      else result = await resetPassword(user!.id, formData)

      if (result?.error) setError(result.error)
      else onClose()
    })
  }

  const titles = {
    create: { label: 'Tambah Kasir', icon: '👤' },
    edit: { label: 'Edit Kasir', icon: '✏️' },
    'reset-password': { label: 'Reset Password', icon: '🔑' },
  }
  const t = titles[mode]

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-full max-w-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden"
          >
            <div className="flex items-center justify-between p-5 border-b border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
                  <UserPlus className="w-4 h-4 text-orange-500" />
                </div>
                <h2 className="text-base font-semibold text-zinc-900 dark:text-white">{t.label}</h2>
              </div>
              <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {error && (
                <div className="px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>
              )}

              {mode !== 'reset-password' && (
                <>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                      Nama <span className="text-orange-500">*</span>
                    </label>
                    <input
                      name="name" defaultValue={user?.name} required
                      placeholder="Nama lengkap kasir"
                      className="w-full h-10 px-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white text-sm placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-orange-500 transition-colors"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                      Email <span className="text-orange-500">*</span>
                    </label>
                    <input
                      name="email" type="email" defaultValue={user?.email} required
                      placeholder="email@kasir.com"
                      className="w-full h-10 px-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white text-sm placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-orange-500 transition-colors"
                    />
                  </div>
                </>
              )}

              {(mode === 'create' || mode === 'reset-password') && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-400 uppercase tracking-wide">
                    {mode === 'reset-password' ? 'Password Baru' : 'Password'} <span className="text-orange-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      name="password" type={showPassword ? 'text' : 'password'} required minLength={6}
                      placeholder="Min. 6 karakter"
                      className="w-full h-10 px-3 pr-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white text-sm placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-orange-500 transition-colors"
                    />
                    <button type="button" onClick={() => setShowPassword(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              {mode === 'reset-password' && user && (
                <div className="px-3 py-2.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">Reset password untuk <span className="text-zinc-900 dark:text-white font-medium">{user.name}</span></p>
                  <p className="text-xs text-zinc-500 mt-0.5">{user.email}</p>
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={onClose}
                  className="flex-1 h-10 rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white transition-colors">
                  Batal
                </button>
                <button type="submit" disabled={isPending}
                  className="flex-1 h-10 rounded-xl bg-orange-500 text-black text-sm font-semibold hover:bg-orange-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                  {isPending ? 'Menyimpan...' : mode === 'create' ? 'Tambah Kasir' : mode === 'edit' ? 'Simpan' : 'Reset Password'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
