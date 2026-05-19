'use client'

import { useActionState, useTransition } from 'react'
import { motion } from 'motion/react'
import { login, loginDemo } from '@/app/actions/auth'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import Image from 'next/image'
import { AlertCircle, Loader2, FlaskConical, BookOpen, Instagram } from 'lucide-react'

export function LoginForm() {
  const [state, action, pending] = useActionState(login, undefined)
  const [demoPending, startDemo] = useTransition()

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="w-full max-w-md"
    >
      <div className="text-center mb-8">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="mb-4"
        >
          <Image
            src="/logo-buildnboost.png"
            alt="buildNboost"
            width={160}
            height={116}
            className="object-contain mx-auto drop-shadow-[0_4px_12px_rgba(37,99,235,0.35)]"
            priority
          />
        </motion.div>
        <motion.h1
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-xl font-bold text-white tracking-tight"
        >
          POS Cashier
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25 }}
          className="text-sm text-zinc-400 mt-1"
        >
          Sistem Kasir Modern untuk Bisnis Anda
        </motion.p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.4 }}
        className="bg-white/[0.04] border border-white/10 rounded-2xl p-8 backdrop-blur-sm"
      >
        <h2 className="text-lg font-semibold text-white mb-6">Masuk ke Akun Anda</h2>

        <form action={action} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-zinc-300 text-sm font-medium">
              Email
            </Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="nama@toko.com"
              required
              autoComplete="email"
              className="bg-white/5 border-white/10 text-white placeholder:text-zinc-500 focus:border-orange-500/50 focus:ring-orange-500/20 h-11"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-zinc-300 text-sm font-medium">
              Password
            </Label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="••••••••"
              required
              autoComplete="current-password"
              className="bg-white/5 border-white/10 text-white placeholder:text-zinc-500 focus:border-orange-500/50 focus:ring-orange-500/20 h-11"
            />
          </div>

          {state?.error && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2"
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{state.error}</span>
            </motion.div>
          )}

          <Button
            type="submit"
            disabled={pending}
            className="w-full h-11 bg-orange-500 hover:bg-orange-600 text-black font-semibold rounded-xl transition-all duration-200 hover:shadow-[0_0_20px_rgba(249,115,22,0.3)]"
          >
            {pending ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Memproses...
              </span>
            ) : (
              'Masuk ke Dashboard'
            )}
          </Button>
        </form>

        <div className="mt-6 pt-6 border-t border-white/8 space-y-4">
          <button
            type="button"
            onClick={() => startDemo(() => loginDemo())}
            disabled={demoPending || pending}
            className="w-full flex items-center justify-center gap-2 h-11 rounded-xl border border-white/15 text-zinc-300 text-sm font-medium hover:border-orange-500/40 hover:text-orange-400 hover:bg-orange-500/5 transition-all disabled:opacity-50"
          >
            {demoPending ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Menyiapkan demo...</>
            ) : (
              <><FlaskConical className="w-4 h-4" /> Coba Demo Gratis</>
            )}
          </button>
          <p className="text-center text-xs text-zinc-600">
            Demo menggunakan data contoh • Perubahan tidak tersimpan permanen
          </p>
          <p className="text-center text-sm text-zinc-500">
            Belum berlangganan?{' '}
            <a
              href="https://digitalbnb.my.id"
              target="_blank"
              rel="noopener noreferrer"
              className="text-orange-400 hover:text-orange-300 font-medium transition-colors"
            >
              digitalbnb.my.id
            </a>
            {' · '}
            <a
              href="https://www.instagram.com/digitalbnb"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-orange-400 hover:text-orange-300 font-medium transition-colors"
            >
              <Instagram size={13} />@digitalbnb
            </a>
          </p>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="flex flex-col items-center gap-2 mt-6"
      >
        <a
          href="/manual-book/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-orange-400 transition-colors underline underline-offset-2"
        >
          <BookOpen className="w-3.5 h-3.5 flex-shrink-0" />
          Buku Panduan Pengguna
        </a>
        <p className="text-center text-xs text-zinc-600">
          © 2026 DigitalBnB POS. All rights reserved.
        </p>
      </motion.div>
    </motion.div>
  )
}
