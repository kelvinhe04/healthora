import type { AdminAppProps } from './types';
import { AdminAccessGate } from './AdminAccessGate';

export function AdminApp({ onGoToStore }: AdminAppProps) {
  return <AdminAccessGate onGoToStore={onGoToStore} />;
}
