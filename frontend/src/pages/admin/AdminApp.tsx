import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { useQuery } from '@tanstack/react-query';
import { Sidebar, KpiCard, PageHeader, Card, LineChart, BarChart, StatusPill, tableStyle, th, td, trStyle, iconBtnAd } from '../../components/admin';
import { ProductImage } from '../../components/shared/ProductImage';
import { Button } from '../../components/shared/Button';
import { Icon } from '../../components/shared/Icon';
import { api } from '../../lib/api';
import type { Product } from '../../types';

type AdminPage = 'dashboard' | 'orders' | 'products' | 'users' | 'sales' | 'earnings';

interface AdminAppProps { onGoToStore: () => void; }

function AdminDashboard() {
  const { getToken } = useAuth();
  const { data } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: async () => { const t = await getToken(); return api.admin.dashboard(t!); },
    staleTime: 60000,
  });
  const d = data as { kpis?: { revenue?: number; revenueDelta?: number; totalOrders?: number; monthOrders?: number; totalUsers?: number; lowStock?: number }; dailySales?: { revenue: number; date: string }[]; recentOrders?: { _id: string; customerName?: string; customerEmail?: string; items?: unknown[]; total?: number; status?: string; createdAt?: string; stripeSessionId?: string }[] } | undefined;
  const kpis = d?.kpis;
  return (
    <>
      <PageHeader kicker="Panel de administración" title={<>Dashboard <em style={{ color: 'var(--green)' }}>Healthora</em></>} sub="Resumen general de operaciones, ventas y actividad reciente." />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        <KpiCard mode="dark" label="Ingresos mes" value={kpis ? `$${kpis.revenue?.toLocaleString()}` : '—'} delta={kpis?.revenueDelta} sub="vs mes anterior" />
        <KpiCard label="Órdenes mes" value={kpis?.monthOrders ?? '—'} />
        <KpiCard label="Usuarios" value={kpis?.totalUsers ?? '—'} />
        <KpiCard label="Stock bajo" value={kpis?.lowStock ?? '—'} sub="productos ≤5 unidades" />
      </div>
      {d?.dailySales && d.dailySales.length > 0 && (
        <Card title="Ingresos · últimos 30 días" sub="Revenue diario, en USD">
          <LineChart data={d.dailySales} height={240} />
        </Card>
      )}
    </>
  );
}

function AdminOrders() {
  const { getToken } = useAuth();
  const [filter, setFilter] = useState('');
  const { data: orders = [] } = useQuery({
    queryKey: ['admin-orders', filter],
    queryFn: async () => { const t = await getToken(); return api.admin.orders(t!, filter || undefined) as Promise<{ _id: string; customerName?: string; customerEmail?: string; items?: unknown[]; total?: number; status?: string; createdAt?: string; stripeSessionId?: string }[]>; },
  });
  const statuses = ['', 'paid', 'processing', 'shipped', 'delivered', 'pending_payment', 'cancelled', 'refunded'];
  const statusLabels: Record<string, string> = { '': 'Todas', 'paid': 'Pagada', 'processing': 'En preparación', 'shipped': 'Enviada', 'delivered': 'Entregada', 'pending_payment': 'Pendiente', 'cancelled': 'Cancelada', 'refunded': 'Reembolsada' };
  return (
    <>
      <PageHeader kicker="Pedidos" title={<>Gestión de <em style={{ color: 'var(--green)' }}>pedidos</em></>} sub="Los pagos se sincronizan automáticamente vía webhooks de Stripe." />
      <Card pad={0}>
        <div style={{ padding: '20px 24px', display: 'flex', flexWrap: 'wrap', gap: 6, borderBottom: '1px solid var(--ink-06)' }}>
          {statuses.map((s) => <button key={s} onClick={() => setFilter(s)} style={{ padding: '7px 14px', borderRadius: 999, fontSize: 12, cursor: 'pointer', border: '1px solid ' + (filter === s ? 'var(--ink)' : 'var(--ink-20)'), background: filter === s ? 'var(--ink)' : 'transparent', color: filter === s ? 'var(--cream)' : 'var(--ink)', fontFamily: '"Geist", sans-serif' }}>{statusLabels[s]}</button>)}
        </div>
        <table style={tableStyle}>
          <thead><tr><th style={th}>Orden</th><th style={th}>Cliente</th><th style={th}>Items</th><th style={th}>Total</th><th style={th}>Estado</th><th style={th}>Fecha</th></tr></thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o._id} style={trStyle}>
                <td style={{ ...td, fontFamily: '"JetBrains Mono", monospace', fontSize: 12 }}>{o._id.slice(-8).toUpperCase()}</td>
                <td style={td}><div style={{ fontSize: 13, fontWeight: 500 }}>{o.customerName}</div><div style={{ fontSize: 11, color: 'var(--ink-60)' }}>{o.customerEmail}</div></td>
                <td style={{ ...td, fontFamily: '"JetBrains Mono", monospace' }}>{(o.items?.length) ?? 0}</td>
                <td style={{ ...td, fontFamily: '"Instrument Serif", serif', fontSize: 18 }}>${(o.total ?? 0).toFixed(2)}</td>
                <td style={td}><StatusPill status={o.status || 'pending_payment'} /></td>
                <td style={{ ...td, fontSize: 11, color: 'var(--ink-60)', fontFamily: '"JetBrains Mono", monospace' }}>{o.createdAt ? new Date(o.createdAt).toLocaleDateString() : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}

function AdminProducts() {
  const { getToken } = useAuth();
  const [cat, setCat] = useState('Todos');
  const { data: products = [] } = useQuery({
    queryKey: ['admin-products'],
    queryFn: async () => { const t = await getToken(); return api.admin.products.list(t!); },
  });
  const categories = [...new Set(products.map((p) => p.category))];
  const filtered = cat === 'Todos' ? products : products.filter((p) => p.category === cat);
  return (
    <>
      <PageHeader kicker={`Catálogo · ${products.length} productos`} title={<>Gestión de <em style={{ color: 'var(--green)' }}>productos</em></>}
        actions={<><Button variant="outline" size="md">Importar CSV</Button><Button variant="primary" size="md" icon={<Icon name="plus" size={14} />}>Nuevo producto</Button></>} />
      <Card pad={0}>
        <div style={{ padding: '20px 24px', display: 'flex', gap: 6, flexWrap: 'wrap', borderBottom: '1px solid var(--ink-06)' }}>
          {['Todos', ...categories.slice(0, 6)].map((c) => <button key={c} onClick={() => setCat(c)} style={{ padding: '7px 14px', borderRadius: 999, fontSize: 12, cursor: 'pointer', border: '1px solid ' + (cat === c ? 'var(--ink)' : 'var(--ink-20)'), background: cat === c ? 'var(--ink)' : 'transparent', color: cat === c ? 'var(--cream)' : 'var(--ink)', fontFamily: '"Geist", sans-serif' }}>{c}</button>)}
        </div>
        <table style={tableStyle}>
          <thead><tr><th style={th}>Producto</th><th style={th}>Categoría</th><th style={th}>Precio</th><th style={th}>Stock</th><th style={th}>Estado</th><th style={th}></th></tr></thead>
          <tbody>
            {filtered.map((p: Product) => (
              <tr key={p.id} style={trStyle}>
                <td style={td}><div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 44, height: 50, background: p.color, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><ProductImage product={p} size="xs" /></div>
                  <div><div style={{ fontSize: 13, fontWeight: 500 }}>{p.name}</div><div style={{ fontSize: 11, color: 'var(--ink-60)', fontFamily: '"JetBrains Mono", monospace' }}>{p.brand}</div></div>
                </div></td>
                <td style={{ ...td, fontSize: 12 }}>{p.category}</td>
                <td style={td}><div style={{ fontFamily: '"Instrument Serif", serif', fontSize: 18 }}>${p.price.toFixed(2)}</div></td>
                <td style={td}><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 60, height: 4, background: 'var(--ink-06)', borderRadius: 999, overflow: 'hidden' }}><div style={{ width: Math.min(100, p.stock / 1.3) + '%', height: '100%', background: p.stock > 20 ? 'var(--green)' : 'var(--coral)' }} /></div>
                  <span style={{ fontSize: 12, fontFamily: '"JetBrains Mono", monospace' }}>{p.stock}</span>
                </div></td>
                <td style={td}><StatusPill status={p.active ? 'Activo' : 'Inactivo'} /></td>
                <td style={td}><button style={iconBtnAd}><Icon name="chevron-right" size={14} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}

function AdminUsers() {
  const { getToken } = useAuth();
  const { data: users = [] } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => { const t = await getToken(); return api.admin.users(t!) as Promise<{ _id: string; name?: string; email?: string; role?: string; orderCount?: number; ltv?: number; createdAt?: string }[]>; },
  });
  return (
    <>
      <PageHeader kicker={`Usuarios · ${users.length} cuentas`} title={<>Gestión de <em style={{ color: 'var(--green)' }}>usuarios</em></>} />
      <Card pad={0}>
        <table style={tableStyle}>
          <thead><tr><th style={th}>Usuario</th><th style={th}>Rol</th><th style={th}>Órdenes</th><th style={th}>LTV</th><th style={th}>Registro</th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u._id} style={trStyle}>
                <td style={td}><div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 999, background: 'var(--green)', color: 'var(--lime)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '"Instrument Serif", serif', fontSize: 15 }}>{(u.name || 'U')[0]}</div>
                  <div><div style={{ fontSize: 13, fontWeight: 500 }}>{u.name}</div><div style={{ fontSize: 11, color: 'var(--ink-60)', fontFamily: '"JetBrains Mono", monospace' }}>{u.email}</div></div>
                </div></td>
                <td style={td}><span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, background: u.role === 'admin' ? 'var(--lime)' : 'var(--ink-06)', fontFamily: '"JetBrains Mono", monospace' }}>{(u.role || 'customer').toUpperCase()}</span></td>
                <td style={{ ...td, fontFamily: '"JetBrains Mono", monospace' }}>{u.orderCount ?? 0}</td>
                <td style={{ ...td, fontFamily: '"Instrument Serif", serif', fontSize: 18 }}>${(u.ltv ?? 0).toFixed(2)}</td>
                <td style={{ ...td, fontSize: 12, color: 'var(--ink-60)', fontFamily: '"JetBrains Mono", monospace' }}>{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}

function AdminSales() {
  const { getToken } = useAuth();
  const { data } = useQuery({
    queryKey: ['admin-sales'],
    queryFn: async () => { const t = await getToken(); return api.admin.sales(t!) as Promise<{ daily?: { revenue: number; date: string }[]; topProducts?: { _id: string; revenue: number; units: number }[] }>; },
  });
  return (
    <>
      <PageHeader kicker="Ventas" title={<>Análisis de <em style={{ color: 'var(--green)' }}>ventas</em></>} />
      {data?.daily && data.daily.length > 0 && (
        <Card title="Tendencia de ventas" sub="Ingresos diarios · últimos 30 días">
          <LineChart data={data.daily} height={260} />
        </Card>
      )}
    </>
  );
}

function AdminEarnings() {
  const { getToken } = useAuth();
  const { data } = useQuery({
    queryKey: ['admin-earnings'],
    queryFn: async () => { const t = await getToken(); return api.admin.earnings(t!) as Promise<{ monthly?: { month: string; revenue: number }[]; summary?: { gross: number; tax: number; shipping: number; fees: number; net: number; orders: number } }>; },
  });
  const s = data?.summary;
  return (
    <>
      <PageHeader kicker="Ganancias · YTD 2026" title={<>Las <em style={{ color: 'var(--green)' }}>ganancias</em></>} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        <KpiCard mode="dark" label="Ingresos brutos" value={s ? `$${s.gross.toLocaleString()}` : '—'} />
        <KpiCard label="Impuestos" value={s ? `$${s.tax.toFixed(2)}` : '—'} />
        <KpiCard label="Utilidad neta" value={s ? `$${s.net.toLocaleString()}` : '—'} />
        <KpiCard label="Comisiones Stripe" value={s ? `$${s.fees.toFixed(2)}` : '—'} sub="~2.9%" />
      </div>
      {data?.monthly && data.monthly.length > 0 && (
        <Card title="Ganancias · últimos 6 meses" sub="Utilidad neta en USD">
          <BarChart data={data.monthly.map((m) => ({ ...m, date: m.month }))} height={240} />
        </Card>
      )}
    </>
  );
}

export function AdminApp({ onGoToStore }: AdminAppProps) {
  const [page, setPage] = useState<AdminPage>('dashboard');

  useEffect(() => {
    const v = localStorage.getItem('healthora_admin_page') as AdminPage | null;
    if (v) setPage(v);
  }, []);
  useEffect(() => { localStorage.setItem('healthora_admin_page', page); }, [page]);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', minHeight: '100vh', background: 'var(--cream-2)' }}>
      <Sidebar page={page} setPage={setPage} onGoToStore={onGoToStore} />
      <div style={{ padding: '36px 48px 80px', overflow: 'auto' }}>
        {page === 'dashboard' && <AdminDashboard />}
        {page === 'users' && <AdminUsers />}
        {page === 'orders' && <AdminOrders />}
        {page === 'products' && <AdminProducts />}
        {page === 'sales' && <AdminSales />}
        {page === 'earnings' && <AdminEarnings />}
      </div>
    </div>
  );
}
