import type { CSSProperties, ReactNode } from 'react';
import { Icon } from '../shared/Icon';

// StatusPill
const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  'paid': { bg: 'oklch(0.92 0.1 140)', fg: 'oklch(0.35 0.1 140)' },
  'Pagada': { bg: 'oklch(0.92 0.1 140)', fg: 'oklch(0.35 0.1 140)' },
  'processing': { bg: 'oklch(0.92 0.08 230)', fg: 'oklch(0.4 0.12 230)' },
  'En preparación': { bg: 'oklch(0.92 0.08 230)', fg: 'oklch(0.4 0.12 230)' },
  'shipped': { bg: 'oklch(0.92 0.06 200)', fg: 'oklch(0.4 0.08 200)' },
  'Enviada': { bg: 'oklch(0.92 0.06 200)', fg: 'oklch(0.4 0.08 200)' },
  'delivered': { bg: 'oklch(0.92 0.1 140)', fg: 'oklch(0.35 0.1 140)' },
  'Entregada': { bg: 'oklch(0.92 0.1 140)', fg: 'oklch(0.35 0.1 140)' },
  'pending_payment': { bg: 'oklch(0.95 0.08 75)', fg: 'oklch(0.5 0.12 75)' },
  'Pendiente de pago': { bg: 'oklch(0.95 0.08 75)', fg: 'oklch(0.5 0.12 75)' },
  'cancelled': { bg: 'oklch(0.93 0.1 30)', fg: 'oklch(0.5 0.15 30)' },
  'Cancelada': { bg: 'oklch(0.93 0.1 30)', fg: 'oklch(0.5 0.15 30)' },
  'refunded': { bg: 'oklch(0.92 0.08 300)', fg: 'oklch(0.4 0.1 300)' },
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

// KpiCard
interface KpiCardProps { label: string; value: ReactNode; delta?: number; sub?: string; mode?: 'light' | 'dark'; }
export function KpiCard({ label, value, delta, sub, mode = 'light' }: KpiCardProps) {
  const isDark = mode === 'dark';
  return (
    <div style={{ background: isDark ? 'var(--green)' : 'var(--cream)', color: isDark ? 'var(--cream)' : 'var(--ink)', borderRadius: 20, padding: '24px 26px', border: isDark ? 'none' : '1px solid var(--ink-06)', display: 'flex', flexDirection: 'column', gap: 16, minHeight: 150, justifyContent: 'space-between' }}>
      <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', opacity: isDark ? 0.75 : 0.6 }}>{label}</div>
      <div>
        <div style={{ fontFamily: '"Instrument Serif", serif', fontSize: 52, letterSpacing: '-0.035em', lineHeight: 0.95, fontWeight: 400 }}>{value}</div>
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
interface PageHeaderProps { kicker?: string; title: ReactNode; sub?: string; actions?: ReactNode; }
export function PageHeader({ kicker, title, sub, actions }: PageHeaderProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'end', justifyContent: 'space-between', marginBottom: 32, gap: 24 }}>
      <div>
        {kicker && <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-60)', marginBottom: 10 }}>{kicker}</div>}
        <h1 style={{ fontFamily: '"Instrument Serif", serif', fontSize: 56, letterSpacing: '-0.035em', lineHeight: 0.95, margin: 0, fontWeight: 400, color: 'var(--ink)' }}>{title}</h1>
        {sub && <p style={{ marginTop: 12, fontSize: 14, color: 'var(--ink-60)', maxWidth: 540, lineHeight: 1.5 }}>{sub}</p>}
      </div>
      {actions && <div style={{ display: 'flex', gap: 8 }}>{actions}</div>}
    </div>
  );
}

// Card
export function Card({ title, sub, children, pad = 24 }: { title?: string; sub?: string; children: ReactNode; pad?: number }) {
  return (
    <div style={{ background: 'var(--cream)', border: '1px solid var(--ink-06)', borderRadius: 20, padding: pad }}>
      {title && (
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontFamily: '"Instrument Serif", serif', fontSize: 26, letterSpacing: '-0.02em', margin: 0, fontWeight: 400 }}>{title}</h3>
          {sub && <div style={{ fontSize: 11, fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-60)', marginTop: 6 }}>{sub}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

// Table styles
export const tableStyle: CSSProperties = { width: '100%', borderCollapse: 'collapse' };
export const th: CSSProperties = { textAlign: 'left', padding: '14px 24px', fontSize: 10, fontFamily: '"JetBrains Mono", monospace', textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--ink-60)', borderBottom: '1px solid var(--ink-06)', fontWeight: 500 };
export const td: CSSProperties = { padding: '14px 24px', borderBottom: '1px solid var(--ink-06)', fontSize: 13, fontFamily: '"Geist", sans-serif', verticalAlign: 'middle' };
export const trStyle: CSSProperties = { transition: 'background 120ms' };
export const iconBtnAd: CSSProperties = { width: 30, height: 30, borderRadius: 8, border: '1px solid var(--ink-06)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-60)' };

// BarChart
export function BarChart({ data, height = 200, valueKey = 'revenue' }: { data: Record<string, number | string>[]; height?: number; valueKey?: string }) {
  const max = Math.max(...data.map((d) => Number(d[valueKey])));
  return (
    <div style={{ display: 'flex', alignItems: 'end', gap: 3, height }}>
      {data.map((d, i) => {
        const h = (Number(d[valueKey]) / max) * (height - 30);
        return (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <div style={{ width: '100%', height: h, background: i === data.length - 1 ? 'var(--green)' : 'var(--ink-20)', borderRadius: '4px 4px 0 0' }} />
            {i % 3 === 0 && <div style={{ fontSize: 9, fontFamily: '"JetBrains Mono", monospace', color: 'var(--ink-60)' }}>{d.date}</div>}
          </div>
        );
      })}
    </div>
  );
}

// LineChart
export function LineChart({ data, height = 220 }: { data: { revenue: number; date?: string }[]; height?: number }) {
  const w = 800;
  const max = Math.max(...data.map((d) => d.revenue));
  const min = Math.min(...data.map((d) => d.revenue));
  const pts = data.map((d, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = height - 40 - ((d.revenue - min) / (max - min || 1)) * (height - 60);
    return [x, y];
  });
  const path = pts.map((p, i) => (i === 0 ? 'M' : 'L') + p[0] + ',' + p[1]).join(' ');
  const areaPath = path + ` L${w},${height - 20} L0,${height - 20} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${height}`} width="100%" height={height} style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id="area" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--green)" stopOpacity="0.25" />
          <stop offset="100%" stopColor="var(--green)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((f) => <line key={f} x1={0} x2={w} y1={(height - 20) * f + 10} y2={(height - 20) * f + 10} stroke="var(--ink-06)" strokeWidth="1" />)}
      <path d={areaPath} fill="url(#area)" />
      <path d={path} stroke="var(--green)" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r={i === pts.length - 1 ? 5 : 2.5} fill="var(--green)" stroke="var(--cream)" strokeWidth={i === pts.length - 1 ? 2 : 0} />)}
    </svg>
  );
}

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
interface SidebarProps { page: AdminPage; setPage: (p: AdminPage) => void; onGoToStore: () => void; }

export function Sidebar({ page, setPage, onGoToStore }: SidebarProps) {
  const items: { id: AdminPage; label: string; icon: string; count?: number }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: 'shield' },
    { id: 'orders', label: 'Pedidos', icon: 'bag', count: 9 },
    { id: 'products', label: 'Productos', icon: 'leaf', count: 12 },
    { id: 'users', label: 'Usuarios', icon: 'user', count: 8 },
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
              <div style={{ fontSize: 12, fontWeight: 500, lineHeight: 1.2 }}>Admin</div>
              <div style={{ fontSize: 10, fontFamily: '"JetBrains Mono", monospace', color: 'var(--ink-60)', letterSpacing: '0.04em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>ADMIN@HEALTHORA</div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
