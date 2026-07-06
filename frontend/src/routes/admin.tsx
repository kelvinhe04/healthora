import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { AdminApp } from '../pages/admin/AdminApp';

export const Route = createFileRoute('/admin')({
  component: AdminRoute,
});

function AdminRoute() {
  const navigate = useNavigate();
  return <AdminApp onGoToStore={() => navigate({ to: '/' })} />;
}
