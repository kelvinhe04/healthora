import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { flushSync } from 'react-dom';

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

/** Toggles the theme with a circle-blur wipe (#211) that originates at (x, y) - pass the toggle
 * button's center so the circle grows from where the user clicked, not the screen center. Falls
 * back to the plain `toggle()` crossfade (see `applyTheme` above) when the View Transitions API
 * isn't supported or the user asked for reduced motion, since there's no reasonable degraded
 * version of a clip-path wipe. */
export function toggleThemeWithTransition(x: number, y: number) {
  const { toggle } = useThemeStore.getState();

  const supportsViewTransitions = typeof document.startViewTransition === 'function';
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!supportsViewTransitions || reducedMotion) {
    toggle();
    return;
  }

  const endRadius = Math.hypot(
    Math.max(x, window.innerWidth - x),
    Math.max(y, window.innerHeight - y)
  );

  const transition = document.startViewTransition(() => {
    flushSync(() => toggle());
  });

  transition.ready
    .then(() => {
      document.documentElement.animate(
        {
          clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${endRadius}px at ${x}px ${y}px)`],
          filter: ['blur(14px)', 'blur(0px)'],
        },
        {
          duration: 550,
          easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
          pseudoElement: '::view-transition-new(root)',
        }
      );
    })
    .catch(() => {
      // transition.ready rejects if the transition gets skipped/interrupted (e.g. another one
      // starts first) - the theme state already updated synchronously above either way.
    });
}
