'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import Image from 'next/image'
import {
  Plus, Search, Tag, Package, Pencil, Trash2, ToggleLeft, ToggleRight, ChevronDown,
} from 'lucide-react'
import { ProductModal } from './product-modal'
import { CategoryModal } from './category-modal'
import { DeleteConfirmModal } from './delete-confirm-modal'
import { deleteProduct, toggleProductActive, deleteCategory } from '@/app/actions/products'
import { formatRupiah } from '@/lib/utils/format'

type Category = { id: string; name: string; icon: string | null; _count: { products: number } }
type Product = {
  id: string
  name: string
  description: string | null
  price: number
  stock: number | null
  isActive: boolean
  categoryId: string | null
  image: string | null
  category: { id: string; name: string; icon: string | null } | null
}

function getCategoryIconSrc(icon: string | null): string {
  if (icon && icon.startsWith('/')) return icon
  return '/icons/food.png'
}

interface MenuManagerProps {
  products: Product[]
  categories: Category[]
}

export function MenuManager({ products, categories }: MenuManagerProps) {
  const [activeTab, setActiveTab] = useState<'products' | 'categories'>('products')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | 'all'>('all')
  const [showInactive, setShowInactive] = useState(false)

  const [productModalOpen, setProductModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)

  const [categoryModalOpen, setCategoryModalOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)

  const [deleteModal, setDeleteModal] = useState<{
    open: boolean; type: 'product' | 'category'; id: string; name: string
  }>({ open: false, type: 'product', id: '', name: '' })

  const [, startTransition] = useTransition()
  const [catDropdownOpen, setCatDropdownOpen] = useState(false)
  const catDropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (catDropdownRef.current && !catDropdownRef.current.contains(e.target as Node)) {
        setCatDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filteredProducts = products.filter((p) => {
    const matchSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase())
    const matchCat = selectedCategory === 'all' || p.categoryId === selectedCategory
    const matchActive = showInactive ? true : p.isActive
    return matchSearch && matchCat && matchActive
  })

  function openAddProduct() {
    setEditingProduct(null)
    setProductModalOpen(true)
  }

  function openEditProduct(product: Product) {
    setEditingProduct(product)
    setProductModalOpen(true)
  }

  function openDeleteProduct(product: Product) {
    setDeleteModal({ open: true, type: 'product', id: product.id, name: product.name })
  }

  function openAddCategory() {
    setEditingCategory(null)
    setCategoryModalOpen(true)
  }

  function openEditCategory(category: Category) {
    setEditingCategory(category)
    setCategoryModalOpen(true)
  }

  function openDeleteCategory(category: Category) {
    setDeleteModal({ open: true, type: 'category', id: category.id, name: category.name })
  }

  function handleToggleActive(product: Product) {
    startTransition(async () => {
      await toggleProductActive(product.id, !product.isActive)
    })
  }

  async function handleDelete() {
    if (deleteModal.type === 'product') {
      await deleteProduct(deleteModal.id)
    } else {
      await deleteCategory(deleteModal.id)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-white">Menu & Produk</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            {products.length} produk · {categories.length} kategori
          </p>
        </div>
        <button
          onClick={activeTab === 'products' ? openAddProduct : openAddCategory}
          className="flex items-center gap-2 h-9 px-4 rounded-xl bg-orange-500 text-black text-sm font-semibold hover:bg-orange-400 transition-colors"
        >
          <Plus className="w-4 h-4" />
          {activeTab === 'products' ? 'Tambah Produk' : 'Tambah Kategori'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl w-fit mb-5">
        {[
          { key: 'products', label: 'Produk', icon: Package },
          { key: 'categories', label: 'Kategori', icon: Tag },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key as 'products' | 'categories')}
            className={`flex items-center gap-2 h-8 px-4 rounded-lg text-sm font-medium transition-colors ${
              activeTab === key
                ? 'bg-orange-500 text-black'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'products' && (
        <>
          {/* Filters */}
          <div className="flex gap-3 mb-4">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 dark:text-zinc-500" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari produk..."
                className="w-full h-9 pl-9 pr-3 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white text-sm placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-orange-500 transition-colors"
              />
            </div>
            <div className="relative" ref={catDropdownRef}>
              <button
                onClick={() => setCatDropdownOpen((o) => !o)}
                className={`h-9 pl-3 pr-8 rounded-xl bg-zinc-100 dark:bg-zinc-900 border text-sm text-left transition-colors flex items-center gap-2 whitespace-nowrap ${
                  catDropdownOpen
                    ? 'border-orange-500 text-zinc-900 dark:text-white'
                    : 'border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-700'
                }`}
              >
                {selectedCategory === 'all'
                  ? 'Semua Kategori'
                  : (categories.find((c) => c.id === selectedCategory)?.name ?? 'Semua Kategori')}
                <ChevronDown className={`absolute right-2.5 w-3.5 h-3.5 text-zinc-400 transition-transform ${catDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              <AnimatePresence>
                {catDropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -6, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.97 }}
                    transition={{ duration: 0.15 }}
                    className="absolute z-20 top-full mt-1 left-0 min-w-[160px] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-lg overflow-hidden py-1"
                  >
                    {[{ id: 'all', name: 'Semua Kategori' }, ...categories].map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => { setSelectedCategory(cat.id); setCatDropdownOpen(false) }}
                        className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                          selectedCategory === cat.id
                            ? 'text-orange-500 bg-orange-500/8 font-medium'
                            : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                        }`}
                      >
                        {cat.name}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <button
              onClick={() => setShowInactive(!showInactive)}
              className={`h-9 px-3 rounded-xl text-sm font-medium border transition-colors ${
                showInactive
                  ? 'bg-orange-500/10 border-orange-500/30 text-orange-500 dark:text-orange-400'
                  : 'border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              {showInactive ? 'Sembunyikan nonaktif' : 'Tampilkan nonaktif'}
            </button>
          </div>

          {/* Products Grid */}
          {filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center flex-1 py-16 text-center">
              <div className="w-14 h-14 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-3">
                <Package className="w-7 h-7 text-zinc-400 dark:text-zinc-600" />
              </div>
              <p className="text-zinc-500 dark:text-zinc-400 text-sm">
                {searchQuery ? 'Produk tidak ditemukan' : 'Belum ada produk'}
              </p>
              {!searchQuery && (
                <button
                  onClick={openAddProduct}
                  className="mt-3 text-sm text-orange-500 hover:text-orange-400 transition-colors"
                >
                  + Tambah produk pertama
                </button>
              )}
            </div>
          ) : (
            <div className="flex-1 min-h-0 overflow-y-auto pb-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                <AnimatePresence mode="popLayout">
                  {filteredProducts.map((product, i) => (
                    <motion.div
                      key={product.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ delay: i * 0.03 }}
                      className={`group relative bg-zinc-100 dark:bg-white/[0.04] border rounded-xl overflow-hidden transition-colors ${
                        product.isActive
                          ? 'border-zinc-200 dark:border-white/8 hover:border-zinc-300 dark:hover:border-zinc-700'
                          : 'border-zinc-200/50 dark:border-zinc-800/50 opacity-60'
                      }`}
                    >
                      {/* Product image */}
                      <div className="w-full h-24 bg-zinc-200 dark:bg-zinc-800 relative overflow-hidden flex items-center justify-center">
                        {product.image ? (
                          <Image
                            src={product.image}
                            alt={product.name}
                            fill
                            className="object-cover"
                            unoptimized
                          />
                        ) : (
                          <Image
                            src={getCategoryIconSrc(product.category?.icon ?? null)}
                            alt={product.category?.name ?? 'produk'}
                            width={40}
                            height={40}
                            className="object-contain dark:invert opacity-20"
                            unoptimized
                          />
                        )}
                        {!product.isActive && (
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                            <span className="text-white text-xs font-bold tracking-widest">NONAKTIF</span>
                          </div>
                        )}
                        {product.stock !== null && product.stock <= 5 && (
                          <div className={`absolute top-2 left-2 px-1.5 py-0.5 rounded-md text-white text-[10px] font-bold ${
                            product.stock === 0 ? 'bg-red-500' : 'bg-amber-500'
                          }`}>
                            {product.stock === 0 ? 'Habis' : `Stok: ${product.stock}`}
                          </div>
                        )}
                      </div>

                      <div className="p-3">
                        <p className="text-sm font-medium text-zinc-900 dark:text-white leading-tight mb-1 line-clamp-2">
                          {product.name}
                        </p>
                        <p className="text-orange-500 dark:text-orange-400 font-semibold text-sm">
                          {formatRupiah(product.price)}
                        </p>
                      </div>

                      {/* Actions overlay */}
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <button
                          onClick={() => openEditProduct(product)}
                          className="w-9 h-9 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-300 hover:text-white hover:bg-zinc-700 transition-colors"
                          title="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleToggleActive(product)}
                          className="w-9 h-9 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center transition-colors hover:bg-zinc-700"
                          title={product.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                        >
                          {product.isActive
                            ? <ToggleRight className="w-4 h-4 text-orange-400" />
                            : <ToggleLeft className="w-4 h-4 text-zinc-400" />
                          }
                        </button>
                        <button
                          onClick={() => openDeleteProduct(product)}
                          className="w-9 h-9 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-red-400 hover:text-red-300 hover:bg-zinc-700 transition-colors"
                          title="Hapus"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === 'categories' && (
        <div className="space-y-2 flex-1 overflow-y-auto pb-4">
          {categories.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-14 h-14 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-3">
                <Tag className="w-7 h-7 text-zinc-400 dark:text-zinc-600" />
              </div>
              <p className="text-zinc-500 dark:text-zinc-400 text-sm">Belum ada kategori</p>
              <button
                onClick={openAddCategory}
                className="mt-3 text-sm text-orange-500 hover:text-orange-400 transition-colors"
              >
                + Tambah kategori pertama
              </button>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {categories.map((category, i) => (
                <motion.div
                  key={category.id}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  transition={{ delay: i * 0.04 }}
                  className="flex items-center gap-4 p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors group"
                >
                  <div className="w-11 h-11 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center overflow-hidden">
                    <Image
                      src={getCategoryIconSrc(category.icon)}
                      alt={category.name}
                      width={28}
                      height={28}
                      className="object-contain dark:invert opacity-70"
                      unoptimized
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-zinc-900 dark:text-white">{category.name}</p>
                    <p className="text-xs text-zinc-500">{category._count.products} produk</p>
                  </div>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => openEditCategory(category)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => openDeleteCategory(category)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-red-400 hover:text-red-500 dark:hover:text-red-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
      )}

      {/* Modals */}
      <ProductModal
        open={productModalOpen}
        onClose={() => setProductModalOpen(false)}
        categories={categories}
        product={editingProduct}
      />
      <CategoryModal
        open={categoryModalOpen}
        onClose={() => setCategoryModalOpen(false)}
        category={editingCategory}
      />
      <DeleteConfirmModal
        open={deleteModal.open}
        onClose={() => setDeleteModal((d) => ({ ...d, open: false }))}
        onConfirm={handleDelete}
        title={`Hapus ${deleteModal.type === 'product' ? 'Produk' : 'Kategori'}?`}
        description={
          deleteModal.type === 'product'
            ? `"${deleteModal.name}" akan dihapus dari menu dan tidak bisa dipesan lagi. Riwayat pesanan tetap tersimpan.`
            : `Kategori "${deleteModal.name}" akan dihapus permanen. Produk di dalamnya tidak akan ikut terhapus.`
        }
      />
    </div>
  )
}
