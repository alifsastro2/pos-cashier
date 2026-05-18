import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { LoginForm } from '@/components/auth/login-form'

export const metadata = {
  title: 'Login — DigitalBnB POS',
}

export default async function LoginPage() {
  const session = await getSession()

  if (session?.userId) {
    redirect('/kasir')
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <LoginForm />
    </div>
  )
}
