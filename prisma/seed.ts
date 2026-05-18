import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../lib/generated/prisma/client'
import bcrypt from 'bcryptjs'

const adapter = new PrismaPg(process.env.DATABASE_URL!)
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('Seeding database...')

  const tenant = await prisma.tenant.upsert({
    where: { slug: 'kafe-demo' },
    update: {},
    create: {
      name: 'Kafe Bintang',
      slug: 'kafe-demo',
      address: 'Jl. Contoh No. 123, Jakarta',
      phone: '08123456789',
      email: 'admin@kafebintang.com',
      taxRate: 10,
      setupDone: true,
    },
  })

  const hashedPassword = await bcrypt.hash('password123', 10)

  await prisma.user.upsert({
    where: { email: 'admin@demo.com' },
    update: {},
    create: {
      name: 'Admin Demo',
      email: 'admin@demo.com',
      password: hashedPassword,
      role: 'ADMIN',
      tenantId: tenant.id,
    },
  })

  await prisma.user.upsert({
    where: { email: 'kasir@demo.com' },
    update: {},
    create: {
      name: 'Budi Kasir',
      email: 'kasir@demo.com',
      password: hashedPassword,
      role: 'CASHIER',
      tenantId: tenant.id,
    },
  })

  const makanan = await prisma.category.upsert({
    where: { id: 'cat-makanan' },
    update: {},
    create: { id: 'cat-makanan', name: 'Makanan', icon: '🍔', tenantId: tenant.id, sortOrder: 1 },
  })

  const minuman = await prisma.category.upsert({
    where: { id: 'cat-minuman' },
    update: {},
    create: { id: 'cat-minuman', name: 'Minuman', icon: '☕', tenantId: tenant.id, sortOrder: 2 },
  })

  const snack = await prisma.category.upsert({
    where: { id: 'cat-snack' },
    update: {},
    create: { id: 'cat-snack', name: 'Snack', icon: '🍪', tenantId: tenant.id, sortOrder: 3 },
  })

  const products = [
    { id: 'prod-1', name: 'Nasi Goreng Spesial', price: 25000, categoryId: makanan.id },
    { id: 'prod-2', name: 'Ayam Bakar Madu', price: 35000, categoryId: makanan.id },
    { id: 'prod-3', name: 'Mie Goreng Seafood', price: 28000, categoryId: makanan.id },
    { id: 'prod-4', name: 'Soto Ayam', price: 22000, categoryId: makanan.id },
    { id: 'prod-5', name: 'Kopi Susu Kekinian', price: 18000, categoryId: minuman.id },
    { id: 'prod-6', name: 'Es Teh Manis', price: 8000, categoryId: minuman.id },
    { id: 'prod-7', name: 'Matcha Latte', price: 22000, categoryId: minuman.id },
    { id: 'prod-8', name: 'Jus Alpukat', price: 20000, categoryId: minuman.id },
    { id: 'prod-9', name: 'Kentang Goreng', price: 15000, categoryId: snack.id },
    { id: 'prod-10', name: 'Pisang Goreng Crispy', price: 12000, categoryId: snack.id },
    { id: 'prod-11', name: 'Roti Bakar', price: 18000, categoryId: snack.id },
    { id: 'prod-12', name: 'Dimsum 4 pcs', price: 25000, categoryId: snack.id },
  ]

  for (const product of products) {
    await prisma.product.upsert({
      where: { id: product.id },
      update: {},
      create: { ...product, tenantId: tenant.id },
    })
  }

  console.log('✅ Seed selesai!')
  console.log('📧 Login: admin@demo.com | kasir@demo.com')
  console.log('🔑 Password: password123')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
