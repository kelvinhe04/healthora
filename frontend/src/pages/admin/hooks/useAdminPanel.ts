import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParamsCompat as useSearchParams } from '../../../hooks/useSearchParamsCompat';
import { useUser } from '@clerk/clerk-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { initAdminSession, useOnceLoading } from '../../../components/admin';
import { api } from '../../../lib/api';
import type { FulfillmentStatus, PaymentStatus, Product } from '../../../types';
import { useBreakpoint } from '../../../hooks/useBreakpoint';
import {
  fulfillmentStatusLabels,
  fulfillmentStatusOptions,
  type AdminAccess,
  type AdminOrder,
  type AdminPage,
  type AdminUser,
  type DashboardData,
  type EarningsData,
  type ErrorReportsData,
  type PerformanceData,
  type SalesData,
} from '../types';
import { getNextFulfillmentStatus, paginateItems } from '../utils';
import { useAdminToken } from './useAdminToken';

export type AdminPanelState = ReturnType<typeof useAdminPanel>;

export function useAdminPanel({
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
  const [searchParams, setSearchParams] = useSearchParams();
  const [page, setPage] = useState<AdminPage>(() => {
    const sp = new URLSearchParams(window.location.search);
    const urlPage = sp.get("section") as AdminPage | null;
    if (urlPage && ["dashboard","orders","products","users","sales","earnings","performance","errors"].includes(urlPage)) return urlPage;
    return (localStorage.getItem("healthora_admin_page") as AdminPage) || "dashboard";
  });

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
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (page === "dashboard") next.delete("section");
      else next.set("section", page);
      return next;
    }, { replace: true });
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

  // Products state — URL-synced modal
  const [productModal, setProductModalState] = useState<{
    mode: "add" | "edit";
    product?: Product;
  } | null>(null);

  const openProductModal = useCallback((modal: { mode: "add" | "edit"; product?: Product } | null) => {
    setProductModalState(modal);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (!modal) {
        next.delete("modal");
        next.delete("productId");
      } else {
        next.set("section", "products");
        next.set("modal", modal.mode);
        if (modal.mode === "edit" && modal.product?._id) {
          next.set("productId", modal.product._id);
        } else {
          next.delete("productId");
        }
      }
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  // Alias so existing call sites don't need renaming
  const setProductModal = openProductModal;
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
    enabled: page === "products" || searchParams.get("modal") === "edit",
  });
  const productsCountQuery = useQuery({
    queryKey: ["admin-products-count"],
    queryFn: async () => api.admin.products.count(await getAdminToken()),
  });

  // Open modal from URL on deep-link (e.g. ?section=products&modal=edit&productId=xxx)
  const urlModalHandledRef = useRef(false);
  useEffect(() => {
    if (urlModalHandledRef.current) return;
    const urlModal = searchParams.get("modal");
    if (!urlModal) return;
    if (urlModal === "add") {
      urlModalHandledRef.current = true;
      setProductModalState({ mode: "add" });
    } else if (urlModal === "edit") {
      const productId = searchParams.get("productId");
      if (!productId) return;
      if (!productsQuery.data) return; // wait for data
      const product = (productsQuery.data as Product[]).find((p) => p._id === productId);
      if (product) {
        urlModalHandledRef.current = true;
        setProductModalState({ mode: "edit", product });
      }
    }
  }, [searchParams, productsQuery.data]);
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

  const [performanceWindow, setPerformanceWindow] = useState(1440);
  const performanceQuery = useQuery({
    queryKey: ["admin-performance", performanceWindow],
    queryFn: async () =>
      api.admin.performance(await getAdminToken(), performanceWindow) as Promise<PerformanceData>,
    enabled: page === "performance",
  });

  const [errorSourceFilter, setErrorSourceFilter] = useState<"" | "backend" | "frontend">("");
  const errorReportsQuery = useQuery({
    queryKey: ["admin-error-reports", errorSourceFilter],
    queryFn: async () =>
      api.admin.errorReports(await getAdminToken(), errorSourceFilter || undefined) as Promise<ErrorReportsData>,
    enabled: page === "errors",
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
  const showPerformanceSkeleton = useOnceLoading(
    "section_performance",
    performanceQuery.isLoading,
  );
  const showErrorsSkeleton = useOnceLoading(
    "section_errors",
    errorReportsQuery.isLoading,
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
    void queryClient.invalidateQueries({ queryKey: ["admin-products-count"] });
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

  const _roleMutation = useMutation({
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

  const orders = ordersQuery.data || [];
  const products = productsQuery.data || [];
  const users = usersQuery.data || [];
  const customers = useMemo(
    () => users.filter((u) => u.role === "customer"),
    [users],
  );
  const sales = salesQuery.data;
  const earnings = earningsQuery.data;
  const performanceData = performanceQuery.data;
  const errorReports = errorReportsQuery.data;
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

  return {
    access,
    onGoToStore,
    user,
    page,
    setPage,
    sidebarOpen,
    setSidebarOpen,
    isMobile,
    isTablet,
    isSmall,
    sidebarCounts,
    dashboard,
    customers,
    showOrdersSkeleton,
    orderSearch,
    setOrderSearch,
    orderFulfillmentFilter,
    setOrderFulfillmentFilter,
    fulfillmentStatusOptions,
    fulfillmentStatusLabels,
    displayedOrders,
    paginatedOrders,
    orders,
    ordersPage,
    setOrdersPage,
    orderStatusDrafts,
    setOrderStatusDrafts,
    confirmOrderStatus,
    setConfirmOrderStatus,
    orderStatusesMutation,
    getNextFulfillmentStatus,
    productSuccess,
    setProductSuccess,
    showProductsSkeleton,
    products,
    productCatFilter,
    setProductCatFilter,
    categories,
    productSearch,
    setProductSearch,
    setProductModal,
    selectedProductIds,
    setSelectedProductIds,
    allDisplayedSelected,
    selectedDisplayedIds,
    displayedProductIds,
    displayedProducts,
    paginatedProducts,
    productsPage,
    setProductsPage,
    confirmDeleteId,
    setConfirmDeleteId,
    confirmBulkDelete,
    setConfirmBulkDelete,
    confirmDeleteAll,
    setConfirmDeleteAll,
    confirmUserDelete,
    setConfirmUserDelete,
    productModal,
    isSaving,
    productUpdateMutation,
    productCreateMutation,
    productDeleteMutation,
    bulkDeleteMutation,
    deleteAllMutation,
    userDeleteMutation,
    deleteError,
    setDeleteError,
    showUsersSkeleton,
    users,
    paginatedUsers,
    usersPage,
    setUsersPage,
    showSalesSkeleton,
    sales,
    showEarningsSkeleton,
    earnings,
    performanceWindow,
    setPerformanceWindow,
    performanceData,
    showPerformanceSkeleton,
    errorSourceFilter,
    setErrorSourceFilter,
    errorReports,
    showErrorsSkeleton,
  };
}
