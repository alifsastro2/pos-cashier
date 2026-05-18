'use client'

import { useState, useTransition } from 'react'
import { motion } from 'motion/react'
import { UserPlus, Pencil, KeyRound, PowerOff, Trash2, ShieldCheck, User } from 'lucide-react'
import { toggleUserActive, deleteUser } from '@/app/actions/users'
import { UserModal } from './user-modal'
import { DeleteConfirmModal } from '@/components/menu/delete-confirm-modal'

type User = { id: string; name: string; email: string; role: string; isActive: boolean }

interface StaffManagerProps {
  users: User[]
  currentUserId: string
}

export function StaffManager({ users, currentUserId }: StaffManagerProps) {
  const [modal, setModal] = useState<{ mode: 'create' | 'edit' | 'reset-password'; user?: User } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null)
  const [isPending, startTransition] = useTransition()
  const [pendingId, setPendingId] = useState<string | null>(null)

  function handleToggle(user: User) {
    setPendingId(user.id)
    startTransition(async () => {
      await toggleUserActive(user.id)
      setPendingId(null)
    })
  }

  function handleDelete(user: User) {
    setPendingId(user.id)
    startTransition(async () => {
      await deleteUser(user.id)
      setPendingId(null)
    })
  }

  return (
    <div className="p-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-white">Manajemen Kasir</h1>
          <p className="text-sm text-zinc-500 mt-0.5">{users.length} akun terdaftar</p>
        </div>
        <button
          onClick={() => setModal({ mode: 'create' })}
          className="flex items-center gap-2 h-9 px-4 rounded-xl bg-orange-500 text-black text-sm font-semibold hover:bg-orange-400 transition-colors"
        >
          <UserPlus className="w-4 h-4" />
          Tambah Kasir
        </button>
      </div>

      {/* User list */}
      <div className="space-y-3">
        {users.map((user) => {
          const isSelf = user.id === currentUserId
          const isLoading = pendingId === user.id && isPending

          return (
            <motion.div
              key={user.id}
              layout
              className={`flex items-center gap-4 p-4 rounded-2xl border transition-colors ${
                user.isActive
                  ? 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800'
                  : 'bg-zinc-50 dark:bg-zinc-900/50 border-zinc-200/50 dark:border-zinc-800/50 opacity-60'
              }`}
            >
              {/* Avatar */}
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                user.role === 'ADMIN'
                  ? 'bg-orange-500/15 border border-orange-500/30'
                  : 'bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700'
              }`}>
                {user.role === 'ADMIN'
                  ? <ShieldCheck className="w-5 h-5 text-orange-400" />
                  : <User className="w-5 h-5 text-zinc-400" />
                }
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-zinc-900 dark:text-white truncate">{user.name}</p>
                  {isSelf && <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-orange-500/15 text-orange-400 border border-orange-500/20">Anda</span>}
                  {!user.isActive && <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-zinc-200 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400">Nonaktif</span>}
                </div>
                <p className="text-xs text-zinc-500 truncate mt-0.5">{user.email}</p>
                <p className="text-xs text-zinc-400 dark:text-zinc-600 mt-0.5">{user.role === 'ADMIN' ? 'Administrator' : 'Kasir'}</p>
              </div>

              {/* Actions */}
              {!isSelf && (
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    title="Edit"
                    onClick={() => setModal({ mode: 'edit', user })}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    title="Reset Password"
                    onClick={() => setModal({ mode: 'reset-password', user })}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                  </button>
                  <button
                    title={user.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                    onClick={() => handleToggle(user)}
                    disabled={isLoading}
                    className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors disabled:opacity-40 ${
                      user.isActive
                        ? 'text-zinc-400 hover:text-yellow-400 hover:bg-yellow-500/10'
                        : 'text-zinc-400 hover:text-green-400 hover:bg-green-500/10'
                    }`}
                  >
                    <PowerOff className="w-3.5 h-3.5" />
                  </button>
                  <button
                    title="Hapus"
                    onClick={() => setDeleteTarget(user)}
                    disabled={isLoading}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-40"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </motion.div>
          )
        })}
      </div>

      {modal && (
        <UserModal
          open
          mode={modal.mode}
          user={modal.user}
          onClose={() => setModal(null)}
        />
      )}

      <DeleteConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => { if (deleteTarget) handleDelete(deleteTarget) }}
        title={`Hapus akun "${deleteTarget?.name}"?`}
        description="Tindakan ini tidak bisa dibatalkan. Seluruh data akun akan dihapus permanen."
      />
    </div>
  )
}
