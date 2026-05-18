import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { OnboardingForm } from '@/components/onboarding/onboarding-form'

export const metadata = { title: 'Setup Toko — DigitalBnB POS' }

export default async function OnboardingPage() {
  const session = await getSession()
  if (!session?.userId) redirect('/login')

  return (
    <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-orange-500/8 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-orange-600/6 rounded-full blur-3xl" />
      </div>
      <OnboardingForm />
    </div>
  )
}
