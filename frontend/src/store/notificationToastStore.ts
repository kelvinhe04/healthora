import { create } from 'zustand';
import type { AppNotification } from '../types';

/** Transient, auto-dismissing toasts shown when a notification arrives over the WebSocket, so the
 * user is informed "al instante sin recargar" (HU-061) even if the bell dropdown is closed. These
 * are ephemeral UI only - the durable copy lives in the persistent notification center. */
export interface Toast {
  id: string;
  notification: AppNotification;
}

interface ToastState {
  toasts: Toast[];
  push: (notification: AppNotification) => void;
  dismiss: (id: string) => void;
}

let seq = 0;

export const useNotificationToastStore = create<ToastState>()((set) => ({
  toasts: [],
  push: (notification) =>
    set((state) => {
      seq += 1;
      const toast: Toast = { id: `${notification.id}-${seq}`, notification };
      // Cap the stack so a burst of events can't cover the screen.
      const toasts = [toast, ...state.toasts].slice(0, 4);
      return { toasts };
    }),
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));
