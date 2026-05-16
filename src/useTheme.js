import { ref } from 'vue'

const THEME_KEY = 'genova60_theme'

function getInitialTheme() {
  const saved = localStorage.getItem(THEME_KEY)
  if (saved === 'dark' || saved === 'light') return saved
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

const isDarkMode = ref(getInitialTheme() === 'dark')

document.documentElement.setAttribute('data-theme', isDarkMode.value ? 'dark' : 'light')

export function useTheme() {
  const toggleTheme = () => {
    isDarkMode.value = !isDarkMode.value
    const theme = isDarkMode.value ? 'dark' : 'light'
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem(THEME_KEY, theme)
  }

  return { isDarkMode, toggleTheme }
}
