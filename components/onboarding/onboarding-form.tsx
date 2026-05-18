'use client'

import { useState, useTransition } from 'react'
import { motion } from 'motion/react'
import { Store, Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { ImageUpload } from '@/components/ui/image-upload'
import { completeOnboarding } from '@/app/actions/onboarding'

export function OnboardingForm() {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [logoUrl, setLogoUrl] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)
    if (logoUrl) formData.set('logo', logoUrl)

    startTransition(async () => {
      const result = await completeOnboarding(undefined, formData)
      if (result?.error) setError(result.error)
    })
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-lg relative z-10"
    >
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-orange-500/15 border border-orange-500/30 mb-4">
          <Store className="w-8 h-8 text-orange-500" />
        </div>
        <h1 className="text-2xl font-bold text-white">Setup Toko Anda</h1>
        <p className="text-sm text-zinc-400 mt-1">Lengkapi informasi bisnis untuk memulai</p>
      </div>

      <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Logo — optional */}
          <div className="space-y-2">
            <Label className="text-zinc-300 text-sm">Logo Toko <span className="text-zinc-500 font-normal">(opsional)</span></Label>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden shrink-0">
                {logoUrl ? (
                  <img src={logoUrl} alt="logo" className="w-full h-full object-cover" />
                ) : (
                  <Store className="w-6 h-6 text-zinc-600" />
                )}
              </div>
              <div className="flex-1">
                <ImageUpload
                  value={logoUrl}
                  onChange={setLogoUrl}
                  label="Upload Logo"
                  enableCrop
                  aspectRatio={1}
                  className="!space-y-0"
                />
                <p className="text-xs text-zinc-500 mt-1.5">Bisa diupload nanti di Pengaturan</p>
              </div>
            </div>
          </div>

          <div className="border-t border-white/6 pt-4 space-y-4">
            <div className="space-y-2">
              <Label className="text-zinc-300 text-sm">Nama Toko / Usaha *</Label>
              <Input name="name" placeholder="Kafe Bintang" required
                className="bg-white/5 border-white/10 text-white placeholder:text-zinc-500 h-11" />
            </div>
            <div className="space-y-2">
              <Label className="text-zinc-300 text-sm">Alamat</Label>
              <Input name="address" placeholder="Jl. Contoh No. 123, Jakarta"
                className="bg-white/5 border-white/10 text-white placeholder:text-zinc-500 h-11" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-zinc-300 text-sm">No. Telepon</Label>
                <Input name="phone" placeholder="08123456789"
                  className="bg-white/5 border-white/10 text-white placeholder:text-zinc-500 h-11" />
              </div>
              <div className="space-y-2">
                <Label className="text-zinc-300 text-sm">Pajak (%)</Label>
                <Input name="taxRate" type="number" placeholder="10" min="0" max="100"
                  className="bg-white/5 border-white/10 text-white placeholder:text-zinc-500 h-11" />
              </div>
            </div>
          </div>

          {error && (
            <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <Button type="submit" disabled={isPending}
            className="w-full h-11 bg-orange-500 hover:bg-orange-600 text-black font-semibold rounded-xl mt-2">
            {isPending ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Menyimpan...</> : 'Mulai Gunakan DigitalBnB POS'}
          </Button>
        </form>
      </div>
    </motion.div>
  )
}
