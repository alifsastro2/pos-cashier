import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../lib/generated/prisma/client'
import bcrypt from 'bcryptjs'

const adapter = new PrismaPg(process.env.DATABASE_URL!)
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('🔍 Cek tenant yang ada...')
  const allTenants = await prisma.tenant.findMany({ select: { id: true, name: true, slug: true, isDemoTenant: true } })
  console.log('Tenants:', JSON.stringify(allTenants, null, 2))

  console.log('\n☕ Seeding Alive Coffee...')

  // ─── Tenant ───────────────────────────────────────────────
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'alive-coffee' },
    update: {
      name: 'Alive Coffee',
      address: 'Jl. Raya Bekasi No. 88, Bekasi Timur',
      phone: '0812-3456-7890',
      email: 'admin@alivecoffee.id',
      instagram: '@alivecoffee.id',
      taxRate: 10,
      accentColor: '#f97316',
      theme: 'dark',
      setupDone: true,
      isActive: true,
      isDemoTenant: false,
      receiptFooter: 'Terima kasih sudah mampir! ☕\nIG: @alivecoffee.id',
    },
    create: {
      name: 'Alive Coffee',
      slug: 'alive-coffee',
      address: 'Jl. Raya Bekasi No. 88, Bekasi Timur',
      phone: '0812-3456-7890',
      email: 'admin@alivecoffee.id',
      instagram: '@alivecoffee.id',
      taxRate: 10,
      accentColor: '#f97316',
      theme: 'dark',
      setupDone: true,
      isActive: true,
      isDemoTenant: false,
      receiptFooter: 'Terima kasih sudah mampir! ☕\nIG: @alivecoffee.id',
    },
  })
  console.log(`✅ Tenant: ${tenant.name} (${tenant.id})`)

  // ─── Users ────────────────────────────────────────────────
  const hashedPassword = await bcrypt.hash('alivecoffee2026', 10)

  await prisma.user.upsert({
    where: { email: 'admin@alivecoffee.id' },
    update: {},
    create: {
      name: 'Rina Admin',
      email: 'admin@alivecoffee.id',
      password: hashedPassword,
      role: 'ADMIN',
      tenantId: tenant.id,
    },
  })

  await prisma.user.upsert({
    where: { email: 'kasir@alivecoffee.id' },
    update: {},
    create: {
      name: 'Dinda Kasir',
      email: 'kasir@alivecoffee.id',
      password: hashedPassword,
      role: 'CASHIER',
      tenantId: tenant.id,
    },
  })
  console.log('✅ Users created')

  // ─── Categories ───────────────────────────────────────────
  const catEspresso = await prisma.category.upsert({
    where: { id: 'ac-cat-espresso' },
    update: { name: 'Espresso Based', icon: '☕', sortOrder: 1 },
    create: { id: 'ac-cat-espresso', name: 'Espresso Based', icon: '☕', tenantId: tenant.id, sortOrder: 1 },
  })

  const catNonCoffee = await prisma.category.upsert({
    where: { id: 'ac-cat-noncoffee' },
    update: { name: 'Non Coffee', icon: '🍵', sortOrder: 2 },
    create: { id: 'ac-cat-noncoffee', name: 'Non Coffee', icon: '🍵', tenantId: tenant.id, sortOrder: 2 },
  })

  const catMeals = await prisma.category.upsert({
    where: { id: 'ac-cat-meals' },
    update: { name: 'Light Meals', icon: '🥗', sortOrder: 3 },
    create: { id: 'ac-cat-meals', name: 'Light Meals', icon: '🥗', tenantId: tenant.id, sortOrder: 3 },
  })

  const catDessert = await prisma.category.upsert({
    where: { id: 'ac-cat-dessert' },
    update: { name: 'Desserts', icon: '🍰', sortOrder: 4 },
    create: { id: 'ac-cat-dessert', name: 'Desserts', icon: '🍰', tenantId: tenant.id, sortOrder: 4 },
  })
  console.log('✅ Categories created')

  // ─── Products ─────────────────────────────────────────────
  // Beberapa stok sengaja rendah untuk demo notif stok
  const products = [
    // Espresso Based
    { id: 'ac-prod-1',  name: 'Espresso',           price: 18000, stock: 48, categoryId: catEspresso.id },
    { id: 'ac-prod-2',  name: 'Americano',           price: 22000, stock: 42, categoryId: catEspresso.id },
    { id: 'ac-prod-3',  name: 'Cappuccino',          price: 26000, stock: 38, categoryId: catEspresso.id },
    { id: 'ac-prod-4',  name: 'Caffe Latte',         price: 26000, stock: 35, categoryId: catEspresso.id },
    { id: 'ac-prod-5',  name: 'Caramel Macchiato',   price: 30000, stock: 28, categoryId: catEspresso.id },
    { id: 'ac-prod-6',  name: 'Cold Brew',           price: 32000, stock: 2,  categoryId: catEspresso.id }, // ← stok kritis!
    { id: 'ac-prod-7',  name: 'Flat White',          price: 28000, stock: 20, categoryId: catEspresso.id },
    // Non Coffee
    { id: 'ac-prod-8',  name: 'Matcha Latte',        price: 28000, stock: 22, categoryId: catNonCoffee.id },
    { id: 'ac-prod-9',  name: 'Teh Susu Thai',       price: 22000, stock: 30, categoryId: catNonCoffee.id },
    { id: 'ac-prod-10', name: 'Chocolate Latte',     price: 26000, stock: 25, categoryId: catNonCoffee.id },
    { id: 'ac-prod-11', name: 'Strawberry Smoothie', price: 30000, stock: 3,  categoryId: catNonCoffee.id }, // ← stok kritis!
    { id: 'ac-prod-12', name: 'Lemon Tea',           price: 18000, stock: 40, categoryId: catNonCoffee.id },
    // Light Meals
    { id: 'ac-prod-13', name: 'Avocado Toast',       price: 38000, stock: 3,  categoryId: catMeals.id },    // ← stok kritis!
    { id: 'ac-prod-14', name: 'Club Sandwich',       price: 42000, stock: 12, categoryId: catMeals.id },
    { id: 'ac-prod-15', name: 'Pasta Carbonara',     price: 45000, stock: 8,  categoryId: catMeals.id },
    { id: 'ac-prod-16', name: 'Nasi Goreng Truffle', price: 48000, stock: 10, categoryId: catMeals.id },
    // Desserts
    { id: 'ac-prod-17', name: 'Croissant',           price: 22000, stock: 2,  categoryId: catDessert.id },  // ← stok kritis!
    { id: 'ac-prod-18', name: 'Banana Bread',        price: 25000, stock: 15, categoryId: catDessert.id },
    { id: 'ac-prod-19', name: 'Cheesecake Slice',    price: 32000, stock: 7,  categoryId: catDessert.id },
    { id: 'ac-prod-20', name: 'Tiramisu',            price: 35000, stock: 5,  categoryId: catDessert.id },
  ]

  for (const p of products) {
    await prisma.product.upsert({
      where: { id: p.id },
      update: { stock: p.stock, price: p.price },
      create: { ...p, tenantId: tenant.id, isActive: true },
    })
  }
  console.log('✅ Products created (4 items stok kritis: Cold Brew=2, Strawberry=3, Avocado Toast=3, Croissant=2)')

  // ─── Orders hari ini (untuk dashboard stats) ──────────────
  // Hapus order lama hari ini dulu biar tidak duplikat
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const existingTodayOrders = await prisma.order.findMany({
    where: { tenantId: tenant.id, createdAt: { gte: todayStart } },
    select: { id: true },
  })
  if (existingTodayOrders.length > 0) {
    const ids = existingTodayOrders.map(o => o.id)
    await prisma.payment.deleteMany({ where: { orderId: { in: ids } } })
    await prisma.orderItem.deleteMany({ where: { orderId: { in: ids } } })
    await prisma.order.deleteMany({ where: { id: { in: ids } } })
    console.log(`🗑️  Hapus ${existingTodayOrders.length} order lama hari ini`)
  }

  const now = new Date()
  const orderData = [
    // Order 1 — selesai pagi (DINE_IN, CASH)
    { num: 'A001', type: 'DINE_IN',   table: 'Meja 3', customer: 'Budi',    items: [{ id: 'ac-prod-3', qty: 2 }, { id: 'ac-prod-17', qty: 1 }], method: 'CASH',  minsAgo: 195 },
    // Order 2 — selesai pagi (TAKE_AWAY, QRIS)
    { num: 'A002', type: 'TAKE_AWAY', table: null,      customer: 'Sari',    items: [{ id: 'ac-prod-6', qty: 1 }, { id: 'ac-prod-13', qty: 1 }], method: 'QRIS',  minsAgo: 180 },
    // Order 3
    { num: 'A003', type: 'DINE_IN',   table: 'Meja 1', customer: 'Rizky',   items: [{ id: 'ac-prod-4', qty: 1 }, { id: 'ac-prod-19', qty: 1 }], method: 'CASH',  minsAgo: 165 },
    // Order 4
    { num: 'A004', type: 'TAKE_AWAY', table: null,      customer: 'Dewi',    items: [{ id: 'ac-prod-8', qty: 2 }, { id: 'ac-prod-18', qty: 1 }], method: 'QRIS',  minsAgo: 150 },
    // Order 5
    { num: 'A005', type: 'DINE_IN',   table: 'Meja 5', customer: 'Andi',    items: [{ id: 'ac-prod-2', qty: 1 }, { id: 'ac-prod-14', qty: 1 }], method: 'CASH',  minsAgo: 132 },
    // Order 6
    { num: 'A006', type: 'DINE_IN',   table: 'Meja 2', customer: 'Nita',    items: [{ id: 'ac-prod-5', qty: 1 }, { id: 'ac-prod-20', qty: 1 }], method: 'QRIS',  minsAgo: 118 },
    // Order 7
    { num: 'A007', type: 'TAKE_AWAY', table: null,      customer: 'Hendra',  items: [{ id: 'ac-prod-1', qty: 2 }, { id: 'ac-prod-17', qty: 1 }], method: 'CASH',  minsAgo: 105 },
    // Order 8
    { num: 'A008', type: 'DINE_IN',   table: 'Meja 4', customer: 'Indah',   items: [{ id: 'ac-prod-7', qty: 1 }, { id: 'ac-prod-15', qty: 1 }], method: 'QRIS',  minsAgo: 90  },
    // Order 9
    { num: 'A009', type: 'TAKE_AWAY', table: null,      customer: 'Fajar',   items: [{ id: 'ac-prod-9', qty: 2 }],                               method: 'CASH',  minsAgo: 75  },
    // Order 10
    { num: 'A010', type: 'DINE_IN',   table: 'Meja 6', customer: 'Laras',   items: [{ id: 'ac-prod-3', qty: 1 }, { id: 'ac-prod-16', qty: 1 }], method: 'QRIS',  minsAgo: 62  },
    // Order 11
    { num: 'A011', type: 'DINE_IN',   table: 'Meja 7', customer: 'Wahyu',   items: [{ id: 'ac-prod-4', qty: 2 }, { id: 'ac-prod-18', qty: 2 }], method: 'CASH',  minsAgo: 50  },
    // Order 12
    { num: 'A012', type: 'TAKE_AWAY', table: null,      customer: 'Putri',   items: [{ id: 'ac-prod-6', qty: 1 }, { id: 'ac-prod-19', qty: 1 }], method: 'QRIS',  minsAgo: 38  },
    // Order 13
    { num: 'A013', type: 'DINE_IN',   table: 'Meja 3', customer: 'Dimas',   items: [{ id: 'ac-prod-10', qty: 1 }, { id: 'ac-prod-14', qty: 1 }], method: 'CASH', minsAgo: 25  },
    // Order 14 — masih PENDING (antrian aktif untuk demo kasir)
    { num: 'A014', type: 'DINE_IN',   table: 'Meja 8', customer: 'Reza',    items: [{ id: 'ac-prod-5', qty: 1 }, { id: 'ac-prod-20', qty: 1 }], method: null,    minsAgo: 10  },
    // Order 15 — masih PENDING (antrian aktif)
    { num: 'A015', type: 'TAKE_AWAY', table: null,      customer: 'Anggi',   items: [{ id: 'ac-prod-8', qty: 1 }, { id: 'ac-prod-11', qty: 1 }], method: null,    minsAgo: 5   },
  ]

  // Map product id → price
  const productMap: Record<string, number> = {}
  for (const p of products) productMap[p.id] = p.price

  let totalRevenue = 0
  let completedCount = 0

  for (const o of orderData) {
    const subtotal = o.items.reduce((sum, i) => sum + (productMap[i.id] * i.qty), 0)
    const tax = Math.round(subtotal * 0.1)
    const total = subtotal + tax
    const status = o.method ? 'COMPLETED' : 'PENDING'
    const createdAt = new Date(now.getTime() - o.minsAgo * 60 * 1000)

    const order = await prisma.order.create({
      data: {
        orderNumber: o.num,
        status,
        type: o.type,
        subtotal,
        tax,
        total,
        discount: 0,
        customerName: o.customer,
        tableNumber: o.table ?? undefined,
        tenantId: tenant.id,
        createdAt,
        updatedAt: createdAt,
        items: {
          create: o.items.map(i => ({
            quantity: i.qty,
            price: productMap[i.id],
            productId: i.id,
          })),
        },
      },
    })

    if (o.method) {
      await prisma.payment.create({
        data: {
          amount: total,
          method: o.method,
          status: 'SUCCESS',
          orderId: order.id,
          createdAt,
          updatedAt: createdAt,
        },
      })
      totalRevenue += total
      completedCount++
    }
  }

  console.log(`✅ ${orderData.length} orders created (${completedCount} completed, 2 pending)`)
  console.log(`💰 Total revenue hari ini: Rp ${totalRevenue.toLocaleString('id-ID')}`)
  console.log('\n📋 Summary untuk screen recording:')
  console.log('   Login  : kasir@alivecoffee.id / alivecoffee2026')
  console.log('   Tenant : alive-coffee')
  console.log('   Stok kritis : Cold Brew (2), Strawberry Smoothie (3), Avocado Toast (3), Croissant (2)')
  console.log('   Order pending : A014 (Meja 8), A015 (Take Away)')
  console.log(`   Revenue hari ini : Rp ${totalRevenue.toLocaleString('id-ID')}`)
  console.log(`   Total order selesai : ${completedCount}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
