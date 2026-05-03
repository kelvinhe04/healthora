import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Theme = 'light' | 'dark';

interface ThemeState {
  theme: Theme;
  toggle: () => void;
  setTheme: (theme: Theme) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: 'light',
      toggle: () => {
        const next = get().theme === 'light' ? 'dark' : 'light';
        set({ theme: next });
        applyTheme(next);
      },
      setTheme: (theme) => {
        set({ theme });
        applyTheme(theme);
      },
    }),
    { name: 'healthora-theme' }
  )
);

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  
  // Apply a transition class globally for a smooth animation
  root.classList.add('theme-transition');
  
  // Force a browser reflow so the transition class registers before the theme changes
  void root.offsetHeight;
  
  if (theme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
  
  // Remove the transition class after animation to avoid lag on hovers/resize
  window.setTimeout(() => {
    root.classList.remove('theme-transition');
  }, 400);
}
