export type ThemeMode = 'light' | 'dark' | 'soft-dark'

export interface AccentPreset {
  name: string
  value: string
  light: string  // ~400
  dark: string   // ~600
}

export const ACCENT_PRESETS: AccentPreset[] = [
  { name: 'Orange',  value: '#f97316', light: '#fb923c', dark: '#ea580c' },
  { name: 'Violet',  value: '#8b5cf6', light: '#a78bfa', dark: '#7c3aed' },
  { name: 'Blue',    value: '#3b82f6', light: '#60a5fa', dark: '#2563eb' },
  { name: 'Emerald', value: '#10b981', light: '#34d399', dark: '#059669' },
  { name: 'Rose',    value: '#f43f5e', light: '#fb7185', dark: '#e11d48' },
  { name: 'Cyan',    value: '#06b6d4', light: '#22d3ee', dark: '#0891b2' },
  { name: 'Amber',   value: '#f59e0b', light: '#fbbf24', dark: '#d97706' },
  { name: 'Indigo',  value: '#6366f1', light: '#818cf8', dark: '#4f46e5' },
]

export const THEME_BG: Record<ThemeMode, { base: string; sidebar: string; surface: string }> = {
  'light':     { base: '#f9f9fb', sidebar: '#f0f0f3', surface: '#ffffff' },
  'dark':      { base: '#0a0a0b', sidebar: '#111113', surface: '#1a1a1c' },
  'soft-dark': { base: '#1c1c1e', sidebar: '#242426', surface: '#2c2c2e' },
}

function clamp(v: number) { return Math.min(255, Math.max(0, v)) }

function adjustHex(hex: string, amount: number): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return hex
  const r = clamp(parseInt(hex.slice(1, 3), 16) + amount)
  const g = clamp(parseInt(hex.slice(3, 5), 16) + amount)
  const b = clamp(parseInt(hex.slice(5, 7), 16) + amount)
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`
}

export function resolveAccentVariants(hex: string): { light: string; main: string; dark: string } {
  const preset = ACCENT_PRESETS.find(p => p.value.toLowerCase() === hex.toLowerCase())
  return {
    light: preset?.light ?? adjustHex(hex, 30),
    main:  hex,
    dark:  preset?.dark  ?? adjustHex(hex, -20),
  }
}

export function getAccentTextColor(hex: string): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return '#000000'
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.45 ? '#000000' : '#ffffff'
}

export function buildThemeVars(accent: string, theme: ThemeMode): React.CSSProperties {
  const { light, main, dark } = resolveAccentVariants(accent)
  const bg = THEME_BG[theme]
  return {
    '--color-orange-400': light,
    '--color-orange-500': main,
    '--color-orange-600': dark,
    '--bg-base':    bg.base,
    '--bg-sidebar': bg.sidebar,
    '--bg-surface': bg.surface,
  } as React.CSSProperties
}
