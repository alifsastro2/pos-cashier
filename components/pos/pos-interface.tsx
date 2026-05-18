'use client'

import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Search, Plus, Minus, X, ShoppingCart, Trash2, User, Loader2 } from 'lucide-react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { PaymentModal } from './payment-modal'
import { formatRupiah } from '@/lib/utils/format'
import { ORDER_TYPE_LABELS } from '@/types/pos'
import type { CartItem, OrderType } from '@/types/pos'

type Product = {
  id: string
  name: string
  price: number
  stock: number | null
  image: string | null
  categoryId: string | null
  category: { id: string; name: string; icon: string | null } | null
}

type Category = {
  id: string
  name: string
  icon: string | null
}

type Props = {
  products: Product[]
  categories: Category[]
  tenantName: string
  tenantLogo?: string | null
  tenantAddress?: string | null
  tenantInstagram?: string | null
  tenantReceiptFooter?: string | null
  taxRate: number
}

const ORDER_TYPES = Object.keys(ORDER_TYPE_LABELS) as OrderType[]

function getCategoryIcon(cat: Category): string {
  if (cat.icon && cat.icon.startsWith('/')) return cat.icon
  return '/icons/food.png'
}

export function PosInterface({ products, categories, tenantName, tenantLogo, tenantAddress, tenantInstagram, tenantReceiptFooter, taxRate }: Props) {
  const router = useRouter()
  const [cart, setCart] = useState<CartItem[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [orderType, setOrderType] = useState<OrderType>('DINE_IN')
  const [searchQuery, setSearchQuery] = useState('')
  const [discount, setDiscount] = useState(0)
  const [notes, setNotes] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [showPayment, setShowPayment]   = useState(false)
  const [liveStocks, setLiveStocks]     = useState<Map<string, number | null>>(
    () => new Map(products.map((p) => [p.id, p.stock])),
  )
  const [checking, setChecking]         = useState<Set<string>>(new Set())
  const checkingRef                     = useRef<Set<string>>(new Set())

  // Sync liveStocks when products prop changes (after router.refresh)
  useEffect(() => {
    setLiveStocks(new Map(products.map((p) => [p.id, p.stock])))
  }, [products])

  // Background poll: refresh ALL stocks every 15 seconds
  useEffect(() => {
    async function pollStocks() {
      try {
        const res = await fetch('/api/products/stocks')
        if (!res.ok) return
        const data: Record<string, number | null> = await res.json()
        setLiveStocks(new Map(Object.entries(data)))
      } catch { /* ignore */ }
    }
    const interval = setInterval(pollStocks, 15_000)
    return () => clearInterval(interval)
  }, [])

  // Keep full page refresh every 30s for other data (prices, categories, etc.)
  useEffect(() => {
    const interval = setInterval(() => router.refresh(), 30_000)
    return () => clearInterval(interval)
  }, [router])

  // stockMap reads from liveStocks (always up-to-date)
  const stockMap = liveStocks

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchCat = !selectedCategory || p.categoryId === selectedCategory
      const matchSearch = !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase())
      return matchCat && matchSearch
    })
  }, [products, selectedCategory, searchQuery])

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const taxAmount = Math.round(subtotal * (taxRate / 100))
  const total = Math.max(0, subtotal + taxAmount - discount)

  const fetchLatestStock = useCallback(async (productId: string): Promise<number | null> => {
    try {
      const res = await fetch(`/api/products/${productId}/stock`)
      if (!res.ok) return liveStocks.get(productId) ?? null
      const { stock } = await res.json()
      setLiveStocks((prev) => new Map(prev).set(productId, stock))
      return stock
    } catch {
      return liveStocks.get(productId) ?? null
    }
  }, [liveStocks])

  async function addToCart(product: Product) {
    if (checkingRef.current.has(product.id)) return

    checkingRef.current = new Set([...checkingRef.current, product.id])
    setChecking(new Set(checkingRef.current))
    try {
      const stock = await fetchLatestStock(product.id)
      if (stock !== null && stock === 0) return

      setCart((prev) => {
        const existing = prev.find((i) => i.productId === product.id)
        if (existing) {
          if (stock !== null && existing.quantity >= stock) return prev
          return prev.map((i) =>
            i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i
          )
        }
        return [
          ...prev,
          {
            id: `${product.id}-${Date.now()}`,
            productId: product.id,
            name: product.name,
            price: product.price,
            quantity: 1,
            notes: '',
          },
        ]
      })
    } finally {
      checkingRef.current.delete(product.id)
      setChecking(new Set(checkingRef.current))
    }
  }

  async function updateQty(productId: string, delta: number) {
    if (delta < 0) {
      // Decrement — no need to check DB
      setCart((prev) =>
        prev
          .map((i) => (i.productId === productId ? { ...i, quantity: i.quantity + delta } : i))
          .filter((i) => i.quantity > 0)
      )
      return
    }
    // Increment — check latest stock first
    if (checkingRef.current.has(productId)) return

    checkingRef.current = new Set([...checkingRef.current, productId])
    setChecking(new Set(checkingRef.current))
    try {
      const stock = await fetchLatestStock(productId)
      setCart((prev) =>
        prev.map((i) => {
          if (i.productId !== productId) return i
          if (stock !== null && i.quantity >= stock) return i
          return { ...i, quantity: i.quantity + 1 }
        })
      )
    } finally {
      checkingRef.current.delete(productId)
      setChecking(new Set(checkingRef.current))
    }
  }

  function removeItem(productId: string) {
    setCart((prev) => prev.filter((i) => i.productId !== productId))
  }

  function clearCart() {
    setCart([])
    setDiscount(0)
    setNotes('')
    setCustomerName('')
    setOrderType('DINE_IN')
  }

  function handleOrderSuccess() {
    clearCart()
    router.refresh()
  }

  const now = new Date()
  const dateStr = now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div className="flex h-full bg-[var(--bg-base)]">
      {/* Left: Product Panel */}
      <div className="flex-1 flex flex-col overflow-hidden border-r border-zinc-200 dark:border-white/6">
        {/* Top bar */}
        <div className="px-5 py-4 border-b border-zinc-200 dark:border-white/6 flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 dark:text-zinc-500" />
            <Input
              placeholder="Cari menu..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-zinc-100 dark:bg-white/5 border-zinc-300 dark:border-white/10 text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 h-10"
            />
          </div>
          <div className="text-right">
            <p className="text-xs text-zinc-500">{dateStr}</p>
          </div>
        </div>

        {/* Category Tabs */}
        <div className="px-5 py-3 border-b border-zinc-200 dark:border-white/6">
          <div className="flex gap-2 overflow-x-auto scrollbar-none">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                !selectedCategory
                  ? 'bg-orange-500 text-black'
                  : 'bg-zinc-100 dark:bg-white/5 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-white/10'
              }`}
            >
              Semua
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id === selectedCategory ? null : cat.id)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-2 ${
                  selectedCategory === cat.id
                    ? 'bg-orange-500 text-black'
                    : 'bg-zinc-100 dark:bg-white/5 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-white/10'
                }`}
              >
                <div className="w-4 h-4 relative shrink-0">
                  <Image
                    src={getCategoryIcon(cat)}
                    alt={cat.name}
                    fill
                    className={`object-contain ${selectedCategory === cat.id ? 'dark:invert' : 'dark:invert opacity-60'}`}
                    unoptimized
                  />
                </div>
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Product Grid */}
        <div className="flex-1 overflow-y-auto p-5">
          {filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-zinc-600">
              <ShoppingCart className="w-12 h-12 mb-3 opacity-30" />
              <p>Tidak ada produk ditemukan</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {filteredProducts.map((product) => {
                const inCart      = cart.find((i) => i.productId === product.id)
                const liveStock   = liveStocks.get(product.id) ?? product.stock
                const outOfStock  = liveStock !== null && liveStock === 0
                const lowStock    = liveStock !== null && liveStock > 0 && liveStock <= 5
                const isChecking  = checking.has(product.id)
                return (
                  <motion.div
                    key={product.id}
                    whileHover={outOfStock ? undefined : { scale: 1.02, y: -2 }}
                    whileTap={outOfStock ? undefined : { scale: 0.98 }}
                    onClick={() => addToCart(product)}
                    className={`relative bg-zinc-100 dark:bg-white/[0.04] border rounded-xl overflow-hidden transition-all group ${
                      outOfStock
                        ? 'cursor-not-allowed opacity-55 border-zinc-200 dark:border-white/8'
                        : isChecking
                          ? 'cursor-wait border-zinc-200 dark:border-white/8'
                          : inCart
                            ? 'cursor-pointer border-orange-500/40 bg-orange-500/5'
                            : 'cursor-pointer border-zinc-200 dark:border-white/8 hover:border-orange-500/30 hover:bg-orange-500/[0.03]'
                    }`}
                  >
                    {/* Product image */}
                    <div className="w-full h-24 bg-zinc-200 dark:bg-zinc-800 relative overflow-hidden">
                      {product.image ? (
                        <Image src={product.image} alt={product.name} fill className="object-cover" unoptimized />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Image
                            src={getCategoryIcon(product.category ?? { id: '', name: '', icon: null })}
                            alt={product.category?.name ?? 'produk'}
                            width={40} height={40}
                            className="object-contain dark:invert opacity-20"
                            unoptimized
                          />
                        </div>
                      )}
                      {/* Habis overlay */}
                      {outOfStock && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                          <span className="text-white text-xs font-bold tracking-widest">HABIS</span>
                        </div>
                      )}
                      {/* Checking overlay */}
                      {isChecking && !outOfStock && (
                        <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                          <Loader2 className="w-5 h-5 text-white animate-spin" />
                        </div>
                      )}
                      {/* Hover overlay (only when not out of stock and not checking) */}
                      {!outOfStock && !isChecking && (
                        <div className="absolute inset-0 bg-orange-500/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center">
                            <Plus className="w-4 h-4 text-black" />
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="p-3">
                      <p className="text-sm font-medium text-zinc-900 dark:text-white leading-tight mb-1 line-clamp-2">{product.name}</p>
                      <div className="flex items-center justify-between gap-1">
                        <p className="text-orange-500 dark:text-orange-400 font-semibold text-sm">{formatRupiah(product.price)}</p>
                        {liveStock !== null && (
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                            outOfStock
                              ? 'bg-red-500/15 text-red-500'
                              : lowStock
                                ? 'bg-amber-500/15 text-amber-500 dark:text-amber-400'
                                : 'bg-zinc-200 dark:bg-white/8 text-zinc-400 dark:text-zinc-500'
                          }`}>
                            {outOfStock ? 'Habis' : `${liveStock}`}
                          </span>
                        )}
                      </div>
                    </div>

                    {inCart && !outOfStock && (
                      <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center shadow-lg">
                        <span className="text-black text-xs font-bold">{inCart.quantity}</span>
                      </div>
                    )}
                  </motion.div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Right: Cart Panel */}
      <div className="w-[340px] flex flex-col bg-[var(--bg-sidebar)]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-zinc-200 dark:border-white/6 flex items-center justify-between">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-white">Pesanan Baru</h2>
          {cart.length > 0 && (
            <button
              onClick={clearCart}
              className="text-zinc-400 dark:text-zinc-500 hover:text-red-500 dark:hover:text-red-400 transition-colors"
              title="Hapus semua"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Customer Name */}
        <div className="px-4 pt-3 pb-2 border-b border-zinc-200 dark:border-white/6">
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500" />
            <input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Nama pelanggan (opsional)..."
              className="w-full h-9 pl-9 pr-3 rounded-xl bg-zinc-100 dark:bg-white/5 border border-zinc-300 dark:border-white/10 text-zinc-900 dark:text-white text-sm placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:border-orange-500/50 transition-colors"
            />
          </div>
        </div>

        {/* Order Type */}
        <div className="px-4 py-3 border-b border-zinc-200 dark:border-white/6">
          <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
            {ORDER_TYPES.map((type) => (
              <button
                key={type}
                onClick={() => setOrderType(type)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                  orderType === type
                    ? 'bg-orange-500 text-black'
                    : 'bg-zinc-100 dark:bg-white/5 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-white/10'
                }`}
              >
                {ORDER_TYPE_LABELS[type]}
              </button>
            ))}
          </div>
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto px-4 py-2">
          <AnimatePresence mode="popLayout">
            {cart.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center h-48 text-zinc-600"
              >
                <ShoppingCart className="w-10 h-10 mb-2 opacity-30" />
                <p className="text-sm">Tambahkan menu dari kiri</p>
              </motion.div>
            ) : (
              cart.map((item) => (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="py-3 border-b border-zinc-200 dark:border-white/6 last:border-0"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm text-zinc-900 dark:text-white font-medium leading-tight flex-1">{item.name}</p>
                    <button
                      onClick={() => removeItem(item.productId)}
                      className="text-zinc-400 dark:text-zinc-600 hover:text-red-500 dark:hover:text-red-400 transition-colors mt-0.5 flex-shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateQty(item.productId, -1)}
                        className="w-6 h-6 rounded-md bg-zinc-200 dark:bg-white/10 flex items-center justify-center hover:bg-zinc-300 dark:hover:bg-white/20 transition-colors"
                      >
                        <Minus className="w-3 h-3 text-zinc-700 dark:text-white" />
                      </button>
                      <span className="text-sm text-zinc-900 dark:text-white w-5 text-center font-medium">{item.quantity}</span>
                      <button
                        onClick={() => updateQty(item.productId, 1)}
                        disabled={(() => {
                          if (checking.has(item.productId)) return true
                          const stock = stockMap.get(item.productId) ?? null
                          return stock !== null && item.quantity >= stock
                        })()}
                        className="w-6 h-6 rounded-md bg-orange-500/20 flex items-center justify-center hover:bg-orange-500/40 transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-orange-500/20"
                      >
                        {checking.has(item.productId)
                          ? <Loader2 className="w-3 h-3 text-orange-500 animate-spin" />
                          : <Plus className="w-3 h-3 text-orange-500 dark:text-orange-400" />
                        }
                      </button>
                    </div>
                    <span className="text-sm font-semibold text-zinc-900 dark:text-white">
                      {formatRupiah(item.price * item.quantity)}
                    </span>
                  </div>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>

        {/* Order Summary */}
        <div className="border-t border-zinc-200 dark:border-white/6 px-4 py-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-zinc-500 dark:text-zinc-400">Subtotal</span>
            <span className="text-zinc-900 dark:text-white">{formatRupiah(subtotal)}</span>
          </div>
          {taxRate > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-zinc-500 dark:text-zinc-400">Pajak ({taxRate}%)</span>
              <span className="text-zinc-900 dark:text-white">{formatRupiah(taxAmount)}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <span className="text-sm text-zinc-500 dark:text-zinc-400">Diskon</span>
            <Input
              type="number"
              value={discount || ''}
              onChange={(e) => setDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
              placeholder="0"
              className="flex-1 h-7 text-xs bg-zinc-100 dark:bg-white/5 border-zinc-300 dark:border-white/10 text-zinc-900 dark:text-white"
              min={0}
              max={subtotal}
            />
          </div>
          <div className="flex justify-between text-base font-bold pt-2 border-t border-zinc-200 dark:border-white/8">
            <span className="text-zinc-900 dark:text-white">Total</span>
            <span className="text-orange-500 dark:text-orange-400">{formatRupiah(total)}</span>
          </div>
        </div>

        {/* Notes */}
        <div className="px-4 pb-3">
          <Input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Catatan pesanan (opsional)..."
            className="h-8 text-xs bg-zinc-100 dark:bg-white/5 border-zinc-300 dark:border-white/10 text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-600"
          />
        </div>

        {/* Checkout Button */}
        <div className="px-4 pb-4">
          <Button
            onClick={() => setShowPayment(true)}
            disabled={cart.length === 0}
            className="w-full h-12 bg-orange-500 hover:bg-orange-600 disabled:opacity-30 text-black font-bold rounded-xl text-base transition-all hover:shadow-[0_0_20px_rgba(249,115,22,0.3)]"
          >
            Bayar {cart.length > 0 ? formatRupiah(total) : ''}
          </Button>
        </div>
      </div>

      {/* Payment Modal */}
      <PaymentModal
        open={showPayment}
        onClose={() => setShowPayment(false)}
        onSuccess={handleOrderSuccess}
        cart={cart}
        orderType={orderType}
        subtotal={subtotal}
        taxAmount={taxAmount}
        discount={discount}
        total={total}
        notes={notes}
        customerName={customerName}
        tenantName={tenantName}
        tenantLogo={tenantLogo}
        tenantAddress={tenantAddress}
        tenantInstagram={tenantInstagram}
        tenantReceiptFooter={tenantReceiptFooter}
        taxRate={taxRate}
      />
    </div>
  )
}
