'use client'

import { useEffect, useState, useTransition } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { X, Tag } from 'lucide-react'
import Image from 'next/image'
import { ImageUpload } from '@/components/ui/image-upload'
import { createCategory, updateCategory } from '@/app/actions/products'

const PRESET_ICONS = [
  { src: '/icons/food.png', label: 'Makanan' },
  { src: '/icons/drink.png', label: 'Minuman' },
  { src: '/icons/snack.svg', label: 'Snack' },
]

type Category = { id: string; name: string; icon: string | null }

interface CategoryModalProps {
  open: boolean
  onClose: () => void
  category?: Category | null
}

export function CategoryModal({ open, onClose, category }: CategoryModalProps) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [iconUrl, setIconUrl] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setError(null)
      // Only use stored icon if it's an image path (not emoji)
      const stored = category?.icon
      setIconUrl(stored && stored.startsWith('/') ? stored : null)
    }
  }, [open, category])

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)
    // Save custom icon path, or use the default food.png
    formData.set('icon', iconUrl ?? '/icons/food.png')

    startTransition(async () => {
      const result = category
        ? await updateCategory(category.id, formData)
        : await createCategory(formData)

      if (result?.error) {
        setError(result.error)
      } else {
        onClose()
      }
    })
  }

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={onClose}
          />
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
                  <Tag className="w-4 h-4 text-orange-500" />
                </div>
                <h2 className="text-base font-semibold text-zinc-900 dark:text-white">
                  {category ? 'Edit Kategori' : 'Tambah Kategori'}
                </h2>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {error && (
                <div className="px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                  {error}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                  Nama Kategori <span className="text-orange-500">*</span>
                </label>
                <input
                  name="name"
                  defaultValue={category?.name}
                  required
                  placeholder="Contoh: Makanan Berat"
                  className="w-full h-10 px-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white text-sm placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-orange-500 transition-colors"
                />
              </div>

              {/* Icon preview */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                  Icon Kategori
                </label>
                {/* Preset icons */}
                <div className="flex gap-2">
                  {PRESET_ICONS.map((preset) => (
                    <button
                      key={preset.src}
                      type="button"
                      onClick={() => setIconUrl(preset.src)}
                      className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-colors ${
                        iconUrl === preset.src
                          ? 'border-orange-500 bg-orange-500/10'
                          : 'border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-500'
                      }`}
                    >
                      <Image
                        src={preset.src}
                        alt={preset.label}
                        width={32}
                        height={32}
                        className="object-contain dark:invert"
                        unoptimized
                      />
                      <span className="text-[10px] text-zinc-500 dark:text-zinc-400">{preset.label}</span>
                    </button>
                  ))}
                </div>
                {/* Custom upload */}
                <div className="flex items-center gap-3 pt-1">
                  <div className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center overflow-hidden shrink-0">
                    <Image
                      src={iconUrl ?? '/icons/food.png'}
                      alt="category icon"
                      width={32}
                      height={32}
                      className="object-contain dark:invert"
                      unoptimized
                    />
                  </div>
                  <div className="flex-1">
                    <ImageUpload
                      value={iconUrl}
                      onChange={setIconUrl}
                      defaultSrc="/icons/food.png"
                      label="Upload Icon Kustom"
                      className="!space-y-0"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 h-10 rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex-1 h-10 rounded-xl bg-orange-500 text-black text-sm font-semibold hover:bg-orange-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isPending ? 'Menyimpan...' : category ? 'Simpan' : 'Tambah'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
