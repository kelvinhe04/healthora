import {
  BarChart as RechartsBar,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart as RechartsLine,
  Line,
  CartesianGrid,
} from "recharts";
import { useMemo, useState, useEffect, useRef, memo } from "react";
import type { CSSProperties, ReactNode } from "react";
import { useThemeStore } from "../../store/themeStore";
import { Icon } from "../shared/Icon";
import { NotificationCenter } from "../shared/NotificationCenter";
import { formatPanamaDayMonth } from "../../lib/dates";

let _adminSessionId = "";
const _shownSkeletons = new Set<string>();

export function initAdminSession() {
  _adminSessionId = Math.random().toString(36).slice(2);
  _shownSkeletons.clear();
}

export function useOnceLoading(key: string, isLoading: boolean): boolean {
  const [locked, setLocked] = useState(() => !_shownSkeletons.has(key));
  const [loadingStarted, setLoadingStarted] = useState(false);
  const [timerDone, setTimerDone] = useState(false);

  useEffect(() => {
    if (isLoading && !loadingStarted && locked) setLoadingStarted(true);
  }, [isLoading, loadingStarted, locked]);

  useEffect(() => {
    if (!loadingStarted) return;
    const t = setTimeout(() => setTimerDone(true), 1800);
    return () => clearTimeout(t);
  }, [loadingStarted]);

  useEffect(() => {
    if (locked && loadingStarted && timerDone && !isLoading) {
      _shownSkeletons.add(key);
      setLocked(false);
    }
  }, [locked, loadingStarted, timerDone, isLoading, key]);

  return locked && loadingStarted;
}

function digitsFromISO(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return "";
  return `${d}${m}${y}`;
}

function isoFromDigits(digits: string): string | null {
  if (digits.length !== 8) return null;
  const day = parseInt(digits.slice(0, 2), 10);
  const month = parseInt(digits.slice(2, 4), 10);
  const year = parseInt(digits.slice(4, 8), 10);
  if (month < 1 || month > 12) return null;
  const daysInMonth = new Date(year, month, 0).getDate();
  if (day < 1 || day > daysInMonth) return null;
  if (year < 1900 || year > 2200) return null;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function formatDigitsAsDDMMYYYY(digits: string): string {
  let out = digits.slice(0, 2);
  if (digits.length > 2) out += "/" + digits.slice(2, 4);
  if (digits.length > 4) out += "/" + digits.slice(4, 8);
  return out;
}

/** Date field that always reads/types as DD/MM/AAAA, regardless of the browser or OS locale.
 * `<input type="date">`'s visible format follows the user's locale (often MM/DD/YYYY), which is
 * silently wrong for admins reading it as day-first — the same class of surprise this codebase
 * already hand-rolls around for display formatting (`lib/dates.ts`), just on the input side. A
 * hidden native date input (synced to the same ISO value) sits behind the calendar icon so
 * clicking it still opens the OS date picker; typing digits is the primary path and is masked
 * with "/" as you go. Value/onChange are always ISO `yyyy-mm-dd` (or `''`), matching what the
 * rest of the form/backend already expects from a plain `<input type="date">`. */
export function DateInputDDMMYYYY({
  value,
  onChange,
  disabled,
  style,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  style?: CSSProperties;
}) {
  const [digits, setDigits] = useState(() => digitsFromISO(value));
  const nativeRef = useRef<HTMLInputElement>(null);

  // Re-derive the visible digits whenever the ISO value actually changes - including when it
  // changes from *this* component's own commit (e.g. picking a date via the hidden native
  // calendar below), not just from the outside. Re-deriving digits from the just-committed ISO
  // always reproduces the same digits, so this never clobbers in-progress typing: the effect
  // only re-runs when `value` (a primitive string) truly changes, which typing alone doesn't do
  // until a complete valid date is committed.
  useEffect(() => {
    setDigits(digitsFromISO(value));
  }, [value]);

  const commit = (iso: string) => onChange(iso);

  return (
    <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
      <input
        type="text"
        inputMode="numeric"
        value={formatDigitsAsDDMMYYYY(digits)}
        onChange={(e) => {
          const next = e.target.value.replace(/\D/g, "").slice(0, 8);
          setDigits(next);
          if (next.length === 8) {
            const iso = isoFromDigits(next);
            if (iso) commit(iso);
          } else if (next.length === 0) {
            commit("");
          }
        }}
        placeholder="dd/mm/aaaa"
        disabled={disabled}
        style={{ ...style, paddingRight: 34 }}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => nativeRef.current?.showPicker?.()}
        disabled={disabled}
        aria-label="Elegir fecha en calendario"
        style={{
          position: "absolute",
          right: 8,
          background: "transparent",
          border: "none",
          cursor: disabled ? "default" : "pointer",
          color: "var(--ink-40)",
          display: "flex",
          padding: 0,
        }}
      >
        <Icon name="calendar" size={14} />
      </button>
      <input
        ref={nativeRef}
        type="date"
        value={value}
        onChange={(e) => commit(e.target.value)}
        disabled={disabled}
        tabIndex={-1}
        aria-hidden="true"
        style={{ position: "absolute", top: "100%", left: 0, width: 1, height: 1, opacity: 0, pointerEvents: "none" }}
      />
    </div>
  );
}

const Ctx = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}) => {
  if (active && payload?.length) {
    return (
      <div
        style={{
          background: "var(--cream)",
          border: "1px solid var(--ink-06)",
          borderRadius: 8,
          padding: "8px 12px",
          fontSize: 12,
          fontFamily: '"JetBrains Mono", monospace',
        }}
      >
        {label}: ${payload[0].value}
      </div>
    );
  }
  return null;
};

function Skeleton({
  height = 20,
  width,
  borderRadius = 4,
  style,
}: {
  height?: number;
  width?: string | number;
  borderRadius?: number;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        height,
        width: width ?? "100%",
        borderRadius,
        background: "var(--skeleton-base)",
        position: "relative",
        overflow: "hidden",
        flexShrink: 0,
        ...style,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(90deg, transparent 0%, var(--skeleton-shimmer) 50%, transparent 100%)",
          animation: "shimmer 1.4s linear infinite",
          willChange: "transform",
        }}
      />
    </div>
  );
}

/** Skeleton for large headings – matches Instrument Serif h1 / h3 sizing */
function SkeletonTitle({
  size = "lg",
  width = "55%",
}: {
  size?: "lg" | "md";
  width?: string;
}) {
  const height = size === "lg" ? 54 : 32;
  const radius = size === "lg" ? 12 : 8;
  return (
    <div
      style={{
        height,
        width,
        borderRadius: radius,
        background: "var(--skeleton-base)",
        position: "relative",
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(90deg, transparent 0%, var(--skeleton-shimmer) 50%, transparent 100%)",
          animation: "shimmer 1.4s linear infinite",
          willChange: "transform",
        }}
      />
    </div>
  );
}

export { Skeleton, SkeletonTitle };

const LineChartInner = ({
  data,
  height,
}: {
  data?: { date?: string; revenue?: number; name?: string; value?: number }[];
  height?: number;
}) => {
  const chartData = useMemo(() => {
    if (!data) return [];
    return data.map((d) => ({
      date: d.date || d.name || "",
      revenue: d.revenue ?? d.value ?? 0,
    }));
  }, [data]);

  if (!chartData.length)
    return (
      <div
        style={{
          height,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--ink-60)",
          fontSize: 13,
        }}
      >
        Sin datos
      </div>
    );

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsLine
        data={chartData}
        margin={{ top: 10, right: 40, left: 10, bottom: 50 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="var(--ink-06)" />
        <XAxis
          dataKey="date"
          type="category"
          fontSize={9}
          fontFamily="JetBrains Mono"
          stroke="var(--ink-60)"
          tickLine={false}
          interval={0}
          height={50}
          tick={{ fill: "var(--ink)" }}
        />
        <YAxis
          tickFormatter={(v) => "$" + v}
          fontSize={10}
          fontFamily="JetBrains Mono"
          stroke="var(--ink-60)"
          width={60}
          tick={{ fill: "var(--ink)" }}
        />
        <Tooltip content={<Ctx />} />
        <Line
          type="monotone"
          dataKey="revenue"
          stroke="var(--green)"
          strokeWidth={2}
          dot={{ fill: "var(--green)", r: 2 }}
          activeDot={{ r: 4, stroke: "var(--cream)", strokeWidth: 2 }}
        />
      </RechartsLine>
    </ResponsiveContainer>
  );
};

export const LineChart = memo(LineChartInner);

type BarChartRow = { label: string; value: number; kind?: "orders" | "revenue" };

function formatDayLabel(date: string) {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return date;
  return formatPanamaDayMonth(d);
}

function formatMoney(value: number) {
  return `$${value.toLocaleString("en-US")}`;
}

function BarTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload?: BarChartRow }[];
}) {
  if (!active || !payload?.length || !payload[0].payload) return null;

  const row = payload[0].payload;
  const isOrders = row.kind === "orders";

  return (
    <div
      style={{
        background: "var(--cream)",
        border: "1px solid var(--ink-10)",
        borderRadius: 12,
        boxShadow: "0 16px 32px -20px rgba(0,0,0,0.22)",
        padding: "10px 12px",
        minWidth: 150,
        fontFamily: '"Geist", sans-serif',
        color: "var(--ink)",
      }}
    >
      <div
        style={{
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "var(--ink-60)",
          marginBottom: 6,
          fontFamily: '"JetBrains Mono", monospace',
        }}
      >
        {isOrders ? "Pedidos diarios" : "Ingresos por categoría"}
      </div>
      <div style={{ fontSize: 13, lineHeight: 1.35 }}>
        <div style={{ marginBottom: 2 }}>
          {isOrders ? "Fecha" : "Categoría"}: {isOrders ? formatDayLabel(row.label) : row.label}
        </div>
        <div>
          {isOrders ? "Órdenes" : "Ingresos"}: {isOrders ? row.value : formatMoney(row.value)}
        </div>
      </div>
    </div>
  );
}

const BarChartInner = ({
  data,
  height,
}: {
  data?: { date?: string; revenue?: number; orders?: number; value?: number }[];
  height?: number;
}) => {
  const chartData = useMemo(() => {
    if (!data) return [];
    return data.map((d) => ({
      label: d.date || "",
      value: d.orders ?? d.value ?? 0,
      kind: typeof d.orders === "number" ? "orders" : "revenue",
    } as BarChartRow));
  }, [data]);

  if (!chartData.length)
    return (
      <div
        style={{
          height,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--ink-60)",
          fontSize: 13,
        }}
      >
        Sin datos
      </div>
    );

  return (
    <div style={{ width: "100%", height: height ?? 240, minHeight: 240 }}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsBar
          data={chartData}
          margin={{ top: 10, right: 40, left: 10, bottom: 70 }}
        >
          <XAxis
            dataKey="label"
            type="category"
            fontSize={9}
            fontFamily="JetBrains Mono"
            stroke="var(--ink-60)"
            tickLine={false}
            height={60}
            angle={-45}
            textAnchor="end"
            tick={{ fill: "var(--ink)" }}
            tickFormatter={(date: string) => {
              if (!date) return "";
              const d = new Date(date);
              if (isNaN(d.getTime())) return date;
              return formatPanamaDayMonth(d);
            }}
          />
          <YAxis
            tickFormatter={(v: number) => String(v)}
            fontSize={10}
            fontFamily="JetBrains Mono"
            stroke="var(--ink-60)"
            width={50}
            tick={{ fill: "var(--ink)" }}
          />
          <Tooltip content={<BarTooltip />} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
          <Bar dataKey="value" fill="var(--green)" radius={[4, 4, 0, 0]} cursor="pointer" />
        </RechartsBar>
      </ResponsiveContainer>
    </div>
  );
};

export const BarChart = memo(BarChartInner);

const STATUS_COLORS: Record<string, { bg: string; fg: string; darkBg: string; darkFg: string }> = {
  // Green — paid / delivered / active
  paid:      { bg: "oklch(0.92 0.1 140)",  fg: "oklch(0.35 0.1 140)",  darkBg: "oklch(0.26 0.07 140)", darkFg: "oklch(0.78 0.12 140)" },
  Paid:      { bg: "oklch(0.92 0.1 140)",  fg: "oklch(0.35 0.1 140)",  darkBg: "oklch(0.26 0.07 140)", darkFg: "oklch(0.78 0.12 140)" },
  Pagada:    { bg: "oklch(0.92 0.1 140)",  fg: "oklch(0.35 0.1 140)",  darkBg: "oklch(0.26 0.07 140)", darkFg: "oklch(0.78 0.12 140)" },
  Pagado:    { bg: "oklch(0.92 0.1 140)",  fg: "oklch(0.35 0.1 140)",  darkBg: "oklch(0.26 0.07 140)", darkFg: "oklch(0.78 0.12 140)" },
  delivered: { bg: "oklch(0.92 0.1 140)",  fg: "oklch(0.35 0.1 140)",  darkBg: "oklch(0.26 0.07 140)", darkFg: "oklch(0.78 0.12 140)" },
  Entregada: { bg: "oklch(0.92 0.1 140)",  fg: "oklch(0.35 0.1 140)",  darkBg: "oklch(0.26 0.07 140)", darkFg: "oklch(0.78 0.12 140)" },
  "Listo para retirar": { bg: "oklch(0.92 0.1 140)",  fg: "oklch(0.35 0.1 140)",  darkBg: "oklch(0.26 0.07 140)", darkFg: "oklch(0.78 0.12 140)" },
  Activo:    { bg: "oklch(0.92 0.1 140)",  fg: "oklch(0.35 0.1 140)",  darkBg: "oklch(0.26 0.07 140)", darkFg: "oklch(0.78 0.12 140)" },
  published: { bg: "oklch(0.92 0.1 140)",  fg: "oklch(0.35 0.1 140)",  darkBg: "oklch(0.26 0.07 140)", darkFg: "oklch(0.78 0.12 140)" },
  Publicada: { bg: "oklch(0.92 0.1 140)",  fg: "oklch(0.35 0.1 140)",  darkBg: "oklch(0.26 0.07 140)", darkFg: "oklch(0.78 0.12 140)" },
  // Amber — pending payment / unfulfilled
  Pendiente:            { bg: "oklch(0.95 0.08 75)", fg: "oklch(0.5 0.12 75)",  darkBg: "oklch(0.28 0.08 75)",  darkFg: "oklch(0.88 0.13 75)"  },
  pending_payment:      { bg: "oklch(0.95 0.08 75)", fg: "oklch(0.5 0.12 75)",  darkBg: "oklch(0.28 0.08 75)",  darkFg: "oklch(0.88 0.13 75)"  },
  "Pendiente de pago":  { bg: "oklch(0.95 0.08 75)", fg: "oklch(0.5 0.12 75)",  darkBg: "oklch(0.28 0.08 75)",  darkFg: "oklch(0.88 0.13 75)"  },
  pending:              { bg: "oklch(0.95 0.08 75)", fg: "oklch(0.5 0.12 75)",  darkBg: "oklch(0.28 0.08 75)",  darkFg: "oklch(0.88 0.13 75)"  },
  unfulfilled:                  { bg: "oklch(0.95 0.04 85)", fg: "oklch(0.45 0.05 85)", darkBg: "oklch(0.26 0.05 85)",  darkFg: "oklch(0.82 0.07 85)"  },
  "Pendiente de preparación":   { bg: "oklch(0.95 0.04 85)", fg: "oklch(0.45 0.05 85)", darkBg: "oklch(0.26 0.05 85)",  darkFg: "oklch(0.82 0.07 85)"  },
  requested:                    { bg: "oklch(0.95 0.08 75)", fg: "oklch(0.5 0.12 75)",  darkBg: "oklch(0.28 0.08 75)",  darkFg: "oklch(0.88 0.13 75)"  },
  Solicitada:                   { bg: "oklch(0.95 0.08 75)", fg: "oklch(0.5 0.12 75)",  darkBg: "oklch(0.28 0.08 75)",  darkFg: "oklch(0.88 0.13 75)"  },
  "Reembolso en proceso":       { bg: "oklch(0.95 0.08 75)", fg: "oklch(0.5 0.12 75)",  darkBg: "oklch(0.28 0.08 75)",  darkFg: "oklch(0.88 0.13 75)"  },
  // Blue — processing / in-prep / scheduled
  processing:      { bg: "oklch(0.92 0.08 230)", fg: "oklch(0.4 0.12 230)",  darkBg: "oklch(0.28 0.09 230)", darkFg: "oklch(0.82 0.12 230)" },
  Preparando:      { bg: "oklch(0.92 0.08 230)", fg: "oklch(0.4 0.12 230)",  darkBg: "oklch(0.28 0.09 230)", darkFg: "oklch(0.82 0.12 230)" },
  "En preparación":{ bg: "oklch(0.92 0.08 230)", fg: "oklch(0.4 0.12 230)",  darkBg: "oklch(0.28 0.09 230)", darkFg: "oklch(0.82 0.12 230)" },
  Programado:      { bg: "oklch(0.92 0.08 230)", fg: "oklch(0.4 0.12 230)",  darkBg: "oklch(0.28 0.09 230)", darkFg: "oklch(0.82 0.12 230)" },
  approved:        { bg: "oklch(0.92 0.08 230)", fg: "oklch(0.4 0.12 230)",  darkBg: "oklch(0.28 0.09 230)", darkFg: "oklch(0.82 0.12 230)" },
  Aprobada:        { bg: "oklch(0.92 0.08 230)", fg: "oklch(0.4 0.12 230)",  darkBg: "oklch(0.28 0.09 230)", darkFg: "oklch(0.82 0.12 230)" },
  "En revisión":   { bg: "oklch(0.92 0.08 230)", fg: "oklch(0.4 0.12 230)",  darkBg: "oklch(0.28 0.09 230)", darkFg: "oklch(0.82 0.12 230)" },
  // Teal — shipped
  shipped:     { bg: "oklch(0.92 0.06 200)", fg: "oklch(0.4 0.08 200)",  darkBg: "oklch(0.27 0.07 200)", darkFg: "oklch(0.82 0.1 200)"  },
  Enviada:     { bg: "oklch(0.92 0.06 200)", fg: "oklch(0.4 0.08 200)",  darkBg: "oklch(0.27 0.07 200)", darkFg: "oklch(0.82 0.1 200)"  },
  in_transit:  { bg: "oklch(0.92 0.06 200)", fg: "oklch(0.4 0.08 200)",  darkBg: "oklch(0.27 0.07 200)", darkFg: "oklch(0.82 0.1 200)"  },
  "En tránsito": { bg: "oklch(0.92 0.06 200)", fg: "oklch(0.4 0.08 200)",  darkBg: "oklch(0.27 0.07 200)", darkFg: "oklch(0.82 0.1 200)"  },
  "Envío a domicilio": { bg: "oklch(0.92 0.06 200)", fg: "oklch(0.4 0.08 200)",  darkBg: "oklch(0.27 0.07 200)", darkFg: "oklch(0.82 0.1 200)"  },
  "Retiro en tienda":  { bg: "oklch(0.92 0.1 140)",  fg: "oklch(0.35 0.1 140)",  darkBg: "oklch(0.26 0.07 140)", darkFg: "oklch(0.78 0.12 140)" },
  replaced:    { bg: "oklch(0.92 0.06 200)", fg: "oklch(0.4 0.08 200)",  darkBg: "oklch(0.27 0.07 200)", darkFg: "oklch(0.82 0.1 200)"  },
  "Reemplazo enviado": { bg: "oklch(0.92 0.06 200)", fg: "oklch(0.4 0.08 200)",  darkBg: "oklch(0.27 0.07 200)", darkFg: "oklch(0.82 0.1 200)"  },
  "Reemplazo en camino": { bg: "oklch(0.92 0.06 200)", fg: "oklch(0.4 0.08 200)",  darkBg: "oklch(0.27 0.07 200)", darkFg: "oklch(0.82 0.1 200)"  },
  "Reemplazo en tienda": { bg: "oklch(0.92 0.06 200)", fg: "oklch(0.4 0.08 200)",  darkBg: "oklch(0.27 0.07 200)", darkFg: "oklch(0.82 0.1 200)"  },
  "Sin costo": { bg: "oklch(0.92 0.06 200)", fg: "oklch(0.4 0.08 200)",  darkBg: "oklch(0.27 0.07 200)", darkFg: "oklch(0.82 0.1 200)"  },
  // Coral — cancelled / inactive
  cancelled: { bg: "oklch(0.93 0.1 30)", fg: "oklch(0.5 0.15 30)",  darkBg: "oklch(0.27 0.09 30)",  darkFg: "oklch(0.82 0.14 30)"  },
  Cancelado: { bg: "oklch(0.93 0.1 30)", fg: "oklch(0.5 0.15 30)",  darkBg: "oklch(0.27 0.09 30)",  darkFg: "oklch(0.82 0.14 30)"  },
  Cancelada: { bg: "oklch(0.93 0.1 30)", fg: "oklch(0.5 0.15 30)",  darkBg: "oklch(0.27 0.09 30)",  darkFg: "oklch(0.82 0.14 30)"  },
  Inactivo:  { bg: "oklch(0.93 0.1 30)", fg: "oklch(0.5 0.15 30)",  darkBg: "oklch(0.27 0.09 30)",  darkFg: "oklch(0.82 0.14 30)"  },
  rejected:  { bg: "oklch(0.93 0.1 30)", fg: "oklch(0.5 0.15 30)",  darkBg: "oklch(0.27 0.09 30)",  darkFg: "oklch(0.82 0.14 30)"  },
  Rechazada: { bg: "oklch(0.93 0.1 30)", fg: "oklch(0.5 0.15 30)",  darkBg: "oklch(0.27 0.09 30)",  darkFg: "oklch(0.82 0.14 30)"  },
  hidden:    { bg: "oklch(0.93 0.1 30)", fg: "oklch(0.5 0.15 30)",  darkBg: "oklch(0.27 0.09 30)",  darkFg: "oklch(0.82 0.14 30)"  },
  Oculta:    { bg: "oklch(0.93 0.1 30)", fg: "oklch(0.5 0.15 30)",  darkBg: "oklch(0.27 0.09 30)",  darkFg: "oklch(0.82 0.14 30)"  },
  // Purple — refunded
  refunded:    { bg: "oklch(0.92 0.08 300)", fg: "oklch(0.4 0.1 300)",  darkBg: "oklch(0.27 0.08 300)", darkFg: "oklch(0.82 0.11 300)" },
  Reembolsado: { bg: "oklch(0.92 0.08 300)", fg: "oklch(0.4 0.1 300)",  darkBg: "oklch(0.27 0.08 300)", darkFg: "oklch(0.82 0.11 300)" },
  Reembolsada: { bg: "oklch(0.92 0.08 300)", fg: "oklch(0.4 0.1 300)",  darkBg: "oklch(0.27 0.08 300)", darkFg: "oklch(0.82 0.11 300)" },
};

export function StatusPill({ status }: { status: string }) {
  const { theme } = useThemeStore();
  const dark = theme === "dark";
  const entry = STATUS_COLORS[status];
  const bg = entry ? (dark ? entry.darkBg : entry.bg) : (dark ? "oklch(0.22 0.005 155)" : "var(--ink-06)");
  const fg = entry ? (dark ? entry.darkFg : entry.fg) : "var(--ink)";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px",
        borderRadius: 999,
        background: bg,
        color: fg,
        fontSize: 11,
        fontFamily: '"JetBrains Mono", monospace',
        letterSpacing: "0.04em",
        fontWeight: 500,
        textTransform: "uppercase",
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ width: 5, height: 5, borderRadius: 999, background: fg }} />
      {status}
    </span>
  );
}

function useCounter(target: number, duration = 1500, animKey?: string) {
  const [count, setCount] = useState(0);
  const hasAnimatedKey = animKey
    ? `kpi_animated_${_adminSessionId}_${animKey}`
    : null;
  const hasAnimated = hasAnimatedKey
    ? sessionStorage.getItem(hasAnimatedKey) === "true"
    : false;

  useEffect(() => {
    if (target === 0) {
      setCount(0);
      return;
    }
    if (hasAnimated) {
      setCount(target);
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
      } else if (hasAnimatedKey) {
        sessionStorage.setItem(hasAnimatedKey, "true");
      }
    }
    requestAnimationFrame(update);
  }, [target, duration, hasAnimatedKey, hasAnimated]);

  return count;
}

function formatValue(value: ReactNode, num: number): string {
  if (typeof value === "string" && value.startsWith("$")) {
    return "$" + num.toLocaleString();
  }
  if (typeof value === "string" && value.includes("%")) {
    return num + value.slice(value.indexOf("%"));
  }
  return String(num);
}

// KpiCard
interface KpiCardProps {
  label: string;
  value?: ReactNode;
  delta?: number;
  sub?: string;
  mode?: "light" | "dark";
  loading?: boolean;
  animKey?: string;
}
export function KpiCard({
  label,
  value,
  delta,
  sub,
  mode = "light",
  loading = false,
  animKey,
}: KpiCardProps) {
  const isDark = mode === "dark";
  const rawNum =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? parseFloat(value.replace(/[^0-9.-]/g, ""))
        : 0;
  // El hook debe llamarse incondicionalmente, antes de cualquier return temprano (rules-of-hooks).
  const animated = useCounter(rawNum, 1500, animKey);
  if (loading) {
    return (
      <div
        style={{
          background: isDark ? "var(--green)" : "var(--cream)",
          color: isDark ? "var(--cream)" : "var(--ink)",
          borderRadius: 20,
          padding: "24px 26px",
          border: isDark ? "none" : "1px solid var(--ink-06)",
          display: "flex",
          flexDirection: "column",
          gap: 16,
          minHeight: 150,
          justifyContent: "space-between",
          minWidth: 0,
        }}
      >
        <Skeleton height={12} width="65%" borderRadius={4} />
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Skeleton height={48} borderRadius={8} />
          <Skeleton height={14} width="60%" borderRadius={4} />
        </div>
      </div>
    );
  }
  if (isNaN(rawNum)) {
    return (
      <div
        style={{
          background: isDark ? "var(--green)" : "var(--cream)",
          color: isDark ? "var(--cream)" : "var(--ink)",
          borderRadius: 20,
          padding: "24px 26px",
          border: isDark ? "none" : "1px solid var(--ink-06)",
          display: "flex",
          flexDirection: "column",
          gap: 16,
          minHeight: 150,
          justifyContent: "space-between",
          minWidth: 0,
        }}
      >
        <div
          style={{
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: 11,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            opacity: isDark ? 0.75 : 0.6,
          }}
        >
          {label}
        </div>
        <div>
          <div
            style={{
              fontFamily: '"Instrument Serif", serif',
              fontSize: 52,
              letterSpacing: "-0.035em",
              lineHeight: 0.95,
              fontWeight: 400,
            }}
          >
            {value ?? "—"}
          </div>
          {delta !== undefined && (
            <div
              style={{
                marginTop: 10,
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 12,
                fontFamily: '"Geist", sans-serif',
              }}
            >
              <span
                style={{
                  padding: "2px 8px",
                  borderRadius: 999,
                  background:
                    delta >= 0
                      ? isDark
                        ? "var(--lime)"
                        : "oklch(0.92 0.1 140)"
                      : "oklch(0.93 0.1 30)",
                  color:
                    delta >= 0
                      ? isDark
                        ? "var(--ink)"
                        : "oklch(0.4 0.1 140)"
                      : "oklch(0.5 0.15 30)",
                  fontWeight: 600,
                  fontSize: 11,
                }}
              >
                {delta >= 0 ? "↑" : "↓"} {Math.abs(delta)}%
              </span>
              {sub && (
                <span style={{ opacity: isDark ? 0.7 : 0.6 }}>{sub}</span>
              )}
            </div>
          )}
          {delta === undefined && sub && (
            <div
              style={{
                marginTop: 10,
                fontSize: 12,
                fontFamily: '"Geist", sans-serif',
                opacity: isDark ? 0.7 : 0.6,
              }}
            >
              {sub}
            </div>
          )}
        </div>
      </div>
    );
  }
  const displayValue = formatValue(value, animated);
  return (
    <div
      style={{
        background: isDark ? "var(--green)" : "var(--cream)",
        color: isDark ? "var(--cream)" : "var(--ink)",
        borderRadius: 20,
        padding: "24px 26px",
        border: isDark ? "none" : "1px solid var(--ink-06)",
        display: "flex",
        flexDirection: "column",
        gap: 16,
        minHeight: 150,
        justifyContent: "space-between",
        minWidth: 0,
      }}
    >
      <div
        style={{
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: 11,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          opacity: isDark ? 0.75 : 0.6,
        }}
      >
        {label}
      </div>
      <div>
        <div
          style={{
            fontFamily: '"Instrument Serif", serif',
            fontSize: 52,
            letterSpacing: "-0.035em",
            lineHeight: 0.95,
            fontWeight: 400,
          }}
        >
          {displayValue}
        </div>
        {delta !== undefined && (
          <div
            style={{
              marginTop: 10,
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 12,
              fontFamily: '"Geist", sans-serif',
            }}
          >
            <span
              style={{
                padding: "2px 8px",
                borderRadius: 999,
                background:
                  delta >= 0
                    ? isDark
                      ? "var(--lime)"
                      : "oklch(0.92 0.1 140)"
                    : "oklch(0.93 0.1 30)",
                color:
                  delta >= 0
                    ? isDark
                      ? "var(--ink)"
                      : "oklch(0.4 0.1 140)"
                    : "oklch(0.5 0.15 30)",
                fontWeight: 600,
                fontSize: 11,
              }}
            >
              {delta >= 0 ? "↑" : "↓"} {Math.abs(delta)}%
            </span>
            {sub && <span style={{ opacity: isDark ? 0.7 : 0.6 }}>{sub}</span>}
          </div>
        )}
        {delta === undefined && sub && (
          <div
            style={{
              marginTop: 10,
              fontSize: 12,
              fontFamily: '"Geist", sans-serif',
              opacity: isDark ? 0.7 : 0.6,
            }}
          >
            {sub}
          </div>
        )}
      </div>
    </div>
  );
}

// PageHeader
interface PageHeaderProps {
  kicker?: string;
  title: ReactNode;
  sub?: string;
  actions?: ReactNode;
  loading?: boolean;
}
export function PageHeader({
  kicker,
  title,
  sub,
  actions,
  loading = false,
}: PageHeaderProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "end",
        justifyContent: "space-between",
        marginBottom: 32,
        gap: 24,
      }}
    >
      <div style={{ width: "100%" }}>
        {/* Kicker */}
        {loading ? (
          <Skeleton height={12} width="180px" borderRadius={4} />
        ) : (
          kicker && (
            <div
              style={{
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: 11,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "var(--ink-60)",
                marginBottom: 10,
              }}
            >
              {kicker}
            </div>
          )
        )}
        {/* Main title */}
        {loading ? (
          <div style={{ marginTop: 12 }}>
            <SkeletonTitle size="lg" width="50%" />
          </div>
        ) : (
          <h1
            style={{
              fontFamily: '"Instrument Serif", serif',
              fontSize: 56,
              letterSpacing: "-0.035em",
              lineHeight: 0.95,
              margin: 0,
              fontWeight: 400,
              color: "var(--ink)",
            }}
          >
            {title}
          </h1>
        )}
        {/* Sub */}
        {loading ? (
          <div style={{ marginTop: 12 }}>
            <Skeleton height={20} width="360px" borderRadius={4} />
          </div>
        ) : (
          sub && (
            <p
              style={{
                marginTop: 12,
                fontSize: 14,
                color: "var(--ink-60)",
                maxWidth: 540,
                lineHeight: 1.5,
              }}
            >
              {sub}
            </p>
          )
        )}
      </div>
      {actions && <div style={{ display: "flex", gap: 8 }}>{actions}</div>}
    </div>
  );
}

// Card
export function Card({
  title,
  sub,
  children,
  pad = 24,
  loading = false,
  skeletonContent,
}: {
  title?: string;
  sub?: string;
  children?: ReactNode;
  pad?: number;
  loading?: boolean;
  skeletonContent?: ReactNode;
}) {
  return (
    <div
      style={{
        background: "var(--cream)",
        border: "1px solid var(--ink-06)",
        borderRadius: 20,
        padding: pad,
        minWidth: 0,
      }}
    >
      {/* Title area — skeleton or real. Gets its own padding when `pad={0}` (a table-in-card
          layout, where the table's own th/td cells carry the 24px horizontal padding instead) so
          the title/sub text isn't flush against the card's edges. */}
      {title && (
        <div style={{ marginBottom: 20, ...(pad === 0 ? { padding: "24px 24px 0" } : {}) }}>
          {loading ? (
            <>
              <SkeletonTitle size="md" width="45%" />
              {sub && (
                <div style={{ marginTop: 6 }}>
                  <Skeleton height={14} width="160px" borderRadius={4} />
                </div>
              )}
            </>
          ) : (
            <>
              <h3
                style={{
                  fontFamily: '"Instrument Serif", serif',
                  fontSize: 26,
                  letterSpacing: "-0.02em",
                  margin: 0,
                  fontWeight: 400,
                }}
              >
                {title}
              </h3>
              {sub && (
                <div
                  style={{
                    fontSize: 11,
                    fontFamily: '"JetBrains Mono", monospace',
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "var(--ink-60)",
                    marginTop: 6,
                  }}
                >
                  {sub}
                </div>
              )}
            </>
          )}
        </div>
      )}
      {/* Content area */}
      {loading
        ? (skeletonContent ?? (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {[65, 45, 80, 35, 55].map((w, i) => (
                <Skeleton
                  key={i}
                  height={18}
                  width={`${w}%`}
                  borderRadius={5}
                />
              ))}
            </div>
          ))
        : children}
    </div>
  );
}

// Table styles
export const tableStyle: CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
};
export const th: CSSProperties = {
  textAlign: "left",
  padding: "14px 24px",
  fontSize: 10,
  fontFamily: '"JetBrains Mono", monospace',
  textTransform: "uppercase",
  letterSpacing: "0.12em",
  color: "var(--ink-60)",
  borderBottom: "1px solid var(--ink-06)",
  fontWeight: 500,
};
export const td: CSSProperties = {
  padding: "14px 24px",
  borderBottom: "1px solid var(--ink-06)",
  fontSize: 13,
  fontFamily: '"Geist", sans-serif',
  verticalAlign: "middle",
};
export const trStyle: CSSProperties = { transition: "background 120ms" };
export const iconBtnAd: CSSProperties = {
  width: 30,
  height: 30,
  borderRadius: 8,
  border: "1px solid var(--ink-06)",
  background: "transparent",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "var(--ink-60)",
};

// Generic click-to-sort table header + "clear sort" chip, shared by every admin table
// (Productos, Pedidos, Clientes) so they all sort the same way: click cycles asc -> desc ->
// unsorted, and the chip gives an explicit way back to unsorted too.
export type SortDir = "asc" | "desc";
export type ColumnSort<K extends string> = { key: K | null; dir: SortDir };

export function SortableTh<K extends string>({
  label,
  sortKey,
  activeSort,
  onSort,
}: {
  label: string;
  sortKey: K;
  activeSort: ColumnSort<K>;
  onSort: (key: K) => void;
}) {
  const active = activeSort.key === sortKey;
  return (
    <th style={{ ...th, whiteSpace: "nowrap" }}>
      <button
        onClick={() => onSort(sortKey)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          border: "none",
          background: "transparent",
          padding: 0,
          cursor: "pointer",
          font: "inherit",
          color: active ? "var(--ink)" : "var(--ink-60)",
          letterSpacing: "inherit",
          textTransform: "inherit",
          whiteSpace: "nowrap",
        }}
        title={`Ordenar por ${label.toLowerCase()}`}
      >
        {label}
        <span style={{ fontSize: 9, opacity: active ? 1 : 0.35 }}>
          {active ? (activeSort.dir === "asc" ? "▲" : "▼") : "▲▼"}
        </span>
      </button>
    </th>
  );
}

export function SortClearChip<K extends string>({
  sort,
  labels,
  onClear,
}: {
  sort: ColumnSort<K>;
  labels: Record<K, string>;
  onClear: () => void;
}) {
  if (!sort.key) return null;
  return (
    <button
      onClick={onClear}
      title="Quitar orden"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "5px 10px",
        borderRadius: 999,
        border: "1px solid var(--ink-20)",
        background: "transparent",
        color: "var(--ink-60)",
        fontSize: 11,
        fontFamily: '"JetBrains Mono", monospace',
        cursor: "pointer",
      }}
    >
      Orden: {labels[sort.key]} {sort.dir === "asc" ? "▲" : "▼"}
      <Icon name="x" size={11} />
    </button>
  );
}

// Donut
export function Donut({
  data,
  size = 220,
}: {
  data: { cat?: string; pct: number; color: string }[];
  size?: number;
}) {
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
        const x1 = c + Math.cos(start) * r;
        const y1 = c + Math.sin(start) * r;
        const x2 = c + Math.cos(end) * r;
        const y2 = c + Math.sin(end) * r;
        return (
          <path
            key={i}
            d={`M${c},${c} L${x1},${y1} A${r},${r} 0 ${large} 1 ${x2},${y2} Z`}
            fill={d.color}
            stroke="var(--cream)"
            strokeWidth="2"
          />
        );
      })}
      <circle cx={c} cy={c} r={r * 0.6} fill="var(--cream)" />
      <text
        x={c}
        y={c - 4}
        textAnchor="middle"
        fontFamily='"Instrument Serif", serif'
        fontSize="28"
        fill="var(--ink)"
      >
        $53.4K
      </text>
      <text
        x={c}
        y={c + 16}
        textAnchor="middle"
        fontFamily='"JetBrains Mono", monospace'
        fontSize="9"
        fill="var(--ink-60)"
        letterSpacing="0.1em"
      >
        TOTAL MES
      </text>
    </svg>
  );
}

// Sidebar
type AdminPage =
  | "dashboard"
  | "orders"
  | "products"
  | "categories"
  | "coupons"
  | "users"
  | "sales"
  | "earnings"
  | "returns"
  | "reviews"
  | "audit"
  | "repurchase"
  | "analytics";
interface SidebarProps {
  page: AdminPage;
  setPage: (p: AdminPage) => void;
  onGoToStore: () => void;
  counts?: Partial<Record<AdminPage, number>>;
  adminName?: string;
  adminEmail?: string;
  adminPhoto?: string;
}

export function Sidebar({
  page,
  setPage,
  onGoToStore,
  counts,
  adminName,
  adminEmail,
  adminPhoto,
}: SidebarProps) {
  const { theme, toggle: toggleTheme } = useThemeStore();
  const items: {
    id: AdminPage;
    label: string;
    icon: string;
    count?: number;
  }[] = [
    { id: "dashboard", label: "Dashboard", icon: "shield" },
    { id: "orders", label: "Pedidos", icon: "bag", count: counts?.orders },
    {
      id: "products",
      label: "Productos",
      icon: "leaf",
      count: counts?.products,
    },
    {
      id: "categories",
      label: "Categorías",
      icon: "layers",
      count: counts?.categories,
    },
    { id: "coupons", label: "Cupones", icon: "percent" },
    { id: "users", label: "Clientes", icon: "user", count: counts?.users },
    { id: "returns", label: "Devoluciones", icon: "arrow-left", count: counts?.returns },
    { id: "reviews", label: "Reseñas", icon: "star", count: counts?.reviews },
    { id: "sales", label: "Ventas", icon: "truck" },
    { id: "earnings", label: "Ganancias", icon: "percent" },
    { id: "audit", label: "Auditoría", icon: "lock" },
    { id: "repurchase", label: "Recompra", icon: "bell" },
    { id: "analytics", label: "Analítica", icon: "package" },
  ];
  return (
    <aside
      style={{
        width: 240,
        background: "var(--cream)",
        borderRight: "1px solid var(--ink-06)",
        display: "flex",
        flexDirection: "column",
        padding: "24px 16px",
        position: "sticky",
        top: 0,
        height: "100vh",
        // `position: sticky` creates its own stacking context, so the notification dropdown's
        // zIndex:90 only wins *inside* this aside - without an explicit zIndex here the whole
        // sidebar (dropdown included) paints below the static main content next to it, which
        // comes later in DOM order. Matches the mobile top bar's zIndex:50 (AdminPanel.tsx).
        zIndex: 50,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          padding: "4px 8px 24px",
          borderBottom: "1px solid var(--ink-06)",
          marginBottom: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 999,
              background: "var(--green)",
              color: "var(--lime)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: '"Instrument Serif", serif',
              fontSize: 18,
              flexShrink: 0,
            }}
          >
            h
          </div>
          <div>
            <div
              style={{
                fontFamily: '"Instrument Serif", serif',
                fontSize: 20,
                letterSpacing: "-0.02em",
                lineHeight: 1,
              }}
            >
              Healthora
            </div>
            <div
              style={{
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: 9,
                color: "var(--ink-60)",
                letterSpacing: "0.12em",
                marginTop: 2,
              }}
            >
              ADMIN PANEL
            </div>
          </div>
        </div>
        <NotificationCenter
          panelAlign="left"
          buttonStyle={{
            background: "transparent",
            border: "1px solid var(--ink-06)",
            borderRadius: 999,
            padding: 7,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            color: "var(--ink)",
            flexShrink: 0,
          }}
          iconSize={15}
        />
      </div>
      <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {items.map((it) => (
          <button
            key={it.id}
            onClick={() => setPage(it.id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "10px 12px",
              borderRadius: 10,
              border: "none",
              cursor: "pointer",
              background: page === it.id ? "var(--ink)" : "transparent",
              color: page === it.id ? "var(--cream)" : "var(--ink)",
              fontSize: 13,
              fontFamily: '"Geist", sans-serif',
              textAlign: "left",
              letterSpacing: "-0.01em",
            }}
          >
            <Icon name={it.icon} size={16} />
            <span style={{ flex: 1 }}>{it.label}</span>
            {it.count !== undefined && (
              <span
                style={{
                  fontSize: 10,
                  fontFamily: '"JetBrains Mono", monospace',
                  padding: "2px 6px",
                  borderRadius: 999,
                  background: page === it.id ? "var(--green)" : "var(--ink-06)",
                  color: page === it.id ? "white" : "var(--ink-60)",
                }}
              >
                {it.count}
              </span>
            )}
          </button>
        ))}
      </nav>
      <div style={{ marginTop: "auto" }}>
        <button
          onClick={toggleTheme}
          style={{
            width: "100%",
            marginBottom: 8,
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontSize: 12,
            fontFamily: '"Geist", sans-serif',
            color: "var(--ink-60)",
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid var(--ink-06)",
            background: "transparent",
            cursor: "pointer",
            textAlign: "left",
          }}
          title={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
        >
          <span style={{ display: "flex", transition: "transform 400ms cubic-bezier(.34,1.56,.64,1)", transform: theme === "dark" ? "rotate(180deg)" : "rotate(0deg)" }}>
            <Icon name={theme === "dark" ? "sun" : "moon"} size={14} />
          </span>
          {theme === "dark" ? "Modo claro" : "Modo oscuro"}
        </button>
        <button
          onClick={onGoToStore}
          style={{
            width: "100%",
            marginBottom: 12,
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontSize: 12,
            fontFamily: '"Geist", sans-serif',
            color: "var(--ink-60)",
            textDecoration: "none",
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid var(--ink-06)",
            background: "transparent",
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          <Icon name="arrow-left" size={14} />
          Ver tienda
        </button>
        <div
          style={{
            padding: 12,
            background: "var(--cream-2)",
            borderRadius: 12,
            border: "1px solid var(--ink-06)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 999,
                background: "var(--green)",
                color: "var(--lime)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: '"Instrument Serif", serif',
                fontSize: 13,
                overflow: "hidden",
                flexShrink: 0,
              }}
            >
              {adminPhoto ? (
                <img src={adminPhoto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                (adminName?.[0] ?? "A").toUpperCase()
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 500, lineHeight: 1.2 }}>
                {adminName || "Admin"}
              </div>
              <div
                style={{
                  fontSize: 10,
                  fontFamily: '"JetBrains Mono", monospace',
                  color: "var(--ink-60)",
                  letterSpacing: "0.04em",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {adminEmail || "ADMIN@HEALTHORA"}
              </div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
