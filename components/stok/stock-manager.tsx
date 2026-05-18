'use client'

import { useState, useTransition } from 'react'
import { motion } from 'motion/react'
import { Search, AlertTriangle, Package, Infinity, Pencil, Check, X } from 'lucide-react'
import { updateStock } from '@/app/actions/stock'

type Product = {
  id: string
  name: string
  stock: number | null
  isActive: boolean
  category: { name: string; icon: string | null } | null
}

interface StockManagerProps {
  products: Product[]
}

function StockCell({ product }: { product: Product }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(product.stock?.toString() ?? '')
  const [isPending, startTransition] = useTransition()

  function handleSave() {
    const parsed = value === '' ? null : parseInt(value)
    if (value !== '' && (isNaN(parsed!) || parsed! < 0)) return

    startTransition(async () => {
      await updateStock(product.id, parsed)
      setEditing(false)
    })
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleSave()
    if (e.key === 'Escape') setEditing(false)
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1.5">
        <input
          autoFocus
          type="number"
          min="0"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Jumlah"
          className="w-24 h-7 px-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-orange-500 text-zinc-900 dark:text-white text-sm focus:outline-none"
        />
        <button
          onClick={handleSave}
          disabled={isPending}
          className="w-7 h-7 rounded-lg bg-orange-500 flex items-center justify-center text-black hover:bg-orange-400 transition-colors"
        >
          <Check className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => setEditing(false)}
          className="w-7 h-7 rounded-lg bg-zinc-200 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 flex items-center justify-center text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="flex items-center gap-2 group/cell"
    >
      {product.stock === null ? (
        <span className="flex items-center gap-1.5 text-zinc-500 text-sm">
          <Infinity className="w-4 h-4" />
          Tidak terbatas
        </span>
      ) : product.stock === 0 ? (
        <span className="px-2.5 py-1 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold">
          Habis
        </span>
      ) : product.stock <= 5 ? (
        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-400 text-sm font-semibold">
          <AlertTriangle className="w-3.5 h-3.5" />
          {product.stock} tersisa
        </span>
      ) : (
        <span className="text-zinc-900 dark:text-white text-sm font-medium">{product.stock} unit</span>
      )}
      <Pencil className="w-3 h-3 text-zinc-600 opacity-0 group-hover/cell:opacity-100 transition-opacity" />
    </button>
  )
}

export function StockManager({ products }: StockManagerProps) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'low' | 'out' | 'unlimited'>('all')

  const filtered = products.filter((p) => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase())
    const matchFilter =
      filter === 'all' ? true
      : filter === 'low' ? p.stock !== null && p.stock > 0 && p.stock <= 10
      : filter === 'out' ? p.stock === 0
      : filter === 'unlimited' ? p.stock === null
      : true
    return matchSearch && matchFilter
  })

  const lowCount = products.filter((p) => p.stock !== null && p.stock > 0 && p.stock <= 10).length
  const outCount = products.filter((p) => p.stock === 0).length

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-white">Stok</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">{products.length} produk dikelola</p>
        </div>
        <div className="flex items-center gap-3">
          {outCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-red-500/10 border border-red-500/20">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <span className="text-sm text-red-400 font-medium">{outCount} habis</span>
            </div>
          )}
          {lowCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-orange-500/10 border border-orange-500/20">
              <AlertTriangle className="w-4 h-4 text-orange-400" />
              <span className="text-sm text-orange-400 font-medium">{lowCount} hampir habis</span>
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 dark:text-zinc-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari produk..."
            className="w-full h-9 pl-9 pr-3 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white text-sm placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-orange-500 transition-colors"
          />
        </div>
        <div className="flex gap-1 p-1 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl">
          {[
            { key: 'all', label: 'Semua' },
            { key: 'low', label: `Hampir habis${lowCount > 0 ? ` (${lowCount})` : ''}` },
            { key: 'out', label: `Habis${outCount > 0 ? ` (${outCount})` : ''}` },
            { key: 'unlimited', label: 'Tidak terbatas' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key as typeof filter)}
              className={`h-7 px-3 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                filter === key
                  ? 'bg-orange-500 text-black'
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden">
          <div className="grid grid-cols-[1fr_140px_120px_140px] px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
            <span className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Produk</span>
            <span className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Kategori</span>
            <span className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Status</span>
            <span className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Stok</span>
          </div>

          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Package className="w-10 h-10 text-zinc-400 dark:text-zinc-700 mb-3" />
              <p className="text-zinc-500 text-sm">Tidak ada produk ditemukan</p>
            </div>
          ) : (
            filtered.map((product, i) => {
              const isOut = product.stock === 0
              const isLow = product.stock !== null && product.stock > 0 && product.stock <= 5
              return (
              <motion.div
                key={product.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.02 }}
                className={`grid grid-cols-[1fr_140px_120px_140px] items-center px-4 py-3.5 border-b border-zinc-100 dark:border-zinc-800/50 last:border-0 transition-colors ${
                  isOut ? 'bg-red-500/5 hover:bg-red-500/8'
                  : isLow ? 'bg-amber-500/5 hover:bg-amber-500/8'
                  : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/30'
                }`}
              >
                <span className="text-sm font-medium text-zinc-900 dark:text-white">{product.name}</span>
                <span className="text-sm text-zinc-500 dark:text-zinc-400">
                  {product.category ? `${product.category.icon ?? ''} ${product.category.name}` : '—'}
                </span>
                <span>
                  {product.isActive ? (
                    <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs">Aktif</span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-500 text-xs">Nonaktif</span>
                  )}
                </span>
                <StockCell product={product} />
              </motion.div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
