import {
  type ChangeEvent,
  type CSSProperties,
  type DragEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useBreakpoint } from "../../hooks/useBreakpoint";
import { useAuth, useClerk, useUser } from "@clerk/clerk-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Sidebar,
  KpiCard,
  PageHeader,
  Card,
  LineChart,
  BarChart,
  StatusPill,
  tableStyle,
  th,
  td,
  trStyle,
  iconBtnAd,
  Skeleton,
  initAdminSession,
  useOnceLoading,
} from "../../components/admin";
import { ProductImage } from "../../components/shared/ProductImage";
import { AnimatedButton } from "../../components/shared/AnimatedButton";
import { Icon } from "../../components/shared/Icon";
import { api } from "../../lib/api";
import type {
  FulfillmentStatus,
  OrderAddress,
  OrderLineItem,
  PaymentStatus,
  Product,
} from "../../types";

type AdminPage =
  | "dashboard"
  | "orders"
  | "products"
  | "users"
  | "sales"
  | "earnings";
interface AdminAppProps {
  onGoToStore: () => void;
}
type AdminAccess = {
  allowed: boolean;
  role: string;
  name?: string;
  email?: string;
};
type DashboardData = {
  kpis: {
    revenue: number;
    revenueDelta: number;
    totalOrders: number;
    monthOrders: number;
    totalUsers: number;
    lowStock: number;
  };
  dailySales: { revenue: number; date: string }[];
  recentOrders: AdminOrder[];
  lowStockProducts: Product[];
};
type AdminOrder = {
  _id: string;
  customerName?: string;
  customerEmail?: string;
  items?: OrderLineItem[];
  total?: number;
  status?: string;
  paymentStatus?: PaymentStatus;
  fulfillmentStatus?: FulfillmentStatus;
  address?: OrderAddress;
  createdAt?: string;
};
type AdminUser = {
  _id: string;
  name?: string;
  email?: string;
  role?: "customer" | "admin";
  orderCount?: number;
  ltv?: number;
  createdAt?: string;
  imageUrl?: string;
};
type SalesData = {
  summary?: {
    totalOrders: number;
    totalRevenue: number;
    avgOrderValue: number;
    totalUnits: number;
  };
  daily?: { revenue: number; date: string; orders: number; units: number }[];
  revenueByCategory?: { _id: string; revenue: number; units: number }[];
  byCategory?: {
    productId: string;
    name: string;
    brand: string;
    category: string;
    revenue: number;
    units: number;
  }[];
  topProducts?: { _id: string; revenue: number; units: number }[];
  topCategories?: { _id: string; units: number; revenue: number }[];
  topBrands?: { _id: string; units: number; revenue: number }[];
};
type EarningsData = {
  monthly?: { month: string; revenue: number; orders: number }[];
  summary?: {
    gross: number;
    tax: number;
    shipping: number;
    fees: number;
    net: number;
    orders: number;
  };
};

const fulfillmentStatusOptions: (FulfillmentStatus | "")[] = [
  "",
  "unfulfilled",
  "processing",
  "shipped",
  "delivered",
];
const fulfillmentStatusLabels: Record<FulfillmentStatus | "", string> = {
  "": "Todos",
  unfulfilled: "Pendiente",
  processing: "Preparando",
  shipped: "Enviada",
  delivered: "Entregada",
  cancelled: "Cancelada",
};

const ADMIN_PAGE_SIZE = 10;

function paginateItems<T>(items: T[], page: number) {
  const totalPages = Math.max(1, Math.ceil(items.length / ADMIN_PAGE_SIZE));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const start = (safePage - 1) * ADMIN_PAGE_SIZE;
  return {
    page: safePage,
    totalPages,
    items: items.slice(start, start + ADMIN_PAGE_SIZE),
    start: items.length ? start + 1 : 0,
    end: Math.min(start + ADMIN_PAGE_SIZE, items.length),
  };
}

function PaginationControls({
  page,
  totalPages,
  totalItems,
  start,
  end,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  totalItems: number;
  start: number;
  end: number;
  onPageChange: (page: number) => void;
}) {
  if (totalItems <= ADMIN_PAGE_SIZE) return null;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "14px 24px",
        borderTop: "1px solid var(--ink-06)",
        fontFamily: '"Geist", sans-serif',
        fontSize: 12,
        color: "var(--ink-60)",
      }}
    >
      <span>
        Mostrando {start}-{end} de {totalItems}
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          style={{
            padding: "7px 12px",
            borderRadius: 999,
            border: "1px solid var(--ink-10)",
            background: "transparent",
            color: "var(--ink)",
            cursor: page <= 1 ? "not-allowed" : "pointer",
            opacity: page <= 1 ? 0.42 : 1,
          }}
        >
          Anterior
        </button>
        <span
          style={{
            fontFamily: '"JetBrains Mono", monospace',
            color: "var(--ink-60)",
          }}
        >
          {page} / {totalPages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          style={{
            padding: "7px 12px",
            borderRadius: 999,
            border: "1px solid var(--ink-10)",
            background: "transparent",
            color: "var(--ink)",
            cursor: page >= totalPages ? "not-allowed" : "pointer",
            opacity: page >= totalPages ? 0.42 : 1,
          }}
        >
          Siguiente
        </button>
      </div>
    </div>
  );
}

// ─── ProductForm ─────────────────────────────────────────────────────────────

type ProductForm = {
  name: string;
  brand: string;
  category: string;
  need: string;
  short: string;
  price: string;
  priceBefore: string;
  tag: string;
  stock: string;
  active: boolean;
  benefits: string;
  usage: string;
  ingredients: string;
  warnings: string;
  extraTabs: { id: string; label: string; content: string }[];
  imageUrl: string;
  image2: string;
  image3: string;
  image4: string;
  color: string;
  swatchColor: string;
  label: string;
};

const emptyForm: ProductForm = {
  name: "",
  brand: "",
  category: "",
  need: "",
  short: "",
  price: "0",
  priceBefore: "",
  tag: "",
  stock: "0",
  active: true,
  benefits: "",
  usage: "",
  ingredients: "",
  warnings: "",
  extraTabs: [],
  imageUrl: "",
  image2: "",
  image3: "",
  image4: "",
  color: "oklch(0.92 0.1 140)",
  swatchColor: "oklch(0.6 0.15 140)",
  label: "",
};

function normalizeTag(tag: string) {
  const normalized = tag.trim().toLowerCase().replace(/\s+/g, " ");
  if (!normalized) return "";
  if (normalized === "best seller" || normalized === "bestseller")
    return "Best seller";
  if (normalized === "nuevo") return "Nuevo";
  if (normalized === "premium") return "Premium";
  if (normalized === "oferta") return "Oferta";
  return tag.trim();
}

function productToForm(p: Product): ProductForm {
  return {
    name: p.name,
    brand: p.brand,
    category: p.category,
    need: p.need || "",
    short: p.short || "",
    price: String(p.price),
    priceBefore: p.priceBefore ? String(p.priceBefore) : "",
    tag: p.tag || "",
    stock: String(p.stock),
    active: p.active,
    benefits: (p.benefits || []).join("\n"),
    usage: p.usage || "",
    ingredients: p.ingredients || "",
    warnings: p.warnings || "",
    extraTabs: p.extraTabs || [],
    imageUrl: p.imageUrl || p.images?.[0]?.url || "",
    image2: p.images?.[1]?.url || "",
    image3: p.images?.[2]?.url || "",
    image4: p.images?.[3]?.url || "",
    color: p.color || "oklch(0.92 0.1 140)",
    swatchColor: p.swatchColor || "oklch(0.6 0.15 140)",
    label: p.label || "",
  };
}

function slugify(text: string) {
  return text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function formToPayload(f: ProductForm): Partial<Product> {
  const allImages: NonNullable<Product["images"]> = [];
  if (f.imageUrl) allImages.push({ url: f.imageUrl, isPrimary: true });
  if (f.image2) allImages.push({ url: f.image2 });
  if (f.image3) allImages.push({ url: f.image3 });
  if (f.image4) allImages.push({ url: f.image4 });
  return {
    id: slugify(f.name),
    name: f.name.trim(),
    brand: f.brand.trim(),
    category: f.category.trim(),
    need: f.need.trim(),
    short: f.short.trim(),
    price: parseFloat(f.price) || 0,
    ...(f.priceBefore ? { priceBefore: parseFloat(f.priceBefore) } : {}),
    ...(f.tag ? { tag: normalizeTag(f.tag) } : {}),
    stock: parseInt(f.stock) || 0,
    active: f.active,
    benefits: f.benefits
      .split("\n")
      .map((b) => b.trim())
      .filter(Boolean),
    usage: f.usage.trim(),
    ingredients: f.ingredients.trim(),
    warnings: f.warnings.trim(),
    extraTabs: f.extraTabs
      .filter((t) => t.label.trim() && t.content.trim())
      .map((t) => ({
        id: slugify(t.label),
        label: t.label.trim(),
        content: t.content.trim(),
      })),
    ...(f.imageUrl ? { imageUrl: f.imageUrl } : {}),
    images: allImages,
    color: f.color,
    swatchColor: f.swatchColor,
    label: f.label.trim(),
    rating: 0,
    reviews: 0,
  };
}

// ─── ImageDropZone ────────────────────────────────────────────────────────────

function ImageDropZone({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
}) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const processFile = (file: File) => {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (e) => onChange(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <span
        style={{
          fontSize: 10,
          fontFamily: '"JetBrains Mono", monospace',
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          color: "var(--ink-60)",
          marginBottom: 6,
        }}
      >
        {label}
      </span>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => !value && inputRef.current?.click()}
        style={{
          border: `2px dashed ${dragging ? "var(--green)" : value ? "var(--ink-12)" : "var(--ink-20)"}`,
          borderRadius: 12,
          height: 130,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: value ? "default" : "pointer",
          background: dragging ? "oklch(0.97 0.02 140)" : "var(--cream-2)",
          position: "relative",
          overflow: "hidden",
          transition: "border-color 120ms, background 120ms",
        }}
      >
        {value ? (
          <>
            <img
              src={value}
              alt=""
              style={{
                maxWidth: "100%",
                maxHeight: "100%",
                objectFit: "contain",
                padding: 10,
              }}
            />
            <button
              onClick={(e) => {
                e.stopPropagation();
                onChange("");
              }}
              style={{
                position: "absolute",
                top: 6,
                right: 6,
                width: 22,
                height: 22,
                borderRadius: 999,
                background: "var(--ink)",
                color: "var(--cream)",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                opacity: 0.75,
              }}
            >
              <Icon name="x" size={11} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                inputRef.current?.click();
              }}
              style={{
                position: "absolute",
                bottom: 6,
                right: 6,
                padding: "3px 8px",
                borderRadius: 6,
                background: "var(--ink)",
                color: "var(--cream)",
                border: "none",
                cursor: "pointer",
                fontSize: 10,
                fontFamily: '"JetBrains Mono", monospace',
                opacity: 0.7,
              }}
            >
              cambiar
            </button>
          </>
        ) : (
          <div
            style={{
              textAlign: "center",
              color: "var(--ink-40)",
              pointerEvents: "none",
            }}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ marginBottom: 8 }}
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <div
              style={{
                fontSize: 10,
                fontFamily: '"JetBrains Mono", monospace',
                letterSpacing: "0.08em",
              }}
            >
              ARRASTRA O HAZ CLIC
            </div>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) processFile(f);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}

// ─── ProductModal ─────────────────────────────────────────────────────────────

function ProductModal({
  mode,
  product,
  categories,
  onClose,
  onSave,
  saving,
  error,
}: {
  mode: "add" | "edit";
  product?: Product;
  categories: string[];
  onClose: () => void;
  onSave: (data: Partial<Product>) => void;
  saving: boolean;
  error?: string | null;
}) {
  const [form, setForm] = useState<ProductForm>(() =>
    product ? productToForm(product) : { ...emptyForm },
  );
  const [validationError, setValidationError] = useState("");

  const setF =
    (key: keyof ProductForm) =>
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((prev) => ({ ...prev, [key]: e.target.value }));
  const setSelect =
    (key: keyof ProductForm) => (e: ChangeEvent<HTMLSelectElement>) =>
      setForm((prev) => ({ ...prev, [key]: e.target.value }));
  const setChk =
    (key: keyof ProductForm) => (e: ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [key]: e.target.checked }));
  const setImg = (key: keyof ProductForm) => (v: string) =>
    setForm((prev) => ({ ...prev, [key]: v }));

  const handleSave = () => {
    if (!form.name.trim()) {
      setValidationError("El nombre es obligatorio.");
      return;
    }
    if (!form.brand.trim()) {
      setValidationError("La marca es obligatoria.");
      return;
    }
    if (!form.category.trim()) {
      setValidationError("La categoría es obligatoria.");
      return;
    }
    if (!form.need.trim()) {
      setValidationError("La necesidad es obligatoria.");
      return;
    }
    if (!form.short.trim()) {
      setValidationError("La descripción corta es obligatoria.");
      return;
    }
    if ((parseFloat(form.price) || 0) <= 0) {
      setValidationError("El precio debe ser mayor a 0.");
      return;
    }
    if ((parseInt(form.stock) || 0) <= 0) {
      setValidationError("Las existencias tienen que ser mayor a 0.");
      return;
    }
    if (!form.imageUrl.trim()) {
      setValidationError("La imagen 1 es obligatoria.");
      return;
    }
    setValidationError("");
    onSave(formToPayload(form));
  };

  const inputS: CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid var(--ink-20)",
    background: "var(--cream-2)",
    fontSize: 13,
    fontFamily: '"Geist", sans-serif',
    color: "var(--ink)",
    boxSizing: "border-box",
    outline: "none",
  };
  const labelS: CSSProperties = {
    fontSize: 10,
    fontFamily: '"JetBrains Mono", monospace',
    textTransform: "uppercase",
    letterSpacing: "0.12em",
    color: "var(--ink-60)",
    marginBottom: 6,
    display: "block",
  };
  const fieldS: CSSProperties = { display: "flex", flexDirection: "column" };
  const sectionS: CSSProperties = {
    fontSize: 10,
    fontFamily: '"JetBrains Mono", monospace',
    textTransform: "uppercase",
    letterSpacing: "0.12em",
    color: "var(--ink-60)",
    marginBottom: 16,
  };
  const dividerS: CSSProperties = {
    height: 1,
    background: "var(--ink-06)",
    margin: "22px 0",
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "var(--cream)",
          borderRadius: 20,
          border: "1px solid var(--ink-06)",
          width: "100%",
          maxWidth: 720,
          maxHeight: "92vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "22px 28px",
            borderBottom: "1px solid var(--ink-06)",
            flexShrink: 0,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 10,
                fontFamily: '"JetBrains Mono", monospace',
                textTransform: "uppercase",
                letterSpacing: "0.12em",
                color: "var(--ink-60)",
                marginBottom: 4,
              }}
            >
              {mode === "add" ? "Nuevo producto" : "Editar producto"}
            </div>
            <h2
              style={{
                fontFamily: '"Instrument Serif", serif',
                fontSize: 28,
                margin: 0,
                fontWeight: 400,
                letterSpacing: "-0.02em",
              }}
            >
              {mode === "add" ? (
                <>
                  Agregar <em style={{ color: "var(--green)" }}>producto</em>
                </>
              ) : (
                form.name || "Editar"
              )}
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 36,
              height: 36,
              borderRadius: 999,
              border: "1px solid var(--ink-06)",
              background: "transparent",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="x" size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: 28 }}>
          {/* Información básica */}
          <div style={sectionS}>Información básica</div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 16,
              marginBottom: 16,
            }}
          >
            <div style={fieldS}>
              <label style={labelS}>Nombre</label>
              <input
                style={inputS}
                value={form.name}
                onChange={setF("name")}
                placeholder="Nombre del producto"
              />
            </div>
            <div style={fieldS}>
              <label style={labelS}>Marca</label>
              <input
                style={inputS}
                value={form.brand}
                onChange={setF("brand")}
                placeholder="Nombre de la marca"
              />
            </div>
            <div style={fieldS}>
              <label style={labelS}>Categoría</label>
              <select
                style={{
                  ...inputS,
                  appearance: "none",
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
                  backgroundRepeat: "no-repeat",
                  backgroundPosition: "right 12px center",
                  paddingRight: 32,
                  cursor: "pointer",
                }}
                value={form.category}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    category: e.target.value,
                  }))
                }
              >
                <option value="">Seleccionar categoría…</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div style={fieldS}>
              <label style={labelS}>Necesidad</label>
              <input
                style={inputS}
                value={form.need}
                onChange={setF("need")}
                placeholder="ej: Inmunidad, Energía"
              />
            </div>
          </div>
          <div style={fieldS}>
            <label style={labelS}>Descripción corta</label>
            <textarea
              style={{
                ...inputS,
                resize: "vertical",
                minHeight: 68,
              }}
              value={form.short}
              onChange={setF("short")}
              placeholder="Breve descripción del producto…"
            />
          </div>

          <div style={dividerS} />

          {/* Precio & Inventario */}
          <div style={sectionS}>Precio · Inventario</div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr auto",
              gap: 16,
              marginBottom: 16,
              alignItems: "end",
            }}
          >
            <div style={fieldS}>
              <label style={labelS}>Precio ($)</label>
              <input
                style={inputS}
                type="number"
                value={form.price}
                onChange={setF("price")}
                min={0}
                step={0.01}
              />
            </div>
            <div style={fieldS}>
              <label style={labelS}>Existencias</label>
              <input
                style={inputS}
                type="number"
                value={form.stock}
                onChange={setF("stock")}
                min={0}
              />
            </div>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                paddingBottom: 12,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              <input
                type="checkbox"
                checked={form.active}
                onChange={setChk("active")}
                style={{
                  width: 16,
                  height: 16,
                  accentColor: "var(--green)",
                  cursor: "pointer",
                }}
              />
              <span
                style={{
                  fontSize: 13,
                  fontFamily: '"Geist", sans-serif',
                }}
              >
                Activo
              </span>
            </label>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr",
              gap: 16,
            }}
          >
            <div style={fieldS}>
              <label style={labelS}>Tag</label>
              <select
                style={{
                  ...inputS,
                  appearance: "none",
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
                  backgroundRepeat: "no-repeat",
                  backgroundPosition: "right 12px center",
                  paddingRight: 32,
                  cursor: "pointer",
                }}
                value={form.tag}
                onChange={setSelect("tag")}
              >
                <option value="">Sin tag</option>
                <option value="Best seller">Best seller</option>
                <option value="Nuevo">Nuevo</option>
                <option value="Premium">Premium</option>
                <option value="Oferta">Oferta</option>
              </select>
            </div>
          </div>

          <div style={dividerS} />

          {/* Imágenes */}
          <div style={sectionS}>Imágenes del producto</div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 16,
            }}
          >
            <ImageDropZone
              value={form.imageUrl}
              onChange={setImg("imageUrl")}
              label="Imagen 1 · principal"
            />
            <ImageDropZone
              value={form.image2}
              onChange={setImg("image2")}
              label="Imagen 2 (opcional)"
            />
            <ImageDropZone
              value={form.image3}
              onChange={setImg("image3")}
              label="Imagen 3 (opcional)"
            />
            <ImageDropZone
              value={form.image4}
              onChange={setImg("image4")}
              label="Imagen 4 (opcional)"
            />
          </div>

          <div style={dividerS} />

          {/* Detalles */}
          <div style={sectionS}>Detalles del producto (opcional)</div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            <div style={fieldS}>
              <label style={labelS}>
                Beneficios (opcional){" "}
                <span
                  style={{
                    fontFamily: '"Geist", sans-serif',
                    textTransform: "none",
                    letterSpacing: 0,
                    fontWeight: 400,
                  }}
                >
                  (uno por línea)
                </span>
              </label>
              <textarea
                style={{
                  ...inputS,
                  resize: "vertical",
                  minHeight: 88,
                }}
                value={form.benefits}
                onChange={setF("benefits")}
                placeholder={
                  "Opcional: mejora el sistema inmune\nAumenta la energía\nReduce el estrés"
                }
              />
            </div>
            <div style={fieldS}>
              <label style={labelS}>Modo de uso (opcional)</label>
              <textarea
                style={{
                  ...inputS,
                  resize: "vertical",
                  minHeight: 68,
                }}
                value={form.usage}
                onChange={setF("usage")}
                placeholder="Opcional: tomar 1 cápsula al día con agua…"
              />
            </div>
            <div style={fieldS}>
              <label style={labelS}>Ingredientes (opcional)</label>
              <textarea
                style={{
                  ...inputS,
                  resize: "vertical",
                  minHeight: 68,
                }}
                value={form.ingredients}
                onChange={setF("ingredients")}
                placeholder="Opcional: vitamina C 500mg, Zinc 10mg…"
              />
            </div>
            <div style={fieldS}>
              <label style={labelS}>Advertencias (opcional)</label>
              <textarea
                style={{
                  ...inputS,
                  resize: "vertical",
                  minHeight: 68,
                }}
                value={form.warnings}
                onChange={setF("warnings")}
                placeholder="Opcional: mantener fuera del alcance de los niños…"
              />
            </div>
          </div>

          {/* Extra Tabs */}
          <div
            style={{
              padding: "0 28px 20px",
              borderTop: "1px solid var(--ink-06)",
              marginTop: 8,
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontFamily: '"JetBrains Mono", monospace',
                textTransform: "uppercase",
                letterSpacing: "0.12em",
                color: "var(--ink-60)",
                marginBottom: 12,
                marginTop: 16,
              }}
            >
              Pestañas personalizadas
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {form.extraTabs.map((tab, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    gap: 8,
                    alignItems: "center",
                    padding: "10px 12px",
                    borderRadius: 10,
                    background: "var(--cream-2)",
                    border: "1px solid var(--ink-06)",
                  }}
                >
                  <div
                    style={{
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                    }}
                  >
                    <input
                      value={tab.label}
                      onChange={(e) => {
                        const newTabs = [...form.extraTabs];
                        newTabs[idx] = {
                          ...newTabs[idx],
                          label: e.target.value,
                        };
                        setForm((prev) => ({ ...prev, extraTabs: newTabs }));
                      }}
                      placeholder="Título (ej: Fórmula)"
                      style={{ ...inputS, fontSize: 12, fontWeight: 500 }}
                    />
                    <textarea
                      value={tab.content}
                      onChange={(e) => {
                        const newTabs = [...form.extraTabs];
                        newTabs[idx] = {
                          ...newTabs[idx],
                          content: e.target.value,
                        };
                        setForm((prev) => ({ ...prev, extraTabs: newTabs }));
                      }}
                      placeholder="Contenido de la pestaña…"
                      style={{
                        ...inputS,
                        minHeight: 60,
                        resize: "vertical",
                        fontSize: 12,
                      }}
                    />
                  </div>
                  <button
                    onClick={() => {
                      const newTabs = form.extraTabs.filter(
                        (_, i) => i !== idx,
                      );
                      setForm((prev) => ({ ...prev, extraTabs: newTabs }));
                    }}
                    style={{ ...iconBtnAd, color: "var(--coral)" }}
                    title="Eliminar pestaña"
                  >
                    <Icon name="trash-2" size={14} />
                  </button>
                </div>
              ))}
              <button
                onClick={() =>
                  setForm((prev) => ({
                    ...prev,
                    extraTabs: [
                      ...prev.extraTabs,
                      { id: "", label: "", content: "" },
                    ],
                  }))
                }
                style={{
                  fontSize: 12,
                  color: "var(--green)",
                  cursor: "pointer",
                  padding: "8px 0",
                  textAlign: "left",
                  background: "transparent",
                  border: "none",
                }}
              >
                + Agregar pestaña
              </button>
            </div>
          </div>
        </div>
        <div
          style={{
            padding: "16px 28px",
            borderTop: "1px solid var(--ink-06)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexShrink: 0,
          }}
        >
          <div
            style={{
              fontSize: 12,
              color: "oklch(0.5 0.15 30)",
              fontFamily: '"Geist", sans-serif',
              minHeight: 18,
            }}
          >
            {validationError || error || ""}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <AnimatedButton variant="outline" onClick={onClose} text="Cancelar" />
            <AnimatedButton variant="primary" onClick={handleSave} disabled={saving} text={saving ? "Guardando…" : mode === "add" ? "Agregar producto" : "Guardar cambios"} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Auth helpers ─────────────────────────────────────────────────────────────

function useAdminToken() {
  const { getToken } = useAuth();
  return async () => {
    const token = await getToken();
    if (!token) throw new Error("Necesitas iniciar sesión");
    return token;
  };
}

// ─── AdminAccessGate ──────────────────────────────────────────────────────────

function AdminAccessGate({ onGoToStore }: { onGoToStore: () => void }) {
  const getAdminToken = useAdminToken();
  const { isSignedIn } = useUser();
  const { openSignIn } = useClerk();
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-access"],
    queryFn: async () => api.admin.access(await getAdminToken()),
    retry: false,
    enabled: isSignedIn,
  });

  if (!isSignedIn) {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "var(--cream-2)",
          padding: "clamp(16px, 4vw, 40px)",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 520,
            background: "var(--cream)",
            border: "1px solid var(--ink-06)",
            borderRadius: 28,
            padding: 36,
          }}
        >
          <div
            style={{
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: 11,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "var(--ink-60)",
              marginBottom: 12,
            }}
          >
            Acceso interno
          </div>
          <h1
            style={{
              fontFamily: '"Instrument Serif", serif',
              fontSize: 54,
              lineHeight: 0.95,
              letterSpacing: "-0.035em",
              margin: 0,
              fontWeight: 400,
            }}
          >
            Panel de <em style={{ color: "var(--green)" }}>administración</em>
          </h1>
          <p
            style={{
              marginTop: 16,
              fontSize: 15,
              lineHeight: 1.6,
              color: "var(--ink-60)",
            }}
          >
            Debes iniciar sesión con una cuenta autorizada como admin para
            continuar.
          </p>
          <div style={{ display: "flex", gap: 10, marginTop: 24, flexWrap: "wrap" }}>
            <AnimatedButton variant="primary" onClick={() => openSignIn({ redirectUrl: `${window.location.origin}?view=admin` })} text="Iniciar sesión como admin" />
            <AnimatedButton variant="outline" onClick={onGoToStore} text="Volver a la tienda" />
          </div>
        </div>
      </main>
    );
  }

  if (isLoading) {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "var(--cream-2)",
        }}
      >
        Validando acceso admin…
      </main>
    );
  }

  if (error || !data?.allowed) {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "var(--cream-2)",
          padding: "clamp(16px, 4vw, 40px)",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 520,
            background: "var(--cream)",
            border: "1px solid var(--ink-06)",
            borderRadius: 28,
            padding: 36,
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 999,
              background: "oklch(0.93 0.1 30)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "oklch(0.5 0.15 30)",
              marginBottom: 16,
            }}
          >
            <Icon name="shield" size={24} />
          </div>
          <h1
            style={{
              fontFamily: '"Instrument Serif", serif',
              fontSize: 48,
              lineHeight: 0.95,
              letterSpacing: "-0.035em",
              margin: 0,
              fontWeight: 400,
            }}
          >
            Acceso <em style={{ color: "var(--coral)" }}>denegado</em>
          </h1>
          <p
            style={{
              marginTop: 16,
              fontSize: 15,
              lineHeight: 1.6,
              color: "var(--ink-60)",
            }}
          >
            Tu cuenta no tiene permisos de administrador.
          </p>
          <div style={{ marginTop: 24 }}>
            <AnimatedButton variant="outline" onClick={onGoToStore} text="Volver a la tienda" />
          </div>
        </div>
      </main>
    );
  }

  return <AdminPanel access={data} onGoToStore={onGoToStore} />;
}

// ─── AdminPanel ───────────────────────────────────────────────────────────────

function AdminPanel({
  access,
  onGoToStore,
}: {
  access: AdminAccess;
  onGoToStore: () => void;
}) {
  const { user } = useUser();
  const getAdminToken = useAdminToken();
  const queryClient = useQueryClient();
  const bp = useBreakpoint();
  const isMobile = bp === 'mobile';
  const isTablet = bp === 'tablet';
  const isSmall = isMobile || isTablet;
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [page, setPage] = useState<AdminPage>("dashboard");

  useEffect(() => {
    initAdminSession();
    queryClient.prefetchQuery({
      queryKey: ["admin-users"],
      queryFn: async () =>
        api.admin.users(await getAdminToken()) as Promise<AdminUser[]>,
    });
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && page !== "dashboard") {
      localStorage.setItem("healthora_admin_page", page);
    }
  }, [page]);
const [orderFulfillmentFilter, setOrderFulfillmentFilter] = useState("");
  const [usersLoading, setUsersLoading] = useState(true);

  useEffect(() => {
    if (page === "users") {
      setUsersLoading(true);
      const timer = setTimeout(() => setUsersLoading(false), 1800);
      return () => clearTimeout(timer);
    }
  }, [page]);
  const [orderSearch, setOrderSearch] = useState("");
  const [ordersPage, setOrdersPage] = useState(1);
  const [orderStatusDrafts, setOrderStatusDrafts] = useState<
    Record<string, FulfillmentStatus>
  >({});

  // Products state
  const [productModal, setProductModal] = useState<{
    mode: "add" | "edit";
    product?: Product;
  } | null>(null);
  const [productSuccess, setProductSuccess] = useState<{
    kicker: string;
    title: string;
    emphasis: string;
    message: string;
  } | null>(null);
  const [productCatFilter, setProductCatFilter] = useState("Todos");
  const [productSearch, setProductSearch] = useState("");
  const [productsPage, setProductsPage] = useState(1);
  const [usersPage, setUsersPage] = useState(1);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState<{
    ids: string[];
    title: string;
    description: string;
  } | null>(null);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [confirmUserDelete, setConfirmUserDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [confirmOrderStatus, setConfirmOrderStatus] = useState<{
    id: string;
    orderNumber: string;
    customerName: string;
    from: FulfillmentStatus;
    to: FulfillmentStatus;
  } | null>(null);

  useEffect(() => {
    localStorage.setItem("healthora_admin_page", page);
  }, [page]);

  const dashboardQuery = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: async () =>
      api.admin.dashboard(await getAdminToken()) as Promise<DashboardData>,
  });
  const ordersQuery = useQuery({
    queryKey: ["admin-orders"],
    queryFn: async () =>
      api.admin.orders(await getAdminToken()) as Promise<AdminOrder[]>,
    enabled: page === "orders",
  });

  const productsQuery = useQuery({
    queryKey: ["admin-products"],
    queryFn: async () => api.admin.products.list(await getAdminToken()),
    enabled: page === "products",
  });
  const productsCountQuery = useQuery({
    queryKey: ["admin-products-count"],
    queryFn: async () => api.admin.products.count(await getAdminToken()),
  });
  const usersQuery = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () =>
      api.admin.users(await getAdminToken()) as Promise<AdminUser[]>,
  });
  const salesQuery = useQuery({
    queryKey: ["admin-sales"],
    queryFn: async () =>
      api.admin.sales(await getAdminToken()) as Promise<SalesData>,
    enabled: page === "sales",
  });
  const earningsQuery = useQuery({
    queryKey: ["admin-earnings"],
    queryFn: async () =>
      api.admin.earnings(await getAdminToken()) as Promise<EarningsData>,
    enabled: page === "earnings",
  });

  const showOrdersSkeleton = useOnceLoading(
    "section_orders",
    ordersQuery.isLoading,
  );
  const showProductsSkeleton = useOnceLoading(
    "section_products",
    productsQuery.isLoading,
  );
  const showUsersSkeleton = useOnceLoading(
    `section_users_${usersPage}`,
    usersLoading,
  );
  const showSalesSkeleton = useOnceLoading(
    "section_sales",
    salesQuery.isLoading,
  );
  const showEarningsSkeleton = useOnceLoading(
    "section_earnings",
    earningsQuery.isLoading,
  );

  const orderStatusesMutation = useMutation({
    mutationFn: async ({
      id,
      paymentStatus,
      fulfillmentStatus,
    }: {
      id: string;
      paymentStatus?: PaymentStatus;
      fulfillmentStatus?: FulfillmentStatus;
    }) =>
      api.admin.patchOrderStatuses(
        id,
        { paymentStatus, fulfillmentStatus },
        await getAdminToken(),
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      void queryClient.invalidateQueries({
        queryKey: ["admin-dashboard"],
      });
      void queryClient.invalidateQueries({ queryKey: ["admin-sales"] });
      void queryClient.invalidateQueries({
        queryKey: ["admin-earnings"],
      });
    },
  });

  const invalidateProducts = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin-products"] });
    void queryClient.invalidateQueries({ queryKey: ["products"] });
    void queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] });
  };

  const productUpdateMutation = useMutation({
    mutationFn: async ({
      mongoId,
      data,
    }: {
      mongoId: string;
      data: Partial<Product>;
    }) => api.admin.products.update(mongoId, data, await getAdminToken()),
    onSuccess: (_, variables) => {
      invalidateProducts();
      setProductModal(null);
      setProductSuccess({
        kicker: "Producto actualizado",
        title: "Cambios",
        emphasis: "guardados",
        message: `${variables.data.name || "El producto"} se actualizó correctamente.`,
      });
    },
  });

  const productCreateMutation = useMutation({
    mutationFn: async (data: Partial<Product>) =>
      api.admin.products.create(data, await getAdminToken()),
    onSuccess: (_, data) => {
      invalidateProducts();
      setProductModal(null);
      setProductSuccess({
        kicker: "Producto creado",
        title: "Agregado al",
        emphasis: "catálogo",
        message: `${data.name || "El producto"} ya está disponible en la tienda.`,
      });
    },
  });

  const [deleteError, setDeleteError] = useState<string | null>(null);

  const productDeleteMutation = useMutation({
    mutationFn: async (mongoId: string) =>
      api.admin.products.remove(mongoId, await getAdminToken()),
    onSuccess: () => {
      invalidateProducts();
      setConfirmDeleteId(null);
      setDeleteError(null);
      setProductSuccess({
        kicker: "Producto eliminado",
        title: "Producto",
        emphasis: "eliminado",
        message: "El producto se eliminó del catálogo correctamente.",
      });
    },
    onError: (e: Error) => setDeleteError(e.message),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const token = await getAdminToken();
      await Promise.all(ids.map((id) => api.admin.products.remove(id, token)));
    },
    onSuccess: (_, ids) => {
      invalidateProducts();
      setSelectedProductIds((current) =>
        current.filter((id) => !ids.includes(id)),
      );
      setConfirmBulkDelete(null);
      setDeleteError(null);
      setProductSuccess({
        kicker: "Productos eliminados",
        title: `${ids.length} producto${ids.length > 1 ? "s" : ""}`,
        emphasis: "eliminado" + (ids.length > 1 ? "s" : ""),
        message: "Los productos se eliminaron del catálogo correctamente.",
      });
    },
    onError: (e: Error) => setDeleteError(e.message),
  });

  const deleteAllMutation = useMutation({
    mutationFn: async () => {
      const token = await getAdminToken();
      return api.admin.products.removeAll(token);
    },
    onSuccess: (data) => {
      invalidateProducts();
      void queryClient.invalidateQueries({ queryKey: ["categories"] });
      setSelectedProductIds([]);
      setConfirmDeleteAll(false);
      setProductSuccess({
        kicker: "Catálogo eliminado",
        title: `${data.deletedCount} productos`,
        emphasis: "eliminados",
        message: "Todo el catálogo de productos se ha eliminado correctamente.",
      });
    },
    onError: (e: Error) => setDeleteError(e.message),
  });

  const roleMutation = useMutation({
    mutationFn: async ({
      id,
      role,
    }: {
      id: string;
      role: "customer" | "admin";
    }) => api.admin.updateUserRole(id, role, await getAdminToken()),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      void queryClient.invalidateQueries({
        queryKey: ["admin-dashboard"],
      });
    },
  });

  const userDeleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const token = await getAdminToken();
      return fetch(`/api/admin/users/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      void queryClient.invalidateQueries({
        queryKey: ["admin-dashboard"],
      });
    },
  });

  const [showBackToTop, setShowBackToTop] = useState(false);
  useEffect(() => {
    if (page !== "products" && page !== "orders") {
      setShowBackToTop(false);
      return;
    }
    const onScroll = () => setShowBackToTop(window.scrollY > 400);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, [page]);

  const orders = ordersQuery.data || [];
  const products = productsQuery.data || [];
  const users = usersQuery.data || [];
  const customers = useMemo(
    () => users.filter((u) => u.role === "customer"),
    [users],
  );
  const sales = salesQuery.data;
  const earnings = earningsQuery.data;
  const dashboardData = dashboardQuery.data;

  const [dashboardReady, setDashboardReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setDashboardReady(true), 1800);
    return () => clearTimeout(t);
  }, []);
  const dashboard = dashboardData && dashboardReady ? dashboardData : undefined;

  useEffect(() => {
    setOrdersPage(1);
  }, [orderFulfillmentFilter, orderSearch]);

  useEffect(() => {
    setProductsPage(1);
  }, [productCatFilter, productSearch]);

  useEffect(() => {
    setUsersPage(1);
  }, [users.length]);

  useEffect(() => {
    if (page === "users") {
      usersQuery.refetch();
    }
  }, [page]);

  const sidebarCounts = useMemo(
    () => ({
      orders: dashboardData?.kpis.totalOrders ?? orders.length,
      products: productsCountQuery.data?.count ?? 0,
      users: customers.length,
    }),
    [dashboardData, orders.length, productsCountQuery.data, customers.length],
  );

  const STATIC_CATEGORIES = [
    "Vitaminas",
    "Cuidado personal",
    "Cuidado del bebé",
    "Suplementos",
    "Salud de la piel",
    "Fitness",
    "Medicamentos",
    "Hidratantes",
    "Fragancias",
    "Maquillaje",
  ];

  const categories = useMemo(() => {
    const fromProducts =
      products.length > 0
        ? [...new Set(products.map((p) => p.category))].sort()
        : [];
    const allCategories = new Set([...STATIC_CATEGORIES, ...fromProducts]);
    return Array.from(allCategories).sort();
  }, [products]);

  const displayedProducts = useMemo(() => {
    return (products as Product[]).filter((p) => {
      const matchCat =
        productCatFilter === "Todos" || p.category === productCatFilter;
      const term = productSearch.toLowerCase();
      const matchSearch =
        !term ||
        p.name.toLowerCase().includes(term) ||
        p.brand.toLowerCase().includes(term);
      return matchCat && matchSearch;
    });
  }, [products, productCatFilter, productSearch]);

  const displayedOrders = useMemo(() => {
    const term = orderSearch.toLowerCase();
    return (orders || []).filter((o) => {
      const matchSearch =
        !term ||
        o._id.toLowerCase().includes(term) ||
        o.customerName?.toLowerCase().includes(term) ||
        o.customerEmail?.toLowerCase().includes(term);
      const matchFulfillment =
        !orderFulfillmentFilter ||
        o.fulfillmentStatus === orderFulfillmentFilter;
      return matchSearch && matchFulfillment;
    });
  }, [orders, orderSearch, orderFulfillmentFilter]);

  const paginatedOrders = useMemo(
    () => paginateItems(displayedOrders, ordersPage),
    [displayedOrders, ordersPage],
  );

  const paginatedProducts = useMemo(
    () => paginateItems(displayedProducts, productsPage),
    [displayedProducts, productsPage],
  );

  const paginatedUsers = useMemo(
    () => paginateItems(customers, usersPage),
    [customers, usersPage],
  );

  const displayedProductIds = useMemo(
    () => paginatedProducts.items.map((product) => product._id || product.id),
    [paginatedProducts.items],
  );
  const selectedDisplayedIds = useMemo(
    () => selectedProductIds.filter((id) => displayedProductIds.includes(id)),
    [selectedProductIds, displayedProductIds],
  );
  const allDisplayedSelected =
    displayedProductIds.length > 0 &&
    selectedDisplayedIds.length === displayedProductIds.length;

  const isSaving =
    productUpdateMutation.isPending || productCreateMutation.isPending;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: isSmall ? "1fr" : "240px 1fr",
        minHeight: "100vh",
        background: "var(--cream-2)",
      }}
    >
      {/* Mobile top bar */}
      {isSmall && (
        <div style={{ position: "sticky", top: 0, zIndex: 50, background: "var(--cream)", borderBottom: "1px solid var(--ink-06)", padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 26, height: 26, borderRadius: 999, background: "var(--green)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--lime)", fontFamily: '"Instrument Serif", serif', fontSize: 16 }}>h</div>
            <span style={{ fontFamily: '"Instrument Serif", serif', fontSize: 20, letterSpacing: "-0.02em" }}>Admin</span>
          </div>
          <button onClick={() => setSidebarOpen(true)} style={{ background: "transparent", border: "1px solid var(--ink-06)", borderRadius: 999, padding: "6px 10px", cursor: "pointer", display: "flex", alignItems: "center", color: "var(--ink)" }}>
            <Icon name="menu" size={18} />
          </button>
        </div>
      )}

      {/* Sidebar — always visible on desktop, drawer on mobile/tablet */}
      {!isSmall && (
        <Sidebar
          page={page}
          setPage={setPage}
          onGoToStore={onGoToStore}
          counts={sidebarCounts}
          adminName={access.name}
          adminEmail={access.email}
          adminPhoto={user?.imageUrl}
        />
      )}

      {/* Mobile sidebar drawer */}
      {isSmall && sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 200 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "80%", maxWidth: 280 }}>
            <Sidebar
              page={page}
              setPage={(p) => { setPage(p); setSidebarOpen(false); }}
              onGoToStore={() => { setSidebarOpen(false); onGoToStore(); }}
              counts={sidebarCounts}
              adminName={access.name}
              adminEmail={access.email}
              adminPhoto={user?.imageUrl}
            />
          </div>
        </div>
      )}

      <div style={{ padding: isMobile ? "20px 16px 60px" : isTablet ? "28px 28px 60px" : "36px 48px 80px", overflow: "auto" }}>
        {/* ── Dashboard ── */}
        {page === "dashboard" && (
          <>
            <PageHeader
              loading={!dashboard}
              kicker="Panel de administración"
              title={
                <>
                  Dashboard <em style={{ color: "var(--green)" }}>Healthora</em>
                </>
              }
              sub="Resumen en vivo de ventas, órdenes, usuarios e inventario."
            />
            <div
              style={{
                display: "grid",
                gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : isTablet ? "repeat(2, 1fr)" : "repeat(4, 1fr)",
                gap: isMobile ? 12 : 16,
                marginBottom: 24,
              }}
            >
              <KpiCard
                mode="dark"
                label="Ingresos mes"
                value={
                  dashboard
                    ? `$${dashboard.kpis.revenue.toLocaleString()}`
                    : "—"
                }
                delta={dashboard?.kpis.revenueDelta}
                sub="vs mes anterior"
                loading={!dashboard}
                animKey="revenue"
              />
              <KpiCard
                label="Órdenes mes"
                value={dashboard?.kpis.monthOrders ?? "—"}
                sub="pagadas o en curso"
                loading={!dashboard}
                animKey="orders"
              />
              <KpiCard
                label="Clientes"
                value={customers.length ?? "—"}
                sub="clientes registrados"
                loading={!dashboard}
                animKey="users"
              />
              <KpiCard
                label="Existencias bajas"
                value={dashboard?.kpis.lowStock ?? "—"}
                sub="productos con 5 unidades o menos"
                loading={!dashboard}
                animKey="lowstock"
              />
            </div>

            {/* Revenue chart card */}
            <Card
              title="Ingresos · últimos 30 días"
              sub="Ingresos diarios, en USD"
              loading={!dashboard}
              skeletonContent={<Skeleton height={240} borderRadius={8} />}
            >
              {(dashboard?.dailySales?.length ?? 0) > 0 ? (
                <LineChart data={dashboard?.dailySales} height={240} />
              ) : (
                <Skeleton height={240} borderRadius={8} />
              )}
            </Card>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: isSmall ? "1fr" : "1.2fr 1fr",
                gap: 20,
                marginTop: 24,
              }}
            >
              {/* Recent orders */}
              <Card
                title="Pedidos recientes"
                sub="Últimas 5 órdenes del ecommerce"
                loading={dashboard === undefined}
                skeletonContent={
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                    }}
                  >
                    {[0, 1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 14,
                          padding: "14px 0",
                          borderBottom: "1px solid var(--ink-06)",
                        }}
                      >
                        <Skeleton height={13} width="16%" borderRadius={4} />
                        <div style={{ flex: 1 }}>
                          <Skeleton height={13} width="65%" borderRadius={4} />
                          <div style={{ marginTop: 6 }}>
                            <Skeleton
                              height={10}
                              width="55%"
                              borderRadius={4}
                            />
                          </div>
                        </div>
                        <Skeleton height={18} width="13%" borderRadius={4} />
                        <Skeleton height={22} width={58} borderRadius={999} />
                      </div>
                    ))}
                  </div>
                }
              >
                {dashboard?.recentOrders?.length ? (
                  <div style={{ overflowX: 'auto', width: '100%' }}>
                  <table style={{ ...tableStyle, minWidth: 420 }}>
                    <thead>
                      <tr>
                        <th style={th}>Orden</th>
                        <th style={th}>Cliente</th>
                        <th style={th}>Total</th>
                        <th style={th}>Pago</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(dashboard?.recentOrders || []).map((order) => (
                        <tr key={order._id} style={trStyle}>
                          <td
                            style={{
                              ...td,
                              fontFamily: '"JetBrains Mono", monospace',
                            }}
                          >
                            {order._id.slice(-8).toUpperCase()}
                          </td>
                          <td style={td}>
                            <div
                              style={{
                                fontWeight: 500,
                              }}
                            >
                              {order.customerName || "Cliente"}
                            </div>
                            <div
                              style={{
                                fontSize: 11,
                                color: "var(--ink-60)",
                              }}
                            >
                              {order.customerEmail}
                            </div>
                          </td>
                          <td
                            style={{
                              ...td,
                              fontFamily: '"Instrument Serif", serif',
                              fontSize: 18,
                            }}
                          >
                            ${(order.total || 0).toFixed(2)}
                          </td>
                          <td style={td}>
                            <StatusPill
                              status={
                                order.paymentStatus === "paid"
                                  ? "Pagado"
                                  : order.paymentStatus === "cancelled"
                                    ? "Cancelado"
                                    : order.paymentStatus === "refunded"
                                      ? "Reembolsado"
                                      : "Pendiente"
                              }
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                ) : (
                  <div
                    style={{
                      fontSize: 14,
                      color: "var(--ink-60)",
                    }}
                  >
                    No hay pedidos recientes.
                  </div>
                )}
              </Card>

              {/* Low stock */}
              <Card
                title="Inventario crítico"
                sub="Productos que requieren reposición"
                loading={dashboard === undefined}
                skeletonContent={
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 14,
                    }}
                  >
                    {[0, 1, 2, 3].map((i) => (
                      <div
                        key={i}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                        }}
                      >
                        <Skeleton height={72} width={60} borderRadius={10} />
                        <div style={{ flex: 1 }}>
                          <Skeleton height={13} width="65%" borderRadius={4} />
                          <div style={{ marginTop: 7 }}>
                            <Skeleton
                              height={11}
                              width="42%"
                              borderRadius={4}
                            />
                          </div>
                        </div>
                        <Skeleton height={22} width={54} borderRadius={999} />
                      </div>
                    ))}
                  </div>
                }
              >
                {dashboard?.lowStockProducts?.length ? (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 12,
                    }}
                  >
                    {(dashboard?.lowStockProducts || []).map((product) => (
                      <div
                        key={product.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                        }}
                      >
                        <div
                          style={{
                            width: 60,
                            height: 72,
                            borderRadius: 10,
                            overflow: "hidden",
                            border: "1px solid var(--ink-06)",
                            flexShrink: 0,
                          }}
                        >
                          <ProductImage product={product} size="xs" />
                        </div>
                        <div style={{ flex: 1 }}>
                          <div
                            style={{
                              fontSize: 13,
                              fontWeight: 500,
                            }}
                          >
                            {product.name}
                          </div>
                          <div
                            style={{
                              fontSize: 11,
                              color: "var(--ink-60)",
                            }}
                          >
                            {product.brand}
                          </div>
                        </div>
                        <StatusPill status={`${product.stock} uds`} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div
                    style={{
                      fontSize: 14,
                      color: "var(--ink-60)",
                    }}
                  >
                    No hay productos con existencias críticas.
                  </div>
                )}
              </Card>
            </div>
          </>
        )}

        {/* ── Orders ── */}
        {page === "orders" && (
          <>
            <PageHeader
              loading={showOrdersSkeleton}
              kicker="Pedidos"
              title={
                <>
                  Gestión de <em style={{ color: "var(--green)" }}>pedidos</em>
                </>
              }
              sub="Cambia estados y monitorea el ciclo completo de la orden."
            />
            {showOrdersSkeleton ? (
              <div
                style={{
                  display: "flex",
                  gap: 12,
                  marginBottom: 20,
                  alignItems: "center",
                }}
              >
                <Skeleton height={36} width={296} borderRadius={999} />
                {[100, 80, 90, 72, 86, 78].map((w, i) => (
                  <Skeleton key={i} height={32} width={w} borderRadius={999} />
                ))}
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  gap: 12,
                  marginBottom: 20,
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    background: "var(--cream)",
                    borderRadius: 999,
                    padding: "9px 16px",
                    border: "1px solid var(--ink-06)",
                    flexShrink: 0,
                    width: 296,
                    boxSizing: "border-box",
                  }}
                >
                  <Icon name="search" size={14} stroke="var(--ink-40)" />
                  <input
                    value={orderSearch}
                    onChange={(e) => setOrderSearch(e.target.value)}
                    placeholder="Buscar por ID, cliente o email…"
                    style={{
                      border: "none",
                      outline: "none",
                      background: "transparent",
                      fontSize: 13,
                      fontFamily: '"Geist", sans-serif',
                      width: "100%",
                      color: "var(--ink)",
                    }}
                  />
                  {orderSearch && (
                    <button
                      onClick={() => setOrderSearch("")}
                      style={{
                        border: "none",
                        background: "transparent",
                        cursor: "pointer",
                        padding: "2px 4px",
                        display: "flex",
                        alignItems: "center",
                        color: "var(--ink-40)",
                        borderRadius: 4,
                        flexShrink: 0,
                      }}
                    >
                      <Icon name="x" size={13} />
                    </button>
                  )}
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: 6,
                    flexWrap: "wrap",
                  }}
                >
                  {fulfillmentStatusOptions.map((status) => (
                    <button
                      key={status}
                      onClick={() => setOrderFulfillmentFilter(status)}
                      style={{
                        padding: "7px 14px",
                        borderRadius: 999,
                        fontSize: 12,
                        cursor: "pointer",
                        border:
                          "1px solid " +
                          (orderFulfillmentFilter === status
                            ? "var(--ink)"
                            : "var(--ink-20)"),
                        background:
                          orderFulfillmentFilter === status
                            ? "var(--ink)"
                            : "transparent",
                        color:
                          orderFulfillmentFilter === status
                            ? "var(--cream)"
                            : "var(--ink)",
                        fontFamily: '"Geist", sans-serif',
                      }}
                    >
                      {fulfillmentStatusLabels[status]}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <Card
              pad={0}
              loading={showOrdersSkeleton}
              skeletonContent={
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <div
                    style={{
                      padding: "14px 24px",
                      borderBottom: "1px solid var(--ink-06)",
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                    <Skeleton height={12} width={110} borderRadius={4} />
                  </div>
                  {/* Column headers */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 16,
                      padding: "12px 24px",
                      borderBottom: "1px solid var(--ink-06)",
                    }}
                  >
                    <div style={{ flexShrink: 0, width: 78 }}>
                      <Skeleton height={9} width={44} borderRadius={3} />
                    </div>
                    <div style={{ flex: 1.8 }}>
                      <Skeleton height={9} width={88} borderRadius={3} />
                    </div>
                    <div style={{ flex: 1.2 }}>
                      <Skeleton height={9} width={62} borderRadius={3} />
                    </div>
                    <div style={{ flexShrink: 0, width: 54 }}>
                      <Skeleton height={9} width={38} borderRadius={3} />
                    </div>
                    <div style={{ flexShrink: 0, width: 72 }}>
                      <Skeleton height={9} width={34} borderRadius={3} />
                    </div>
                    <div style={{ flexShrink: 0, width: 202 }}>
                      <Skeleton height={9} width={48} borderRadius={3} />
                    </div>
                    <div style={{ flexShrink: 0, width: 80 }}>
                      <Skeleton height={9} width={82} borderRadius={3} />
                    </div>
                  </div>
                  {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 16,
                        padding: "14px 24px",
                        borderBottom: "1px solid var(--ink-06)",
                      }}
                    >
                      {/* Orden ID */}
                      <Skeleton
                        height={11}
                        width={78}
                        borderRadius={4}
                        style={{ flexShrink: 0 }}
                      />
                      {/* Cliente / Envío: nombre + email + 2-line dirección */}
                      <div
                        style={{
                          flex: 1.8,
                          display: "flex",
                          flexDirection: "column",
                          gap: 4,
                        }}
                      >
                        <Skeleton height={13} width="65%" borderRadius={4} />
                        <Skeleton height={10} width="52%" borderRadius={4} />
                        <div
                          style={{
                            marginTop: 4,
                            display: "flex",
                            flexDirection: "column",
                            gap: 3,
                          }}
                        >
                          <Skeleton height={10} width="76%" borderRadius={4} />
                          <Skeleton height={10} width="60%" borderRadius={4} />
                        </div>
                      </div>
                      {/* Productos: count label + 2 items */}
                      <div
                        style={{
                          flex: 1.2,
                          display: "flex",
                          flexDirection: "column",
                          gap: 4,
                        }}
                      >
                        <Skeleton height={10} width="38%" borderRadius={4} />
                        <Skeleton height={11} width="90%" borderRadius={4} />
                        <Skeleton height={11} width="74%" borderRadius={4} />
                      </div>
                      {/* Total: serif 18px */}
                      <Skeleton
                        height={18}
                        width={54}
                        borderRadius={4}
                        style={{ flexShrink: 0 }}
                      />
                      {/* Pago: pill */}
                      <Skeleton
                        height={22}
                        width={72}
                        borderRadius={999}
                        style={{ flexShrink: 0 }}
                      />
                      {/* Estado: pill + select dropdown */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          flexShrink: 0,
                        }}
                      >
                        <Skeleton height={22} width={86} borderRadius={999} />
                        <Skeleton height={32} width={108} borderRadius={8} />
                      </div>
                      {/* Fecha y hora: 2 lines */}
                      <div
                        style={{
                          flexShrink: 0,
                          display: "flex",
                          flexDirection: "column",
                          gap: 4,
                        }}
                      >
                        <Skeleton height={11} width={68} borderRadius={4} />
                        <Skeleton height={11} width={50} borderRadius={4} />
                      </div>
                    </div>
                  ))}
                </div>
              }
            >
              <div
                style={{
                  padding: "16px 24px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  borderBottom: "1px solid var(--ink-06)",
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    fontFamily: '"Geist", sans-serif',
                    color: "var(--ink-60)",
                  }}
                >
                  {orderSearch
                    ? `${displayedOrders.length} resultado${displayedOrders.length !== 1 ? "s" : ""} de ${orders?.length || 0}`
                    : `${displayedOrders.length} pedido${displayedOrders.length !== 1 ? "s" : ""}`}
                </div>
              </div>
              <div style={{ overflowX: 'auto', width: '100%' }}>
              <table style={{ ...tableStyle, minWidth: 680 }}>
                <thead>
                  <tr>
                    <th style={th}>Orden</th>
                    <th style={th}>Cliente / Envío</th>
                    <th style={th}>Productos</th>
                    <th style={th}>Total</th>
                    <th style={th}>Pago</th>
                    <th style={th}>Estado</th>
                    <th style={th}>Fecha y hora</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedOrders.items.map((order) => (
                    <tr key={order._id} style={trStyle}>
                      <td
                        style={{
                          ...td,
                          fontFamily: '"JetBrains Mono", monospace',
                        }}
                      >
                        {order._id.slice(-8).toUpperCase()}
                      </td>
                      <td style={td}>
                        <div style={{ fontWeight: 500 }}>
                          {order.customerName}
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            color: "var(--ink-60)",
                          }}
                        >
                          {order.customerEmail}
                        </div>
                        {order.address && (
                          <div
                            style={{
                              marginTop: 8,
                              fontSize: 12,
                              color: "var(--ink-60)",
                              lineHeight: 1.45,
                            }}
                          >
                            {order.address.name} · {order.address.phone}
                            <br />
                            {order.address.address}, {order.address.city} ·{" "}
                            {order.address.postal}
                          </div>
                        )}
                      </td>
                      <td style={td}>
                        <div
                          style={{
                            fontSize: 11,
                            fontFamily: '"JetBrains Mono", monospace',
                            color: "var(--ink-60)",
                            marginBottom: 6,
                          }}
                        >
                          {order.items?.length ?? 0} producto(s)
                        </div>
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 4,
                          }}
                        >
                          {(order.items || []).map((item) => (
                            <div
                              key={`${order._id}-${item.productId}`}
                              style={{
                                fontSize: 12,
                                lineHeight: 1.4,
                              }}
                            >
                              <strong>{item.qty}x</strong> {item.productName}
                            </div>
                          ))}
                        </div>
                      </td>
                      <td
                        style={{
                          ...td,
                          fontFamily: '"Instrument Serif", serif',
                          fontSize: 18,
                        }}
                      >
                        ${(order.total || 0).toFixed(2)}
                      </td>
                      <td style={td}>
                        <StatusPill
                          status={
                            order.paymentStatus === "paid"
                              ? "Pagado"
                              : order.paymentStatus === "cancelled"
                                ? "Cancelado"
                                : order.paymentStatus === "refunded"
                                  ? "Reembolsado"
                                  : "Pendiente"
                          }
                        />
                      </td>
                      <td style={td}>
                        <div
                          style={{
                            display: "flex",
                            gap: 8,
                            alignItems: "center",
                          }}
                        >
                          <StatusPill
                            status={
                              fulfillmentStatusLabels[
                                order.fulfillmentStatus || "unfulfilled"
                              ]
                            }
                          />
                          {!["cancelled", "delivered"].includes(
                            order.fulfillmentStatus || "unfulfilled",
                          ) && (
                            <>
                              <select
                                value={
                                  orderStatusDrafts[order._id] ||
                                  order.fulfillmentStatus ||
                                  "unfulfilled"
                                }
                                onChange={(e) => {
                                  const nextStatus = e.target
                                    .value as FulfillmentStatus;
                                  setOrderStatusDrafts((current) => ({
                                    ...current,
                                    [order._id]: nextStatus,
                                  }));
                                }}
                                style={{
                                  padding: "8px 10px",
                                  borderRadius: 8,
                                  border: "1px solid var(--ink-20)",
                                  background: "var(--cream-2)",
                                  color: "var(--ink)",
                                  fontSize: 12,
                                }}
                              >
                                {fulfillmentStatusOptions
                                  .filter(Boolean)
                                  .map((s) => (
                                    <option key={s} value={s}>
                                      {fulfillmentStatusLabels[s]}
                                    </option>
                                  ))}
                              </select>
                              {orderStatusDrafts[order._id] &&
                                orderStatusDrafts[order._id] !==
                                  (order.fulfillmentStatus ||
                                    "unfulfilled") && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const currentStatus =
                                        order.fulfillmentStatus ||
                                        "unfulfilled";
                                      setConfirmOrderStatus({
                                        id: order._id,
                                        orderNumber: order._id
                                          .slice(-8)
                                          .toUpperCase(),
                                        customerName:
                                          order.customerName || "Cliente",
                                        from: currentStatus,
                                        to: orderStatusDrafts[order._id],
                                      });
                                    }}
                                    style={{
                                      border: "1px solid var(--ink)",
                                      borderRadius: 999,
                                      background: "var(--ink)",
                                      color: "var(--cream)",
                                      fontSize: 11,
                                      fontWeight: 700,
                                      padding: "8px 12px",
                                      cursor: "pointer",
                                    }}
                                  >
                                    Guardar
                                  </button>
                                )}
                            </>
                          )}
                        </div>
                      </td>
                      <td
                        style={{
                          ...td,
                          fontSize: 11,
                          color: "var(--ink-60)",
                          fontFamily: '"JetBrains Mono", monospace',
                        }}
                      >
                        {order.createdAt ? (
                          <>
                            <div>
                              {new Date(order.createdAt).toLocaleDateString()}
                            </div>
                            <div
                              style={{
                                marginTop: 4,
                              }}
                            >
                              {new Date(order.createdAt).toLocaleTimeString(
                                [],
                                {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                },
                              )}
                            </div>
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
              <PaginationControls
                page={paginatedOrders.page}
                totalPages={paginatedOrders.totalPages}
                totalItems={displayedOrders.length}
                start={paginatedOrders.start}
                end={paginatedOrders.end}
                onPageChange={setOrdersPage}
              />
            </Card>
          </>
        )}

        {confirmOrderStatus && (
          <div
            onClick={() => setConfirmOrderStatus(null)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(17, 24, 20, 0.28)",
              zIndex: 113,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 24,
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                width: "100%",
                maxWidth: 460,
                background: "var(--cream)",
                border: "1px solid var(--ink-06)",
                borderRadius: 24,
                boxShadow: "0 28px 80px -36px rgba(0,0,0,0.32)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  padding: "22px 24px 18px",
                  borderBottom: "1px solid var(--ink-06)",
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    fontFamily: '"JetBrains Mono", monospace',
                    textTransform: "uppercase",
                    letterSpacing: "0.12em",
                    color: "var(--ink-60)",
                    marginBottom: 8,
                  }}
                >
                  Confirmar estado
                </div>
                <div
                  style={{
                    fontFamily: '"Instrument Serif", serif',
                    fontSize: 32,
                    lineHeight: 1,
                    letterSpacing: "-0.03em",
                    color: "var(--ink)",
                  }}
                >
                  Actualizar{" "}
                  <em
                    style={{
                      color: "oklch(0.52 0.12 145)",
                    }}
                  >
                    pedido
                  </em>
                </div>
                <p
                  style={{
                    margin: "12px 0 0",
                    fontSize: 14,
                    lineHeight: 1.55,
                    color: "var(--ink-80)",
                    fontFamily: '"Geist", sans-serif',
                  }}
                >
                  Vas a cambiar el pedido #{confirmOrderStatus.orderNumber} de{" "}
                  <strong>
                    {fulfillmentStatusLabels[confirmOrderStatus.from]}
                  </strong>{" "}
                  a{" "}
                  <strong>
                    {fulfillmentStatusLabels[confirmOrderStatus.to]}
                  </strong>
                  . El cliente {confirmOrderStatus.customerName} recibirá un
                  email de actualización.
                </p>
              </div>
              <div
                style={{
                  padding: 24,
                  display: "flex",
                  gap: 10,
                  justifyContent: "flex-end",
                  background: "var(--cream-2)",
                }}
              >
                <AnimatedButton variant="outline" onClick={() => setConfirmOrderStatus(null)} disabled={orderStatusesMutation.isPending} text="Cancelar" />
                <AnimatedButton
                  variant="primary"
                  onClick={() => {
                    const nextStatus = confirmOrderStatus;
                    orderStatusesMutation.mutate(
                      { id: nextStatus.id, fulfillmentStatus: nextStatus.to },
                      {
                        onSuccess: () => {
                          setOrderStatusDrafts((current) => {
                            const next = { ...current };
                            delete next[nextStatus.id];
                            return next;
                          });
                          setConfirmOrderStatus(null);
                        },
                      },
                    );
                  }}
                  disabled={orderStatusesMutation.isPending}
                  text={orderStatusesMutation.isPending ? "Guardando..." : "Guardar cambio"}
                />
              </div>
            </div>
          </div>
        )}

        {productSuccess && (
          <div
            onClick={() => setProductSuccess(null)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(17, 24, 20, 0.28)",
              zIndex: 114,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 24,
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                width: "100%",
                maxWidth: 430,
                background: "var(--cream)",
                border: "1px solid var(--ink-06)",
                borderRadius: 24,
                boxShadow: "0 28px 80px -36px rgba(0,0,0,0.32)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  padding: "26px 26px 22px",
                  borderBottom: "1px solid var(--ink-06)",
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 999,
                    background: "var(--green)",
                    color: "var(--cream)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 18,
                  }}
                >
                  <Icon name="check" size={20} />
                </div>
                <div
                  style={{
                    fontSize: 10,
                    fontFamily: '"JetBrains Mono", monospace',
                    textTransform: "uppercase",
                    letterSpacing: "0.12em",
                    color: "var(--ink-60)",
                    marginBottom: 8,
                  }}
                >
                  {productSuccess.kicker}
                </div>
                <div
                  style={{
                    fontFamily: '"Instrument Serif", serif',
                    fontSize: 32,
                    lineHeight: 1,
                    letterSpacing: "-0.03em",
                    color: "var(--ink)",
                  }}
                >
                  {productSuccess.title}{" "}
                  <em style={{ color: "var(--green)" }}>
                    {productSuccess.emphasis}
                  </em>
                </div>
                <p
                  style={{
                    margin: "12px 0 0",
                    fontSize: 14,
                    lineHeight: 1.55,
                    color: "var(--ink-80)",
                    fontFamily: '"Geist", sans-serif',
                  }}
                >
                  {productSuccess.message}
                </p>
              </div>
              <div
                style={{
                  padding: 24,
                  display: "flex",
                  justifyContent: "flex-end",
                  background: "var(--cream-2)",
                }}
              >
                <AnimatedButton variant="primary" onClick={() => setProductSuccess(null)} text="Entendido" />
              </div>
            </div>
          </div>
        )}

        {/* ── Products ── */}
        {page === "products" && (
          <>
            <PageHeader
              loading={showProductsSkeleton}
              kicker={
                showProductsSkeleton
                  ? undefined
                  : `Catálogo · ${products.length} productos`
              }
              title={
                <>
                  Gestión de{" "}
                  <em style={{ color: "var(--green)" }}>productos</em>
                </>
              }
              sub="Agrega, edita, elimina y filtra el catálogo completo."
              actions={
                showProductsSkeleton ? (
                  <Skeleton height={40} width={152} borderRadius={999} />
                ) : (
                  <AnimatedButton variant="primary" onClick={() => setProductModal({ mode: "add" })} text="+ Agregar producto" />
                )
              }
            />

            {/* Filter bar */}
            {showProductsSkeleton ? (
              <div
                style={{
                  display: "flex",
                  gap: 12,
                  marginBottom: 20,
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <Skeleton height={36} width={296} borderRadius={999} />
                {[74, 88, 80, 68, 76, 84, 70, 78, 74, 66].map((w, i) => (
                  <Skeleton key={i} height={32} width={w} borderRadius={999} />
                ))}
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  gap: 12,
                  marginBottom: 20,
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    background: "var(--cream)",
                    borderRadius: 999,
                    padding: "9px 16px",
                    border: "1px solid var(--ink-06)",
                    flexShrink: 0,
                    width: 296,
                    boxSizing: "border-box",
                  }}
                >
                  <Icon name="search" size={14} stroke="var(--ink-40)" />
                  <input
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder="Buscar por nombre o marca…"
                    style={{
                      border: "none",
                      outline: "none",
                      background: "transparent",
                      fontSize: 13,
                      fontFamily: '"Geist", sans-serif',
                      width: "100%",
                      color: "var(--ink)",
                    }}
                  />
                  {productSearch && (
                    <button
                      onClick={() => setProductSearch("")}
                      style={{
                        border: "none",
                        background: "transparent",
                        cursor: "pointer",
                        padding: "2px 4px",
                        display: "flex",
                        alignItems: "center",
                        color: "var(--ink-40)",
                        borderRadius: 4,
                        flexShrink: 0,
                      }}
                    >
                      <Icon name="x" size={13} />
                    </button>
                  )}
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: 6,
                    flexWrap: "wrap",
                  }}
                >
                  {["Todos", ...categories].map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setProductCatFilter(cat)}
                      style={{
                        padding: "7px 14px",
                        borderRadius: 999,
                        fontSize: 12,
                        cursor: "pointer",
                        border:
                          "1px solid " +
                          (productCatFilter === cat
                            ? "var(--ink)"
                            : "var(--ink-20)"),
                        background:
                          productCatFilter === cat
                            ? "var(--ink)"
                            : "transparent",
                        color:
                          productCatFilter === cat
                            ? "var(--cream)"
                            : "var(--ink)",
                        fontFamily: '"Geist", sans-serif',
                        transition: "all 120ms",
                      }}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {showProductsSkeleton ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  marginBottom: 16,
                }}
              >
                <Skeleton height={12} width={248} borderRadius={4} />
                <div style={{ display: "flex", gap: 8 }}>
                  <Skeleton height={32} width={126} borderRadius={999} />
                  <Skeleton height={32} width={158} borderRadius={999} />
                </div>
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  marginBottom: 16,
                  flexWrap: "wrap",
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    fontFamily: '"Geist", sans-serif',
                    color: "var(--ink-60)",
                  }}
                >
                  {selectedDisplayedIds.length > 0
                    ? `${selectedDisplayedIds.length} seleccionados en esta vista`
                    : "Selecciona varios productos para borrado masivo."}
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    flexWrap: "wrap",
                  }}
                >
                  <AnimatedButton
                    variant="outline"
                    onClick={() => setSelectedProductIds((current) => current.filter((id) => !displayedProductIds.includes(id)))}
                    disabled={selectedDisplayedIds.length === 0}
                    text="Limpiar selección"
                  />
                  <AnimatedButton
                    variant="outline"
                    onClick={() => setConfirmBulkDelete({ ids: selectedDisplayedIds, title: "Eliminar seleccionados", description: `Se eliminarán ${selectedDisplayedIds.length} productos seleccionados de esta vista.` })}
                    disabled={selectedDisplayedIds.length === 0}
                    style={{ color: "oklch(0.5 0.15 30)", borderColor: "oklch(0.85 0.08 30)" }}
                    text="Eliminar seleccionados"
                  />
                  <AnimatedButton
                    variant="outline"
                    onClick={() => setConfirmDeleteAll(true)}
                    style={{ color: "var(--coral)", borderColor: "oklch(0.85 0.08 30)" }}
                    text="Eliminar todo"
                  />
                </div>
              </div>
            )}

            <Card
              pad={0}
              loading={showProductsSkeleton}
              skeletonContent={
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {/* Column headers */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "12px 24px",
                      borderBottom: "1px solid var(--ink-06)",
                    }}
                  >
                    <div style={{ width: 52, flexShrink: 0 }} />
                    <div style={{ flex: 2 }}>
                      <Skeleton height={9} width={58} borderRadius={3} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <Skeleton height={9} width={66} borderRadius={3} />
                    </div>
                    <div style={{ flex: 0.8 }}>
                      <Skeleton height={9} width={44} borderRadius={3} />
                    </div>
                    <div style={{ flex: 0.6 }}>
                      <Skeleton height={9} width={38} borderRadius={3} />
                    </div>
                    <div style={{ flex: 0.8 }}>
                      <Skeleton height={9} width={46} borderRadius={3} />
                    </div>
                    <div style={{ width: 66, flexShrink: 0 }} />
                  </div>
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map((i) => (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "12px 24px",
                        borderBottom: "1px solid var(--ink-06)",
                      }}
                    >
                      {/* Checkbox */}
                      <div
                        style={{
                          width: 52,
                          display: "flex",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        <Skeleton height={16} width={16} borderRadius={3} />
                      </div>
                      {/* Producto: image 60×72 + name + brand */}
                      <div
                        style={{
                          flex: 2,
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                        }}
                      >
                        <Skeleton
                          height={72}
                          width={60}
                          borderRadius={8}
                          style={{ flexShrink: 0 }}
                        />
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 5,
                          }}
                        >
                          <Skeleton height={13} width={110} borderRadius={4} />
                          <Skeleton height={10} width={80} borderRadius={4} />
                        </div>
                      </div>
                      {/* Categoría: plain text */}
                      <div style={{ flex: 1 }}>
                        <Skeleton height={11} width={72} borderRadius={4} />
                      </div>
                      {/* Precio: serif price + strikethrough */}
                      <div
                        style={{
                          flex: 0.8,
                          display: "flex",
                          flexDirection: "column",
                          gap: 4,
                        }}
                      >
                        <Skeleton height={18} width={58} borderRadius={4} />
                        <Skeleton height={10} width={42} borderRadius={4} />
                      </div>
                      {/* Stock */}
                      <div style={{ flex: 0.6 }}>
                        <Skeleton height={13} width={30} borderRadius={4} />
                      </div>
                      {/* Estado: pill */}
                      <div style={{ flex: 0.8 }}>
                        <Skeleton height={22} width={62} borderRadius={999} />
                      </div>
                      {/* Actions: 2 icon buttons 30×30 */}
                      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                        <Skeleton height={30} width={30} borderRadius={8} />
                        <Skeleton height={30} width={30} borderRadius={8} />
                      </div>
                    </div>
                  ))}
                </div>
              }
            >
              <div style={{ overflowX: 'auto', width: '100%' }}>
              <table style={{ ...tableStyle, minWidth: 600 }}>
                <thead>
                  <tr>
                    <th style={{ ...th, width: 52 }}>
                      <input
                        type="checkbox"
                        checked={allDisplayedSelected}
                        onChange={(e) =>
                          setSelectedProductIds((current) =>
                            e.target.checked
                              ? Array.from(
                                  new Set([...current, ...displayedProductIds]),
                                )
                              : current.filter(
                                  (id) => !displayedProductIds.includes(id),
                                ),
                          )
                        }
                        aria-label="Seleccionar productos visibles"
                        style={{
                          width: 16,
                          height: 16,
                          accentColor: "var(--green)",
                          cursor: "pointer",
                        }}
                      />
                    </th>
                    <th style={th}>Producto</th>
                    <th style={th}>Categoría</th>
                    <th style={th}>Precio</th>
                    <th style={th}>Stock</th>
                    <th style={th}>Estado</th>
                    <th style={th}></th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedProducts.items.map((product) => (
                    <tr key={product.id} style={trStyle}>
                      <td style={{ ...td, width: 52 }}>
                        <input
                          type="checkbox"
                          checked={selectedProductIds.includes(
                            product._id || product.id,
                          )}
                          onChange={(e) => {
                            const nextId = product._id || product.id;
                            setSelectedProductIds((current) =>
                              e.target.checked
                                ? [...current, nextId]
                                : current.filter((id) => id !== nextId),
                            );
                          }}
                          aria-label={`Seleccionar ${product.name}`}
                          style={{
                            width: 16,
                            height: 16,
                            accentColor: "var(--green)",
                            cursor: "pointer",
                          }}
                        />
                      </td>
                      <td style={td}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 12,
                          }}
                        >
                          <div
                            style={{
                              width: 60,
                              height: 72,
                              borderRadius: 8,
                              overflow: "hidden",
                              border: "1px solid var(--ink-06)",
                              flexShrink: 0,
                            }}
                          >
                            <ProductImage product={product} size="xs" />
                          </div>
                          <div>
                            <div
                              style={{
                                fontSize: 13,
                                fontWeight: 500,
                              }}
                            >
                              {product.name}
                            </div>
                            <div
                              style={{
                                fontSize: 11,
                                color: "var(--ink-60)",
                                fontFamily: '"JetBrains Mono", monospace',
                              }}
                            >
                              {product.brand}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td style={{ ...td, fontSize: 12 }}>
                        {product.category}
                      </td>
                      <td style={td}>
                        <div
                          style={{
                            fontFamily: '"Instrument Serif", serif',
                            fontSize: 18,
                          }}
                        >
                          ${product.price.toFixed(2)}
                        </div>
                        {product.priceBefore && (
                          <div
                            style={{
                              fontSize: 11,
                              color: "var(--ink-40)",
                              textDecoration: "line-through",
                              fontFamily: '"JetBrains Mono", monospace',
                            }}
                          >
                            ${product.priceBefore.toFixed(2)}
                          </div>
                        )}
                      </td>
                      <td
                        style={{
                          ...td,
                          fontFamily: '"JetBrains Mono", monospace',
                        }}
                      >
                        {product.stock}
                      </td>
                      <td style={td}>
                        <StatusPill
                          status={product.active ? "Activo" : "Inactivo"}
                        />
                      </td>
                      <td style={td}>
                        <div
                          style={{
                            display: "flex",
                            gap: 6,
                          }}
                        >
                          <button
                            style={iconBtnAd}
                            title="Editar producto"
                            onClick={() =>
                              setProductModal({
                                mode: "edit",
                                product,
                              })
                            }
                          >
                            <Icon name="pencil" size={14} />
                          </button>
                          <button
                            style={{
                              ...iconBtnAd,
                              color: "oklch(0.55 0.15 30)",
                            }}
                            title="Eliminar producto"
                            onClick={() => {
                              setDeleteError(null);
                              setConfirmDeleteId(product._id || product.id);
                            }}
                          >
                            <Icon name="trash" size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {displayedProducts.length === 0 && (
                    <tr>
                      <td
                        colSpan={7}
                        style={{
                          ...td,
                          textAlign: "center",
                          color: "var(--ink-60)",
                          padding: "48px 24px",
                        }}
                      >
                        No hay productos para los filtros seleccionados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              </div>
              <PaginationControls
                page={paginatedProducts.page}
                totalPages={paginatedProducts.totalPages}
                totalItems={displayedProducts.length}
                start={paginatedProducts.start}
                end={paginatedProducts.end}
                onPageChange={setProductsPage}
              />
            </Card>

            {productModal && (
              <ProductModal
                mode={productModal.mode}
                product={productModal.product}
                categories={categories}
                onClose={() => setProductModal(null)}
                onSave={(data) => {
                  if (productModal.mode === "add") {
                    productCreateMutation.mutate(data);
                  } else if (productModal.product) {
                    productUpdateMutation.mutate({
                      mongoId: productModal.product._id,
                      data,
                    });
                  }
                }}
                saving={isSaving}
                error={
                  (productCreateMutation.error as Error)?.message ||
                  (productUpdateMutation.error as Error)?.message
                }
              />
            )}

            {confirmDeleteId && (
              <div
                onClick={() => {
                  setConfirmDeleteId(null);
                  setDeleteError(null);
                }}
                style={{
                  position: "fixed",
                  inset: 0,
                  background: "rgba(17, 24, 20, 0.28)",
                  zIndex: 110,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 24,
                }}
              >
                <div
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    width: "100%",
                    maxWidth: 420,
                    background: "var(--cream)",
                    border: "1px solid var(--ink-06)",
                    borderRadius: 24,
                    boxShadow: "0 28px 80px -36px rgba(0,0,0,0.32)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      padding: "22px 24px 18px",
                      borderBottom: "1px solid var(--ink-06)",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10,
                        fontFamily: '"JetBrains Mono", monospace',
                        textTransform: "uppercase",
                        letterSpacing: "0.12em",
                        color: "var(--ink-60)",
                        marginBottom: 8,
                      }}
                    >
                      Confirmación
                    </div>
                    <div
                      style={{
                        fontFamily: '"Instrument Serif", serif',
                        fontSize: 32,
                        lineHeight: 1,
                        letterSpacing: "-0.03em",
                        color: "var(--ink)",
                      }}
                    >
                      Eliminar{" "}
                      <em
                        style={{
                          color: "oklch(0.5 0.15 30)",
                        }}
                      >
                        producto
                      </em>
                    </div>
                    <p
                      style={{
                        margin: "12px 0 0",
                        fontSize: 14,
                        lineHeight: 1.55,
                        color: "var(--ink-80)",
                        fontFamily: '"Geist", sans-serif',
                      }}
                    >
                      Esta acción eliminará el producto del catálogo. No se
                      puede deshacer.
                    </p>
                    {deleteError && (
                      <div
                        style={{
                          marginTop: 12,
                          fontSize: 12,
                          color: "oklch(0.5 0.15 30)",
                          fontFamily: '"Geist", sans-serif',
                        }}
                      >
                        {deleteError}
                      </div>
                    )}
                  </div>
                  <div
                    style={{
                      padding: 24,
                      display: "flex",
                      gap: 10,
                      justifyContent: "flex-end",
                      background: "var(--cream-2)",
                    }}
                  >
                    <AnimatedButton variant="outline" onClick={() => { setConfirmDeleteId(null); setDeleteError(null); }} text="Cancelar" />
                    <AnimatedButton variant="primary" onClick={() => { setDeleteError(null); productDeleteMutation.mutate(confirmDeleteId); }} disabled={productDeleteMutation.isPending} text={productDeleteMutation.isPending ? "Eliminando…" : "Sí, eliminar"} />
                  </div>
                </div>
              </div>
            )}

            {confirmBulkDelete && (
              <div
                onClick={() => {
                  setConfirmBulkDelete(null);
                  setDeleteError(null);
                }}
                style={{
                  position: "fixed",
                  inset: 0,
                  background: "rgba(17, 24, 20, 0.28)",
                  zIndex: 111,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 24,
                }}
              >
                <div
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    width: "100%",
                    maxWidth: 440,
                    background: "var(--cream)",
                    border: "1px solid var(--ink-06)",
                    borderRadius: 24,
                    boxShadow: "0 28px 80px -36px rgba(0,0,0,0.32)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      padding: "22px 24px 18px",
                      borderBottom: "1px solid var(--ink-06)",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10,
                        fontFamily: '"JetBrains Mono", monospace',
                        textTransform: "uppercase",
                        letterSpacing: "0.12em",
                        color: "var(--ink-60)",
                        marginBottom: 8,
                      }}
                    >
                      Confirmación
                    </div>
                    <div
                      style={{
                        fontFamily: '"Instrument Serif", serif',
                        fontSize: 32,
                        lineHeight: 1,
                        letterSpacing: "-0.03em",
                        color: "var(--ink)",
                      }}
                    >
                      {confirmBulkDelete.title}
                    </div>
                    <p
                      style={{
                        margin: "12px 0 0",
                        fontSize: 14,
                        lineHeight: 1.55,
                        color: "var(--ink-80)",
                        fontFamily: '"Geist", sans-serif',
                      }}
                    >
                      {confirmBulkDelete.description}
                    </p>
                    {deleteError && (
                      <div
                        style={{
                          marginTop: 12,
                          fontSize: 12,
                          color: "oklch(0.5 0.15 30)",
                          fontFamily: '"Geist", sans-serif',
                        }}
                      >
                        {deleteError}
                      </div>
                    )}
                  </div>
                  <div
                    style={{
                      padding: 24,
                      display: "flex",
                      gap: 10,
                      justifyContent: "flex-end",
                      background: "var(--cream-2)",
                    }}
                  >
                    <AnimatedButton variant="outline" onClick={() => { setConfirmBulkDelete(null); setDeleteError(null); }} text="Cancelar" />
                    <AnimatedButton variant="primary" onClick={() => { setDeleteError(null); bulkDeleteMutation.mutate(confirmBulkDelete.ids); }} disabled={bulkDeleteMutation.isPending} text={bulkDeleteMutation.isPending ? "Eliminando…" : "Sí, eliminar"} />
                  </div>
                </div>
              </div>
            )}

            {confirmDeleteAll && (
              <div
                onClick={() => {
                  setConfirmDeleteAll(false);
                  setDeleteError(null);
                }}
                style={{
                  position: "fixed",
                  inset: 0,
                  background: "rgba(17, 24, 20, 0.28)",
                  zIndex: 111,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 24,
                }}
              >
                <div
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    width: "100%",
                    maxWidth: 440,
                    background: "var(--cream)",
                    border: "1px solid var(--ink-06)",
                    borderRadius: 24,
                    boxShadow: "0 28px 80px -36px rgba(0,0,0,0.32)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      padding: "22px 24px 18px",
                      borderBottom: "1px solid var(--ink-06)",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10,
                        fontFamily: '"JetBrains Mono", monospace',
                        textTransform: "uppercase",
                        letterSpacing: "0.12em",
                        color: "var(--coral)",
                        marginBottom: 8,
                      }}
                    >
                      Peligro
                    </div>
                    <div
                      style={{
                        fontFamily: '"Instrument Serif", serif',
                        fontSize: 32,
                        lineHeight: 1,
                        letterSpacing: "-0.03em",
                        color: "var(--ink)",
                      }}
                    >
                      Eliminar todo el catálogo
                    </div>
                  </div>
                  <div
                    style={{
                      padding: "18px 24px",
                      borderBottom: "1px solid var(--ink-06)",
                    }}
                  >
                    <p
                      style={{
                        margin: 0,
                        fontSize: 15,
                        lineHeight: 1.6,
                        color: "var(--ink-60)",
                      }}
                    >
                      ¿Estás seguro de que deseas eliminar{" "}
                      <strong>todos los productos</strong> del catálogo? Esta
                      acción no se puede deshacer.
                    </p>
                  </div>
                  <div
                    style={{
                      padding: "16px 24px",
                      display: "flex",
                      gap: 10,
                      justifyContent: "flex-end",
                    }}
                  >
                    <AnimatedButton variant="outline" onClick={() => { setConfirmDeleteAll(false); setDeleteError(null); }} text="Cancelar" />
                    <AnimatedButton variant="primary" onClick={() => { setDeleteError(null); deleteAllMutation.mutate(); }} disabled={deleteAllMutation.isPending} text={deleteAllMutation.isPending ? "Eliminando…" : "Sí, eliminar todo"} />
                  </div>
                </div>
              </div>
            )}

            {confirmUserDelete && (
              <div
                onClick={() => setConfirmUserDelete(null)}
                style={{
                  position: "fixed",
                  inset: 0,
                  background: "rgba(17, 24, 20, 0.28)",
                  zIndex: 112,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 24,
                }}
              >
                <div
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    width: "100%",
                    maxWidth: 420,
                    background: "var(--cream)",
                    border: "1px solid var(--ink-06)",
                    borderRadius: 24,
                    boxShadow: "0 28px 80px -36px rgba(0,0,0,0.32)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      padding: "22px 24px 18px",
                      borderBottom: "1px solid var(--ink-06)",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10,
                        fontFamily: '"JetBrains Mono", monospace',
                        textTransform: "uppercase",
                        letterSpacing: "0.12em",
                        color: "var(--ink-60)",
                        marginBottom: 8,
                      }}
                    >
                      Confirmación
                    </div>
                    <div
                      style={{
                        fontFamily: '"Instrument Serif", serif',
                        fontSize: 32,
                        lineHeight: 1,
                        letterSpacing: "-0.03em",
                        color: "var(--ink)",
                      }}
                    >
                      Eliminar{" "}
                      <em
                        style={{
                          color: "oklch(0.5 0.15 30)",
                        }}
                      >
                        usuario
                      </em>
                    </div>
                    <p
                      style={{
                        margin: "12px 0 0",
                        fontSize: 14,
                        lineHeight: 1.55,
                        color: "var(--ink-80)",
                        fontFamily: '"Geist", sans-serif',
                      }}
                    >
                      ¿Eliminar a {confirmUserDelete.name}? Esto eliminará su
                      cuenta local. El usuario seguirá existiendo en Clerk.
                    </p>
                  </div>
                  <div
                    style={{
                      padding: 24,
                      display: "flex",
                      gap: 10,
                      justifyContent: "flex-end",
                      background: "var(--cream-2)",
                    }}
                  >
                    <AnimatedButton variant="outline" onClick={() => setConfirmUserDelete(null)} text="Cancelar" />
                    <AnimatedButton variant="primary" onClick={() => userDeleteMutation.mutate(confirmUserDelete.id)} disabled={userDeleteMutation.isPending} style={{ background: "oklch(0.5 0.15 30)" }} text={userDeleteMutation.isPending ? "Eliminando…" : "Sí, eliminar"} />
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── Users ── */}
        {page === "users" && (
          <>
            <PageHeader
              loading={showUsersSkeleton}
              kicker={
                showUsersSkeleton
                  ? undefined
                  : `Clientes · ${customers.length} cuentas`
              }
              title={
                <>
                  Gestión de <em style={{ color: "var(--green)" }}>clientes</em>
                </>
              }
              sub="Listado de clientes finales del e-commerce."
            />
            <Card
              pad={0}
              loading={showUsersSkeleton}
              skeletonContent={
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {/* Column headers */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 16,
                      padding: "12px 24px",
                      borderBottom: "1px solid var(--ink-06)",
                    }}
                  >
                    <div style={{ flex: 3 }}>
                      <Skeleton height={9} width={54} borderRadius={3} />
                    </div>
                    <div style={{ flex: 1.5 }}>
                      <Skeleton height={9} width={24} borderRadius={3} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <Skeleton height={9} width={52} borderRadius={3} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <Skeleton height={9} width={24} borderRadius={3} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <Skeleton height={9} width={58} borderRadius={3} />
                    </div>
                  </div>
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 16,
                        padding: "14px 24px",
                        borderBottom: "1px solid var(--ink-06)",
                      }}
                    >
                      {/* Usuario: avatar + name/email */}
                      <div
                        style={{
                          flex: 3,
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                        }}
                      >
                        <Skeleton
                          height={36}
                          width={36}
                          borderRadius={999}
                          style={{ flexShrink: 0 }}
                        />
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 5,
                          }}
                        >
                          <Skeleton height={13} width={120} borderRadius={4} />
                          <Skeleton height={10} width={160} borderRadius={4} />
                        </div>
                      </div>
                      {/* Rol */}
                      <div style={{ flex: 1.5 }}>
                        <Skeleton height={30} width={90} borderRadius={8} />
                      </div>
                      {/* Órdenes */}
                      <div style={{ flex: 1 }}>
                        <Skeleton height={13} width={28} borderRadius={4} />
                      </div>
                      {/* Gasto total */}
                      <div style={{ flex: 1 }}>
                        <Skeleton height={18} width={58} borderRadius={4} />
                      </div>
                      {/* Registro */}
                      <div style={{ flex: 1 }}>
                        <Skeleton height={11} width={76} borderRadius={4} />
                      </div>
                    </div>
                  ))}
                </div>
              }
            >
              <div style={{ overflowX: 'auto', width: '100%' }}>
              <table style={{ ...tableStyle, minWidth: 520 }}>
                <thead>
                  <tr>
                    <th style={th}>Usuario</th>
                    <th style={th}>Rol</th>
                    <th style={th}>Órdenes</th>
                    <th style={th}>Gasto total</th>
                    <th style={th}>Registro</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedUsers.items.map((user) => (
                    <tr key={user._id} style={trStyle}>
                      <td style={td}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 12,
                          }}
                        >
                          {user.imageUrl ? (
                            <img
                              src={user.imageUrl}
                              alt={user.name || "Avatar"}
                              style={{
                                width: 36,
                                height: 36,
                                borderRadius: 999,
                                objectFit: "cover",
                                flexShrink: 0,
                              }}
                            />
                          ) : (
                            <div
                              style={{
                                width: 36,
                                height: 36,
                                borderRadius: 999,
                                background: "var(--green)",
                                color: "var(--lime)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontFamily: '"Instrument Serif", serif',
                                fontSize: 16,
                                flexShrink: 0,
                              }}
                            >
                              {(user.name || "U")[0].toUpperCase()}
                            </div>
                          )}
                          <div>
                            <div
                              style={{
                                fontSize: 13,
                                fontWeight: 500,
                              }}
                            >
                              {user.name || "Sin nombre"}
                            </div>
                            <div
                              style={{
                                fontSize: 11,
                                color: "var(--ink-60)",
                                fontFamily: '"JetBrains Mono", monospace',
                              }}
                            >
                              {user.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td style={td}>
                        <div
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            padding: "6px 10px",
                            borderRadius: 6,
                            background: "var(--ink-06)",
                            fontSize: 11,
                            fontFamily: '"JetBrains Mono", monospace',
                            color: "var(--ink-70)",
                          }}
                        >
                          Cliente
                        </div>
                      </td>
                      <td
                        style={{
                          ...td,
                          fontFamily: '"JetBrains Mono", monospace',
                        }}
                      >
                        {user.orderCount ?? 0}
                      </td>
                      <td
                        style={{
                          ...td,
                          fontFamily: '"Instrument Serif", serif',
                          fontSize: 18,
                        }}
                      >
                        ${(user.ltv ?? 0).toFixed(2)}
                      </td>
                      <td
                        style={{
                          ...td,
                          fontSize: 11,
                          color: "var(--ink-60)",
                          fontFamily: '"JetBrains Mono", monospace',
                        }}
                      >
                        {user.createdAt
                          ? new Date(user.createdAt).toLocaleDateString()
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
              <PaginationControls
                page={paginatedUsers.page}
                totalPages={paginatedUsers.totalPages}
                totalItems={users.length}
                start={paginatedUsers.start}
                end={paginatedUsers.end}
                onPageChange={setUsersPage}
              />
            </Card>
          </>
        )}

        {/* ── Sales ── */}
        {page === "sales" && (
          <>
            <PageHeader
              loading={showSalesSkeleton}
              kicker="Ventas"
              title={
                <>
                  Análisis de <em style={{ color: "var(--green)" }}>ventas</em>
                </>
              }
              sub="Tendencia diaria, productos y categorías más vendidas."
            />
            <div
              style={{
                display: "grid",
                gridTemplateColumns: isSmall ? "repeat(2, 1fr)" : "repeat(4, 1fr)",
                gap: 16,
                marginBottom: 28,
              }}
            >
              <KpiCard
                label="Total órdenes"
                value={sales?.summary?.totalOrders?.toLocaleString() ?? "—"}
                sub="pagadas en total"
                loading={showSalesSkeleton}
                animKey="sales_orders"
              />
              <KpiCard
                label="Ingresos totales"
                value={
                  sales?.summary
                    ? `$${sales.summary.totalRevenue.toLocaleString()}`
                    : "—"
                }
                sub="todos los pedidos"
                loading={showSalesSkeleton}
                animKey="sales_revenue"
              />
              <KpiCard
                mode="dark"
                label="Promedio por pedido"
                value={
                  sales?.summary
                    ? `$${sales.summary.avgOrderValue.toFixed(2)}`
                    : "—"
                }
                sub="por orden"
                loading={showSalesSkeleton}
                animKey="sales_avg"
              />
              <KpiCard
                label="Unidades vendidas"
                value={sales?.summary?.totalUnits?.toLocaleString() ?? "—"}
                sub="total de productos"
                loading={showSalesSkeleton}
                animKey="sales_units"
              />
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 24,
                marginBottom: 24,
              }}
            >
              <Card
                title="Órdenes por día"
                sub="Pedidos diarios · últimos 30 días"
                loading={showSalesSkeleton}
                skeletonContent={<Skeleton height={240} borderRadius={8} />}
              >
                {sales?.daily ? (
                  <BarChart data={sales.daily} height={240} />
                ) : (
                  <Skeleton height={240} borderRadius={8} />
                )}
              </Card>
              <Card
                title="Ingresos por categoría"
                sub="Ingresos por categoría"
                loading={showSalesSkeleton}
                skeletonContent={<Skeleton height={240} borderRadius={8} />}
              >
                {sales?.revenueByCategory?.length ? (
                  <BarChart data={sales.revenueByCategory} height={240} />
                ) : (
                  <Skeleton height={240} borderRadius={8} />
                )}
              </Card>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: isSmall ? "1fr" : "1fr 1fr",
                gap: 20,
              }}
            >
              <Card
                title="Productos con más ingresos"
                sub="Basado en órdenes pagadas"
                loading={showSalesSkeleton}
                skeletonContent={
                  <div
                    style={{ display: "flex", flexDirection: "column", gap: 0 }}
                  >
                    {[0, 1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 14,
                          padding: "12px 0",
                          borderBottom: "1px solid var(--ink-06)",
                        }}
                      >
                        <div style={{ flex: 2 }}>
                          <Skeleton height={13} width="75%" borderRadius={4} />
                        </div>
                        <Skeleton height={22} width={72} borderRadius={999} />
                        <Skeleton height={22} width={80} borderRadius={999} />
                        <Skeleton height={13} width={32} borderRadius={4} />
                        <Skeleton height={16} width={52} borderRadius={4} />
                      </div>
                    ))}
                  </div>
                }
              >
                <div style={{ overflowX: 'auto', width: '100%' }}>
                <table style={{ ...tableStyle, minWidth: 420 }}>
                  <thead>
                    <tr>
                      <th style={th}>Producto</th>
                      <th style={th}>Marca</th>
                      <th style={th}>Categoría</th>
                      <th style={th}>Unidades</th>
                      <th style={th}>Ingresos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(sales?.byCategory || []).map((row) => (
                      <tr key={row.productId} style={trStyle}>
                        <td style={td}>{row.name}</td>
                        <td style={td}>
                          <StatusPill status={row.brand} />
                        </td>
                        <td style={td}>
                          <StatusPill status={row.category} />
                        </td>
                        <td
                          style={{
                            ...td,
                            fontFamily: '"JetBrains Mono", monospace',
                          }}
                        >
                          {row.units}
                        </td>
                        <td
                          style={{
                            ...td,
                            fontFamily: '"Instrument Serif", serif',
                            fontSize: 18,
                          }}
                        >
                          ${row.revenue.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </Card>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 20,
                }}
              >
                <Card
                  title="Top categorías"
                  sub="Por unidades vendidas"
                  loading={showSalesSkeleton}
                  skeletonContent={
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 16,
                      }}
                    >
                      {[0, 1, 2, 3, 4].map((i) => (
                        <div key={i}>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 10,
                              marginBottom: 6,
                            }}
                          >
                            <Skeleton height={11} width={20} borderRadius={4} />
                            <Skeleton
                              height={13}
                              width="50%"
                              borderRadius={4}
                            />
                            <Skeleton height={13} width={48} borderRadius={4} />
                          </div>
                          <Skeleton
                            height={6}
                            width="100%"
                            borderRadius={999}
                          />
                        </div>
                      ))}
                    </div>
                  }
                >
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 16,
                    }}
                  >
                    {(sales?.topCategories || []).length === 0 ? (
                      <div
                        style={{
                          fontSize: 14,
                          color: "var(--ink-60)",
                        }}
                      >
                        No hay datos.
                      </div>
                    ) : (
                      (sales?.topCategories || []).map((row, i) => (
                        <div key={row._id}>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 12,
                              marginBottom: 6,
                            }}
                          >
                            <span
                              style={{
                                fontSize: 11,
                                fontFamily: '"JetBrains Mono", monospace',
                                color: "var(--ink-60)",
                                width: 20,
                              }}
                            >
                              #{i + 1}
                            </span>
                            <span
                              style={{
                                fontSize: 14,
                                fontWeight: 500,
                                flex: 1,
                              }}
                            >
                              {row._id}
                            </span>
                            <span
                              style={{
                                fontSize: 14,
                                fontFamily: '"JetBrains Mono", monospace',
                              }}
                            >
                              {row.units} uds
                            </span>
                          </div>
                          <div
                            style={{
                              height: 6,
                              background: "var(--ink-06)",
                              borderRadius: 999,
                              overflow: "hidden",
                            }}
                          >
                            <div
                              style={{
                                height: "100%",
                                width: `${(row.units / Math.max(...((sales?.topCategories || []).map((r) => r.units) || [1]))) * 100}%`,
                                background: "var(--green)",
                                borderRadius: 999,
                              }}
                            />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </Card>
                <Card
                  title="Top marcas"
                  sub="Por unidades vendidas"
                  loading={showSalesSkeleton}
                  skeletonContent={
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 16,
                      }}
                    >
                      {[0, 1, 2, 3, 4].map((i) => (
                        <div key={i}>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 10,
                              marginBottom: 6,
                            }}
                          >
                            <Skeleton height={11} width={20} borderRadius={4} />
                            <Skeleton
                              height={13}
                              width="45%"
                              borderRadius={4}
                            />
                            <Skeleton height={13} width={48} borderRadius={4} />
                          </div>
                          <Skeleton
                            height={6}
                            width="100%"
                            borderRadius={999}
                          />
                        </div>
                      ))}
                    </div>
                  }
                >
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 16,
                    }}
                  >
                    {(sales?.topBrands || []).length === 0 ? (
                      <div
                        style={{
                          fontSize: 14,
                          color: "var(--ink-60)",
                        }}
                      >
                        No hay datos.
                      </div>
                    ) : (
                      (sales?.topBrands || []).map((row, i) => (
                        <div key={row._id}>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 12,
                              marginBottom: 6,
                            }}
                          >
                            <span
                              style={{
                                fontSize: 11,
                                fontFamily: '"JetBrains Mono", monospace',
                                color: "var(--ink-60)",
                                width: 20,
                              }}
                            >
                              #{i + 1}
                            </span>
                            <span
                              style={{
                                fontSize: 14,
                                fontWeight: 500,
                                flex: 1,
                              }}
                            >
                              {row._id}
                            </span>
                            <span
                              style={{
                                fontSize: 14,
                                fontFamily: '"JetBrains Mono", monospace',
                              }}
                            >
                              {row.units} uds
                            </span>
                          </div>
                          <div
                            style={{
                              height: 6,
                              background: "var(--ink-06)",
                              borderRadius: 999,
                              overflow: "hidden",
                            }}
                          >
                            <div
                              style={{
                                height: "100%",
                                width: `${(row.units / Math.max(...((sales?.topBrands || []).map((r) => r.units) || [1]))) * 100}%`,
                                background: "var(--green)",
                                borderRadius: 999,
                              }}
                            />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </Card>
              </div>
            </div>
          </>
        )}

        {/* ── Earnings ── */}
        {page === "earnings" && (
          <>
            <PageHeader
              loading={showEarningsSkeleton}
              kicker="Ganancias"
              title={
                <>
                  Las <em style={{ color: "var(--green)" }}>ganancias</em>
                </>
              }
              sub="Resumen bruto, neto y evolución mensual del ecommerce."
            />
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: 16,
                marginBottom: 24,
              }}
            >
              <KpiCard
                mode="dark"
                label="Ingresos brutos"
                value={
                  earnings?.summary
                    ? `$${earnings.summary.gross.toFixed(2)}`
                    : "—"
                }
                loading={showEarningsSkeleton}
                animKey="earn_gross"
              />
              <KpiCard
                label="Impuestos"
                value={
                  earnings?.summary
                    ? `$${earnings.summary.tax.toFixed(2)}`
                    : "—"
                }
                loading={showEarningsSkeleton}
                animKey="earn_tax"
              />
              <KpiCard
                label="Utilidad neta"
                value={
                  earnings?.summary
                    ? `$${earnings.summary.net.toLocaleString()}`
                    : "—"
                }
                loading={showEarningsSkeleton}
                animKey="earn_net"
              />
              <KpiCard
                label="Comisiones Stripe"
                value={
                  earnings?.summary
                    ? `$${earnings.summary.fees.toFixed(2)}`
                    : "—"
                }
                sub="estimado 2.9%"
                loading={showEarningsSkeleton}
                animKey="earn_fees"
              />
            </div>
            <Card
              title="Detalle mensual"
              sub="Ingresos y órdenes por mes"
              pad={20}
              loading={showEarningsSkeleton}
              skeletonContent={
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 16,
                        padding: "14px 24px",
                        borderBottom: "1px solid var(--ink-06)",
                      }}
                    >
                      {/* Mes */}
                      <div style={{ flex: 3 }}>
                        <Skeleton height={13} width="70%" borderRadius={4} />
                      </div>
                      {/* Órdenes */}
                      <div style={{ flex: 1 }}>
                        <Skeleton height={13} width={32} borderRadius={4} />
                      </div>
                      {/* Revenue */}
                      <div style={{ flex: 2 }}>
                        <Skeleton height={18} width={80} borderRadius={4} />
                      </div>
                    </div>
                  ))}
                </div>
              }
            >
              <div style={{ overflowX: 'auto', width: '100%' }}>
              <table style={{ ...tableStyle, minWidth: 340 }}>
                <thead>
                  <tr>
                    <th style={th}>Mes</th>
                    <th style={th}>Órdenes</th>
                    <th style={th}>Ingresos</th>
                  </tr>
                </thead>
                <tbody>
                  {(earnings?.monthly
                    ? [...earnings.monthly].reverse()
                    : []
                  ).map((row) => (
                    <tr key={row.month} style={trStyle}>
                      <td style={td}>{row.month}</td>
                      <td
                        style={{
                          ...td,
                          fontFamily: '"JetBrains Mono", monospace',
                        }}
                      >
                        {row.orders}
                      </td>
                      <td
                        style={{
                          ...td,
                          fontFamily: '"Instrument Serif", serif',
                          fontSize: 18,
                        }}
                      >
                        ${row.revenue.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </Card>
          </>
        )}
      </div>
      {showBackToTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          aria-label="Volver arriba"
          style={{
            position: "fixed",
            right: 28,
            bottom: 28,
            width: 52,
            height: 52,
            borderRadius: 999,
            border: "1px solid rgba(255,255,255,0.12)",
            background: "var(--green)",
            color: "var(--lime)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            boxShadow: "0 18px 40px -18px rgba(0,0,0,0.35)",
            zIndex: 80,
            transition: "transform 180ms ease, opacity 180ms ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-2px) scale(1.04)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "translateY(0) scale(1)";
          }}
        >
          <span
            style={{
              transform: "rotate(-90deg)",
              display: "inline-flex",
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 12h14" />
              <path d="m13 6 6 6-6 6" />
            </svg>
          </span>
        </button>
      )}
    </div>
  );
}

export function AdminApp({ onGoToStore }: AdminAppProps) {
  return <AdminAccessGate onGoToStore={onGoToStore} />;
}
