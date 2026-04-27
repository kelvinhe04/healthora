import { BarChart as RechartsBar, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart as RechartsLine, Line, CartesianGrid } from 'recharts';
import { useMemo, useState, useEffect } from 'react';
import { memo } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Icon } from '../shared/Icon';
const Ctx = ({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) => {
  if (active && payload?.length) {
    return <div style={{ background: 'var(--cream)', border: '1px solid var(--ink-06)', borderRadius: 8, padding: '8px 12px', fontSize: 12, fontFamily: '"JetBrains Mono", monospace' }}>{label}: ${payload[0].value}</div>;
  }
  return null;
};

function Skeleton({ height = 20, width, borderRadius = 4 }: { height?: number; width?: string | number; borderRadius?: number }) {
  return (
    <div style={{
      height,
      width: width ?? '100%',
      borderRadius,
      background: 'oklch(0.88 0 0)',
      position: 'relative',
      overflow: 'hidden',
      flexShrink: 0,
    }}>
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.82) 50%, transparent 100%)',
        animation: 'shimmer 1.4s linear infinite',
        willChange: 'transform',
      }} />
    </div>
  );
}

/** Skeleton for large headings – matches Instrument Serif h1 / h3 sizing */
function SkeletonTitle({ size = 'lg', width = '55%' }: { size?: 'lg' | 'md'; width?: string }) {
  const height = size === 'lg' ? 54 : 32;
  const radius = size === 'lg' ? 12 : 8;
  return (
    <div style={{
      height,
      width,
      borderRadius: radius,
      background: 'oklch(0.86 0 0)',
      position: 'relative',
      overflow: 'hidden',
      flexShrink: 0,
    }}>
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.82) 50%, transparent 100%)',
        animation: 'shimmer 1.4s linear infinite',
        willChange: 'transform',
      }} />
    </div>
  );
}

export { Skeleton, SkeletonTitle };

const LineChartInner = ({ data, height }: { data?: { date?: string; revenue?: number; name?: string; value?: number }[]; height?: number }) => {
  const chartData = useMemo(() => {
    if (!data) return [];
    return data.map(d => ({ date: d.date || d.name || '', revenue: d.revenue ?? d.value ?? 0 }));
  }, [data]);

  if (!chartData.length) return <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-60)', fontSize: 13 }}>Sin datos</div>;
  
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsLine data={chartData} margin={{ top: 10, right: 40, left: 10, bottom: 50 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--ink-06)" />
        <XAxis dataKey="date" type="category" fontSize={9} fontFamily="JetBrains Mono" stroke="var(--ink-60)" tickLine={false} interval={0} height={50} tick={{ fill: 'var(--ink)' }} />
        <YAxis tickFormatter={(v) => '$' + v} fontSize={10} fontFamily="JetBrains Mono" stroke="var(--ink-60)" width={60} tick={{ fill: 'var(--ink)' }} />
        <Tooltip content={<Ctx />} />
        <Line type="monotone" dataKey="revenue" stroke="var(--green)" strokeWidth={2} dot={{ fill: 'var(--green)', r: 2 }} activeDot={{ r: 4, stroke: 'var(--cream)', strokeWidth: 2 }} />
      </RechartsLine>
    </ResponsiveContainer>
  );
};

export const LineChart = memo(LineChartInner);

const BarChartInner = ({ data, height }: { data?: { date?: string; revenue?: number; orders?: number; value?: number }[]; height?: number }) => {
  const chartData = useMemo(() => {
    if (!data) return [];
    return data.map(d => ({ date: d.date || '', value: d.orders ?? d.value ?? 0 }));
  }, [data]);

  if (!chartData.length) return <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-60)', fontSize: 13 }}>Sin datos</div>;
  
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsBar data={chartData} margin={{ top: 10, right: 40, left: 10, bottom: 50 }}>
        <XAxis dataKey="date" type="category" fontSize={9} fontFamily="JetBrains Mono" stroke="var(--ink-60)" tickLine={false} interval={0} height={50} tick={{ fill: 'var(--ink)' }} />
        <YAxis tickFormatter={(v) => v} fontSize={10} fontFamily="JetBrains Mono" stroke="var(--ink-60)" width={50} tick={{ fill: 'var(--ink)' }} />
        <Bar dataKey="value" fill="var(--green)" radius={[4, 4, 0, 0]} />
      </RechartsBar>
    </ResponsiveContainer>
  );
};

export const BarChart = memo(BarChartInner);

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  'paid': { bg: 'oklch(0.92 0.1 140)', fg: 'oklch(0.35 0.1 140)' },
  'Paid': { bg: 'oklch(0.92 0.1 140)', fg: 'oklch(0.35 0.1 140)' },
  'Pagada': { bg: 'oklch(0.92 0.1 140)', fg: 'oklch(0.35 0.1 140)' },
  'Pagado': { bg: 'oklch(0.92 0.1 140)', fg: 'oklch(0.35 0.1 140)' },
  'Pendiente': { bg: 'oklch(0.95 0.08 75)', fg: 'oklch(0.5 0.12 75)' },
  'processing': { bg: 'oklch(0.92 0.08 230)', fg: 'oklch(0.4 0.12 230)' },
  'unfulfilled': { bg: 'oklch(0.95 0.04 85)', fg: 'oklch(0.45 0.05 85)' },
  'Pendiente de preparación': { bg: 'oklch(0.95 0.04 85)', fg: 'oklch(0.45 0.05 85)' },
  'En preparación': { bg: 'oklch(0.92 0.08 230)', fg: 'oklch(0.4 0.12 230)' },
  'shipped': { bg: 'oklch(0.92 0.06 200)', fg: 'oklch(0.4 0.08 200)' },
  'Enviada': { bg: 'oklch(0.92 0.06 200)', fg: 'oklch(0.4 0.08 200)' },
  'delivered': { bg: 'oklch(0.92 0.1 140)', fg: 'oklch(0.35 0.1 140)' },
  'Entregada': { bg: 'oklch(0.92 0.1 140)', fg: 'oklch(0.35 0.1 140)' },
  'pending_payment': { bg: 'oklch(0.95 0.08 75)', fg: 'oklch(0.5 0.12 75)' },
  'Pendiente de pago': { bg: 'oklch(0.95 0.08 75)', fg: 'oklch(0.5 0.12 75)' },
  'cancelled': { bg: 'oklch(0.93 0.1 30)', fg: 'oklch(0.5 0.15 30)' },
  'Cancelado': { bg: 'oklch(0.93 0.1 30)', fg: 'oklch(0.5 0.15 30)' },
  'Cancelada': { bg: 'oklch(0.93 0.1 30)', fg: 'oklch(0.5 0.15 30)' },
  'refunded': { bg: 'oklch(0.92 0.08 300)', fg: 'oklch(0.4 0.1 300)' },
  'Reembolsado': { bg: 'oklch(0.92 0.08 300)', fg: 'oklch(0.4 0.1 300)' },
  'Reembolsada': { bg: 'oklch(0.92 0.08 300)', fg: 'oklch(0.4 0.1 300)' },
  'Activo': { bg: 'oklch(0.92 0.1 140)', fg: 'oklch(0.35 0.1 140)' },
  'Inactivo': { bg: 'oklch(0.93 0.1 30)', fg: 'oklch(0.5 0.15 30)' },
  'Programado': { bg: 'oklch(0.92 0.08 230)', fg: 'oklch(0.4 0.12 230)' },
};

export function StatusPill({ status }: { status: string }) {
  const c = STATUS_COLORS[status] || { bg: 'var(--ink-06)', fg: 'var(--ink)' };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 999, background: c.bg, color: c.fg, fontSize: 11, fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.04em', fontWeight: 500, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
      <span style={{ width: 5, height: 5, borderRadius: 999, background: c.fg }} />
      {status}
    </span>
  );
}

function useCounter(target: number, duration = 1500) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (target === 0) {
      setCount(0);
      return;
    }
    const start = 0;
    const startTime = performance.now();
    const diff = target - start;

    function update(currentTime: number) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(start + diff * eased));
      if (progress < 1) {
        requestAnimationFrame(update);
      }
    }
    requestAnimationFrame(update);
  }, [target, duration]);

  return count;
}

function formatValue(value: ReactNode, num: number): string {
  if (typeof value === 'string' && value.startsWith('$')) {
    return '$' + num.toLocaleString();
  }
  if (typeof value === 'string' && value.includes('%')) {
    return num + value.slice(value.indexOf('%'));
  }
  return String(num);
}

// KpiCard
interface KpiCardProps { label: string; value?: ReactNode; delta?: number; sub?: string; mode?: 'light' | 'dark'; loading?: boolean; }
export function KpiCard({ label, value, delta, sub, mode = 'light', loading = false }: KpiCardProps) {
  const isDark = mode === 'dark';
  if (loading) {
    return (
      <div style={{ background: isDark ? 'var(--green)' : 'var(--cream)', color: isDark ? 'var(--cream)' : 'var(--ink)', borderRadius: 20, padding: '24px 26px', border: isDark ? 'none' : '1px solid var(--ink-06)', display: 'flex', flexDirection: 'column', gap: 16, minHeight: 150, justifyContent: 'space-between' }}>
        <Skeleton height={12} width="65%" borderRadius={4} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Skeleton height={48} borderRadius={8} />
          <Skeleton height={14} width="60%" borderRadius={4} />
        </div>
      </div>
    );
  }
  const rawNum = typeof value === 'number' ? value : (typeof value === 'string' ? parseFloat(value.replace(/[^0-9.-]/g, '')) : 0);
  if (isNaN(rawNum)) {
    return (
      <div style={{ background: isDark ? 'var(--green)' : 'var(--cream)', color: isDark ? 'var(--cream)' : 'var(--ink)', borderRadius: 20, padding: '24px 26px', border: isDark ? 'none' : '1px solid var(--ink-06)', display: 'flex', flexDirection: 'column', gap: 16, minHeight: 150, justifyContent: 'space-between' }}>
        <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', opacity: isDark ? 0.75 : 0.6 }}>{label}</div>
        <div>
          <div style={{ fontFamily: '"Instrument Serif", serif', fontSize: 52, letterSpacing: '-0.035em', lineHeight: 0.95, fontWeight: 400 }}>{value ?? '—'}</div>
          {delta !== undefined && (
            <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontFamily: '"Geist", sans-serif' }}>
              <span style={{ padding: '2px 8px', borderRadius: 999, background: delta >= 0 ? (isDark ? 'var(--lime)' : 'oklch(0.92 0.1 140)') : 'oklch(0.93 0.1 30)', color: delta >= 0 ? (isDark ? 'var(--ink)' : 'oklch(0.4 0.1 140)') : 'oklch(0.5 0.15 30)', fontWeight: 600, fontSize: 11 }}>
                {delta >= 0 ? '↑' : '↓'} {Math.abs(delta)}%
              </span>
              {sub && <span style={{ opacity: isDark ? 0.7 : 0.6 }}>{sub}</span>}
            </div>
          )}
          {delta === undefined && sub && <div style={{ marginTop: 10, fontSize: 12, fontFamily: '"Geist", sans-serif', opacity: isDark ? 0.7 : 0.6 }}>{sub}</div>}
        </div>
      </div>
    );
  }
  const animated = useCounter(rawNum);
  const displayValue = formatValue(value, animated);
  return (
    <div style={{ background: isDark ? 'var(--green)' : 'var(--cream)', color: isDark ? 'var(--cream)' : 'var(--ink)', borderRadius: 20, padding: '24px 26px', border: isDark ? 'none' : '1px solid var(--ink-06)', display: 'flex', flexDirection: 'column', gap: 16, minHeight: 150, justifyContent: 'space-between' }}>
      <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', opacity: isDark ? 0.75 : 0.6 }}>{label}</div>
      <div>
        <div style={{ fontFamily: '"Instrument Serif", serif', fontSize: 52, letterSpacing: '-0.035em', lineHeight: 0.95, fontWeight: 400 }}>{displayValue}</div>
        {delta !== undefined && (
          <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontFamily: '"Geist", sans-serif' }}>
            <span style={{ padding: '2px 8px', borderRadius: 999, background: delta >= 0 ? (isDark ? 'var(--lime)' : 'oklch(0.92 0.1 140)') : 'oklch(0.93 0.1 30)', color: delta >= 0 ? (isDark ? 'var(--ink)' : 'oklch(0.4 0.1 140)') : 'oklch(0.5 0.15 30)', fontWeight: 600, fontSize: 11 }}>
              {delta >= 0 ? '↑' : '↓'} {Math.abs(delta)}%
            </span>
            {sub && <span style={{ opacity: isDark ? 0.7 : 0.6 }}>{sub}</span>}
          </div>
        )}
        {delta === undefined && sub && <div style={{ marginTop: 10, fontSize: 12, fontFamily: '"Geist", sans-serif', opacity: isDark ? 0.7 : 0.6 }}>{sub}</div>}
      </div>
    </div>
  );
}

// PageHeader
interface PageHeaderProps { kicker?: string; title: ReactNode; sub?: string; actions?: ReactNode; loading?: boolean; }
export function PageHeader({ kicker, title, sub, actions, loading = false }: PageHeaderProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'end', justifyContent: 'space-between', marginBottom: 32, gap: 24 }}>
      <div style={{ width: '100%' }}>
        {/* Kicker */}
        {loading ? (
          <Skeleton height={12} width="180px" borderRadius={4} />
        ) : (
          kicker && <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-60)', marginBottom: 10 }}>{kicker}</div>
        )}
        {/* Main title */}
        {loading ? (
          <div style={{ marginTop: 12 }}>
            <SkeletonTitle size="lg" width="50%" />
          </div>
        ) : (
          <h1 style={{ fontFamily: '"Instrument Serif", serif', fontSize: 56, letterSpacing: '-0.035em', lineHeight: 0.95, margin: 0, fontWeight: 400, color: 'var(--ink)' }}>{title}</h1>
        )}
        {/* Sub */}
        {loading ? (
          <div style={{ marginTop: 12 }}>
            <Skeleton height={20} width="360px" borderRadius={4} />
          </div>
        ) : (
          sub && <p style={{ marginTop: 12, fontSize: 14, color: 'var(--ink-60)', maxWidth: 540, lineHeight: 1.5 }}>{sub}</p>
        )}
      </div>
      {actions && <div style={{ display: 'flex', gap: 8 }}>{actions}</div>}
    </div>
  );
}

// Card
export function Card({ title, sub, children, pad = 24, loading = false, skeletonContent }: { title?: string; sub?: string; children?: ReactNode; pad?: number; loading?: boolean; skeletonContent?: ReactNode }) {
  return (
    <div style={{ background: 'var(--cream)', border: '1px solid var(--ink-06)', borderRadius: 20, padding: pad }}>
      {/* Title area — skeleton or real */}
      {(title || loading) && (
        <div style={{ marginBottom: 20 }}>
          {loading ? (
            <>
              <SkeletonTitle size="md" width="45%" />
              {sub && <div style={{ marginTop: 6 }}><Skeleton height={14} width="160px" borderRadius={4} /></div>}
            </>
          ) : (
            <>
              <h3 style={{ fontFamily: '"Instrument Serif", serif', fontSize: 26, letterSpacing: '-0.02em', margin: 0, fontWeight: 400 }}>{title}</h3>
              {sub && <div style={{ fontSize: 11, fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-60)', marginTop: 6 }}>{sub}</div>}
            </>
          )}
        </div>
      )}
      {/* Content area */}
      {loading ? (
        skeletonContent ?? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[65, 45, 80, 35, 55].map((w, i) => (
              <Skeleton key={i} height={18} width={`${w}%`} borderRadius={5} />
            ))}
          </div>
        )
      ) : children}
    </div>
  );
}

// Table styles
export const tableStyle: CSSProperties = { width: '100%', borderCollapse: 'collapse' };
export const th: CSSProperties = { textAlign: 'left', padding: '14px 24px', fontSize: 10, fontFamily: '"JetBrains Mono", monospace', textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--ink-60)', borderBottom: '1px solid var(--ink-06)', fontWeight: 500 };
export const td: CSSProperties = { padding: '14px 24px', borderBottom: '1px solid var(--ink-06)', fontSize: 13, fontFamily: '"Geist", sans-serif', verticalAlign: 'middle' };
export const trStyle: CSSProperties = { transition: 'background 120ms' };
export const iconBtnAd: CSSProperties = { width: 30, height: 30, borderRadius: 8, border: '1px solid var(--ink-06)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-60)' };

// Donut
export function Donut({ data, size = 220 }: { data: { cat?: string; pct: number; color: string }[]; size?: number }) {
  const r = size / 2 - 20;
  const c = size / 2;
  const total = data.reduce((s, d) => s + d.pct, 0);
  let acc = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {data.map((d, i) => {
        const start = (acc / total) * Math.PI * 2 - Math.PI / 2;
        acc += d.pct;
        const end = (acc / total) * Math.PI * 2 - Math.PI / 2;
        const large = d.pct / total > 0.5 ? 1 : 0;
        const x1 = c + Math.cos(start) * r; const y1 = c + Math.sin(start) * r;
        const x2 = c + Math.cos(end) * r; const y2 = c + Math.sin(end) * r;
        return <path key={i} d={`M${c},${c} L${x1},${y1} A${r},${r} 0 ${large} 1 ${x2},${y2} Z`} fill={d.color} stroke="var(--cream)" strokeWidth="2" />;
      })}
      <circle cx={c} cy={c} r={r * 0.6} fill="var(--cream)" />
      <text x={c} y={c - 4} textAnchor="middle" fontFamily='"Instrument Serif", serif' fontSize="28" fill="var(--ink)">$53.4K</text>
      <text x={c} y={c + 16} textAnchor="middle" fontFamily='"JetBrains Mono", monospace' fontSize="9" fill="var(--ink-60)" letterSpacing="0.1em">TOTAL MES</text>
    </svg>
  );
}

// Sidebar
type AdminPage = 'dashboard' | 'orders' | 'products' | 'users' | 'sales' | 'earnings';
interface SidebarProps {
  page: AdminPage;
  setPage: (p: AdminPage) => void;
  onGoToStore: () => void;
  counts?: Partial<Record<AdminPage, number>>;
  adminName?: string;
  adminEmail?: string;
}

export function Sidebar({ page, setPage, onGoToStore, counts, adminName, adminEmail }: SidebarProps) {
  const items: { id: AdminPage; label: string; icon: string; count?: number }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: 'shield' },
    { id: 'orders', label: 'Pedidos', icon: 'bag', count: counts?.orders },
    { id: 'products', label: 'Productos', icon: 'leaf', count: counts?.products },
    { id: 'users', label: 'Usuarios', icon: 'user', count: counts?.users },
    { id: 'sales', label: 'Ventas', icon: 'truck' },
    { id: 'earnings', label: 'Ganancias', icon: 'star' },
  ];
  return (
    <aside style={{ width: 240, background: 'var(--cream)', borderRight: '1px solid var(--ink-06)', display: 'flex', flexDirection: 'column', padding: '24px 16px', position: 'sticky', top: 0, height: '100vh' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 8px 24px', borderBottom: '1px solid var(--ink-06)', marginBottom: 16 }}>
        <div style={{ width: 28, height: 28, borderRadius: 999, background: 'var(--green)', color: 'var(--lime)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '"Instrument Serif", serif', fontSize: 18 }}>h</div>
        <div>
          <div style={{ fontFamily: '"Instrument Serif", serif', fontSize: 20, letterSpacing: '-0.02em', lineHeight: 1 }}>Healthora</div>
          <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 9, color: 'var(--ink-60)', letterSpacing: '0.12em', marginTop: 2 }}>ADMIN PANEL</div>
        </div>
      </div>
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {items.map((it) => (
          <button key={it.id} onClick={() => setPage(it.id)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 10, border: 'none', cursor: 'pointer', background: page === it.id ? 'var(--ink)' : 'transparent', color: page === it.id ? 'var(--cream)' : 'var(--ink)', fontSize: 13, fontFamily: '"Geist", sans-serif', textAlign: 'left', letterSpacing: '-0.01em' }}>
            <Icon name={it.icon} size={16} />
            <span style={{ flex: 1 }}>{it.label}</span>
            {it.count && <span style={{ fontSize: 10, fontFamily: '"JetBrains Mono", monospace', padding: '2px 6px', borderRadius: 999, background: page === it.id ? 'var(--lime)' : 'var(--ink-06)', color: page === it.id ? 'var(--ink)' : 'var(--ink-60)' }}>{it.count}</span>}
          </button>
        ))}
      </nav>
      <div style={{ marginTop: 'auto' }}>
        <button onClick={onGoToStore} style={{ width: '100%', marginBottom: 12, fontSize: 12, fontFamily: '"Geist", sans-serif', color: 'var(--ink-60)', textDecoration: 'none', padding: '8px 12px', borderRadius: 10, border: '1px solid var(--ink-06)', background: 'transparent', cursor: 'pointer', textAlign: 'left' }}>← Ver tienda</button>
        <div style={{ padding: 12, background: 'var(--cream-2)', borderRadius: 12, border: '1px solid var(--ink-06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 999, background: 'var(--green)', color: 'var(--lime)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '"Instrument Serif", serif', fontSize: 13 }}>A</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 500, lineHeight: 1.2 }}>{adminName || 'Admin'}</div>
              <div style={{ fontSize: 10, fontFamily: '"JetBrains Mono", monospace', color: 'var(--ink-60)', letterSpacing: '0.04em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{adminEmail || 'ADMIN@HEALTHORA'}</div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
