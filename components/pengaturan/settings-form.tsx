'use client'

import { useState, useTransition, useRef, useCallback } from 'react'
import { motion } from 'motion/react'
import { Store, Lock, Check, AlertCircle, ImageIcon, Palette, Plus } from 'lucide-react'
import { updateSettings, updatePassword, updateUserTheme, updateAccentColor } from '@/app/actions/settings'
import { ImageUpload } from '@/components/ui/image-upload'
import { ACCENT_PRESETS, THEME_BG, buildThemeVars, type ThemeMode } from '@/lib/utils/color'

type Tenant = {
  name: string
  logo: string | null
  address: string | null
  phone: string | null
  email: string | null
  instagram: string | null
  receiptFooter: string | null
  taxRate: number
  accentColor: string | null
  theme: string | null
}

interface SettingsFormProps {
  tenant: Tenant
  role: string
  userTheme: string | null
}

function Section({ title, icon: Icon, children }: {
  title: React.ReactNode
  icon: React.ElementType
  children: React.ReactNode
}) {
  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-zinc-200 dark:border-zinc-800">
        <div className="w-8 h-8 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
          <Icon className="w-4 h-4 text-orange-500" />
        </div>
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
        {label} {required && <span className="text-orange-500">*</span>}
      </label>
      {children}
    </div>
  )
}

const inputClass = "w-full h-10 px-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white text-sm placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-orange-500 transition-colors"

export function SettingsForm({ tenant, role, userTheme }: SettingsFormProps) {
  const isAdmin = role === 'ADMIN'
  const [, startAppearanceTransition] = useTransition()
  const [appearanceSaved, setAppearanceSaved] = useState(false)
  const accentDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showSaved = useCallback(() => {
    setAppearanceSaved(true)
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
    savedTimerRef.current = setTimeout(() => setAppearanceSaved(false), 2000)
  }, [])

  const saveTheme = useCallback((mode: ThemeMode) => {
    startAppearanceTransition(async () => {
      await updateUserTheme(mode)
      showSaved()
    })
  }, [showSaved])

  const saveAccent = useCallback((accent: string) => {
    if (!/^#[0-9a-fA-F]{6}$/.test(accent)) return
    startAppearanceTransition(async () => {
      await updateAccentColor(accent)
      showSaved()
    })
  }, [showSaved])
  const [settingsPending, startSettingsTransition] = useTransition()
  const [passwordPending, startPasswordTransition] = useTransition()
  const [settingsMsg, setSettingsMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [logoUrl, setLogoUrl] = useState<string | null>(tenant.logo ?? null)
  const [themeMode, setThemeMode] = useState<ThemeMode>(((userTheme ?? tenant.theme) as ThemeMode) ?? 'dark')
  const [accentColor, setAccentColor] = useState(tenant.accentColor ?? '#f97316')

  const isCustomAccent = !ACCENT_PRESETS.some(p => p.value.toLowerCase() === accentColor.toLowerCase())

  function applyPreview(mode: ThemeMode, accent: string) {
    const el = document.querySelector('[data-theme]') as HTMLElement | null
    if (!el) return
    el.setAttribute('data-theme', mode)
    if (mode === 'light') {
      el.classList.remove('dark')
    } else {
      el.classList.add('dark')
    }
    const vars = buildThemeVars(accent, mode)
    Object.entries(vars).forEach(([k, v]) => el.style.setProperty(k, v as string))
  }

  function handleThemeChange(mode: ThemeMode) {
    setThemeMode(mode)
    applyPreview(mode, accentColor)
    saveTheme(mode)
  }

  function handleAccentChange(hex: string) {
    setAccentColor(hex)
    if (/^#[0-9a-fA-F]{6}$/.test(hex)) {
      applyPreview(themeMode, hex)
      if (accentDebounceRef.current) clearTimeout(accentDebounceRef.current)
      accentDebounceRef.current = setTimeout(() => saveAccent(hex), 600)
    }
  }

  function handleSettings(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSettingsMsg(null)
    const fd = new FormData(e.currentTarget)
    fd.set('logo', logoUrl ?? '')
    startSettingsTransition(async () => {
      const result = await updateSettings(fd)
      if (result?.error) {
        setSettingsMsg({ type: 'error', text: result.error })
      } else {
        setSettingsMsg({ type: 'success', text: 'Pengaturan berhasil disimpan!' })
      }
    })
  }

  function handlePassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setPasswordMsg(null)
    const fd = new FormData(e.currentTarget)
    startPasswordTransition(async () => {
      const result = await updatePassword(fd)
      if (result?.error) {
        setPasswordMsg({ type: 'error', text: result.error })
      } else {
        setPasswordMsg({ type: 'success', text: 'Password berhasil diubah!' })
        ;(e.target as HTMLFormElement).reset()
      }
    })
  }

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <h1 className="text-xl font-bold text-zinc-900 dark:text-white">Pengaturan</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
          {isAdmin ? 'Kelola informasi toko dan akun Anda' : 'Kelola tampilan dan akun Anda'}
        </p>
      </div>

      {/* Logo — admin only */}
      {isAdmin && (
        <Section title="Logo Toko" icon={ImageIcon}>
          <div className="flex items-center gap-5">
            <div className="w-20 h-20 rounded-2xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 flex items-center justify-center overflow-hidden shrink-0">
              {logoUrl ? (
                <img src={logoUrl} alt="logo" className="w-full h-full object-cover" />
              ) : (
                <Store className="w-8 h-8 text-zinc-400 dark:text-zinc-600" />
              )}
            </div>
            <div className="flex-1">
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-3">Logo muncul di sidebar dan struk pembayaran. Disarankan gambar persegi (1:1).</p>
              <ImageUpload
                value={logoUrl}
                onChange={setLogoUrl}
                label="Upload Logo"
                enableCrop
                aspectRatio={1}
                className="!space-y-0"
              />
            </div>
          </div>
        </Section>
      )}

      {/* Appearance */}
      <Section title={
        <span className="flex items-center gap-2">
          Tampilan
          {appearanceSaved && (
            <span className="text-xs font-normal text-emerald-500 flex items-center gap-1">
              <Check className="w-3 h-3" /> Tersimpan
            </span>
          )}
        </span>
      } icon={Palette}>
        <div className="space-y-6">
          {/* Theme mode */}
          <div>
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-3">Mode Tampilan</p>
            <div className="grid grid-cols-3 gap-3">
              {([
                { mode: 'light' as ThemeMode, label: 'Light', desc: 'Terang & bersih' },
                { mode: 'soft-dark' as ThemeMode, label: 'Soft Dark', desc: 'Abu-abu lembut' },
                { mode: 'dark' as ThemeMode, label: 'Dark', desc: 'Hitam pekat' },
              ]).map(({ mode, label, desc }) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => handleThemeChange(mode)}
                  className={`relative p-3 rounded-xl border-2 text-left transition-all ${
                    themeMode === mode
                      ? 'border-[var(--color-orange-500)] bg-[var(--color-orange-500)]/5'
                      : 'border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 hover:border-zinc-300 dark:hover:border-zinc-600'
                  }`}
                >
                  <div className="flex gap-1 mb-2">
                    <div className="w-5 h-4 rounded" style={{ background: THEME_BG[mode].sidebar }} />
                    <div className="flex-1 h-4 rounded" style={{ background: THEME_BG[mode].base }} />
                  </div>
                  <p className="text-xs font-semibold text-zinc-900 dark:text-white">{label}</p>
                  <p className="text-[10px] text-zinc-500 mt-0.5 leading-tight">{desc}</p>
                  {themeMode === mode && (
                    <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-[var(--color-orange-500)] flex items-center justify-center">
                      <Check className="w-2.5 h-2.5 text-black" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Accent color — admin only */}
          {isAdmin && <div>
            <div className="flex items-center gap-2 mb-3">
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Warna Aksen</p>
              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-orange-500/10 text-orange-500 font-medium">Admin</span>
            </div>
            <div className="flex flex-wrap gap-2.5 mb-3">
              {ACCENT_PRESETS.map(preset => {
                const isActive = accentColor.toLowerCase() === preset.value.toLowerCase()
                return (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => handleAccentChange(preset.value)}
                    title={preset.name}
                    className="relative w-8 h-8 rounded-full transition-transform hover:scale-110 focus:outline-none"
                    style={{ background: preset.value }}
                  >
                    {isActive && (
                      <div className="absolute -inset-1 rounded-full border-2 border-white pointer-events-none" />
                    )}
                    {isActive && (
                      <Check className="absolute inset-0 m-auto w-3.5 h-3.5 drop-shadow-sm" style={{ color: '#fff' }} />
                    )}
                  </button>
                )
              })}
              {/* Custom picker */}
              <label
                title="Warna kustom"
                className="relative w-8 h-8 rounded-full cursor-pointer transition-transform hover:scale-110 flex items-center justify-center"
                style={{ background: isCustomAccent ? accentColor : '#d4d4d8' }}
              >
                <input
                  type="color"
                  value={accentColor}
                  onChange={(e) => handleAccentChange(e.target.value)}
                  className="sr-only"
                />
                {isCustomAccent ? (
                  <>
                    <div className="absolute -inset-1 rounded-full border-2 border-white pointer-events-none" />
                    <Check className="w-3.5 h-3.5 drop-shadow-sm" style={{ color: '#fff' }} />
                  </>
                ) : (
                  <Plus className="w-4 h-4 text-zinc-400" />
                )}
              </label>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-md shrink-0 border border-black/10 dark:border-white/10" style={{ background: accentColor }} />
              <input
                value={accentColor}
                onChange={(e) => {
                  const v = e.target.value
                  if (/^#?[0-9a-fA-F]{0,6}$/.test(v)) {
                    const hex = v.startsWith('#') ? v : '#' + v
                    setAccentColor(hex)
                    if (/^#[0-9a-fA-F]{6}$/.test(hex)) applyPreview(themeMode, hex)
                  }
                }}
                maxLength={7}
                className="h-8 w-28 px-2.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white text-sm font-mono focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-500 transition-colors"
                placeholder="#f97316"
              />
              <span className="text-xs text-zinc-500">Kode warna HEX</span>
            </div>
          </div>}
        </div>
      </Section>

      {/* Business Info — admin only */}
      {isAdmin && <Section title="Informasi Toko" icon={Store}>
        <form onSubmit={handleSettings} className="space-y-4">
          {settingsMsg && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm ${
                settingsMsg.type === 'success'
                  ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                  : 'bg-red-500/10 border border-red-500/20 text-red-400'
              }`}
            >
              {settingsMsg.type === 'success' ? (
                <Check className="w-4 h-4 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              {settingsMsg.text}
            </motion.div>
          )}

          <Field label="Nama Toko" required>
            <input name="name" defaultValue={tenant.name} required className={inputClass} placeholder="Nama toko Anda" />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Nomor Telepon">
              <input name="phone" defaultValue={tenant.phone ?? ''} className={inputClass} placeholder="08xxxxxxxxxx" />
            </Field>
            <Field label="Email">
              <input name="email" type="email" defaultValue={tenant.email ?? ''} className={inputClass} placeholder="email@toko.com" />
            </Field>
          </div>

          <Field label="Alamat">
            <textarea
              name="address"
              defaultValue={tenant.address ?? ''}
              rows={2}
              className="w-full px-3 py-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white text-sm placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-orange-500 transition-colors resize-none"
              placeholder="Alamat lengkap toko"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Instagram">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">@</span>
                <input
                  name="instagram"
                  defaultValue={tenant.instagram ?? ''}
                  className="w-full h-10 pl-7 pr-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white text-sm placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-orange-500 transition-colors"
                  placeholder="namatoko"
                />
              </div>
            </Field>
            <Field label="Pajak (%)">
              <div className="relative">
                <input
                  name="taxRate"
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  defaultValue={tenant.taxRate}
                  className={inputClass}
                  placeholder="0"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">%</span>
              </div>
            </Field>
          </div>

          <Field label="Pesan Footer Struk">
            <input
              name="receiptFooter"
              defaultValue={tenant.receiptFooter ?? ''}
              className={inputClass}
              placeholder="Terima kasih sudah berkunjung!"
              maxLength={80}
            />
            <p className="text-xs text-zinc-400 dark:text-zinc-600 mt-1">Muncul di bagian bawah struk pembeli. Kosongkan untuk tidak menampilkan.</p>
          </Field>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={settingsPending}
              className="h-9 px-5 rounded-xl bg-orange-500 text-black text-sm font-semibold hover:bg-orange-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {settingsPending ? 'Menyimpan...' : 'Simpan Perubahan'}
            </button>
          </div>
        </form>
      </Section>}

      {/* Change Password */}
      <Section title="Ubah Password" icon={Lock}>
        <form onSubmit={handlePassword} className="space-y-4">
          {passwordMsg && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm ${
                passwordMsg.type === 'success'
                  ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                  : 'bg-red-500/10 border border-red-500/20 text-red-400'
              }`}
            >
              {passwordMsg.type === 'success' ? (
                <Check className="w-4 h-4 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              {passwordMsg.text}
            </motion.div>
          )}

          <Field label="Password Saat Ini" required>
            <input name="currentPassword" type="password" required className={inputClass} placeholder="••••••••" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Password Baru" required>
              <input name="newPassword" type="password" required minLength={8} className={inputClass} placeholder="Min. 8 karakter" />
            </Field>
            <Field label="Konfirmasi Password" required>
              <input name="confirmPassword" type="password" required className={inputClass} placeholder="Ulangi password baru" />
            </Field>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={passwordPending}
              className="h-9 px-5 rounded-xl bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-white text-sm font-semibold hover:bg-zinc-300 dark:hover:bg-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {passwordPending ? 'Mengubah...' : 'Ubah Password'}
            </button>
          </div>
        </form>
      </Section>
    </div>
  )
}
