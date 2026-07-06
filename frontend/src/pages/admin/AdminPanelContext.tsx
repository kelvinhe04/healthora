import { createContext, useContext, type ReactNode } from 'react';
import { useAdminPanel, type AdminPanelState } from './hooks/useAdminPanel';
import type { AdminAccess } from './types';

const AdminPanelContext = createContext<AdminPanelState | null>(null);

export function useAdminPanelContext(): AdminPanelState {
  const ctx = useContext(AdminPanelContext);
  if (!ctx) {
    throw new Error('useAdminPanelContext must be used within AdminPanelProvider');
  }
  return ctx;
}

export function AdminPanelProvider({
  access,
  onGoToStore,
  children,
}: {
  access: AdminAccess;
  onGoToStore: () => void;
  children: ReactNode;
}) {
  const value = useAdminPanel({ access, onGoToStore });
  return (
    <AdminPanelContext.Provider value={value}>{children}</AdminPanelContext.Provider>
  );
}
