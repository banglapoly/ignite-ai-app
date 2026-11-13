export type ThemeChoice = 'light' | 'dark' | 'system'
export const THEME_KEY = 'ignite-theme'

export function readChoice(): ThemeChoice {
  try {
    const v = localStorage.getItem(THEME_KEY)
    if (v === 'light' || v === 'dark' || v === 'system') return v
  } catch { /* storage blocked */ }
  return 'system'
}

export function resolveTheme(choice: ThemeChoice): 'light' | 'dark' {
  if (choice === 'light' || choice === 'dark') return choice
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function applyTheme(choice: ThemeChoice) {
  const theme = resolveTheme(choice)
  document.documentElement.dataset.theme = theme
  document.documentElement.dataset.themeChoice = choice
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', theme === 'dark' ? '#141820' : '#ffffff')
  return theme
}

export function saveChoice(choice: ThemeChoice) {
  try { localStorage.setItem(THEME_KEY, choice) } catch { /* storage blocked */ }
  applyTheme(choice)
  return choice
}
