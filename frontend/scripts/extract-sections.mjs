import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const adminDir = path.resolve(__dirname, '../src/pages/admin');
const panelPath = path.join(adminDir, 'AdminPanel.tsx');
const lines = fs.readFileSync(panelPath, 'utf8').split(/\r?\n/);
const extract = (start, end) => lines.slice(start - 1, end).join('\n');

const hookBody = extract(53, 533);

const hookImports = `import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { initAdminSession, useOnceLoading } from '../../components/admin';
import { api } from '../../lib/api';
import type { FulfillmentStatus, PaymentStatus, Product } from '../../types';
import type {
  AdminAccess,
  AdminOrder,
  AdminUser,
  DashboardData,
  EarningsData,
  SalesData,
} from './types';
import { useAdminToken } from './useAdminToken';

export type AdminPanelState = ReturnType<typeof useAdminPanel>;

export function useAdminPanel({
  access,
  onGoToStore,
}: {
  access: AdminAccess;
  onGoToStore: () => void;
}) {
${hookBody}
}
`;

fs.writeFileSync(path.join(adminDir, 'hooks/useAdminPanel.ts'), hookImports);

const contextFile = `import { createContext, useContext, type ReactNode } from 'react';
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
`;

fs.writeFileSync(path.join(adminDir, 'AdminPanelContext.tsx'), contextFile);

const sections = [
  {
    name: 'DashboardSection',
    file: 'DashboardSection.tsx',
    ranges: [[590, 888]],
    extraImports: `import {
  Card,
  KpiCard,
  LineChart,
  PageHeader,
  Skeleton,
  StatusPill,
  tableStyle,
  td,
  th,
  trStyle,
} from '../../../components/admin';
import { ProductImage } from '../../../components/shared/ProductImage';
`,
    ctxVars: [
      'dashboard',
      'isMobile',
      'isTablet',
      'isSmall',
      'customers',
    ],
  },
  {
    name: 'OrdersSection',
    file: 'OrdersSection.tsx',
    ranges: [[893, 1422], [1425, 1612]],
    extraImports: `import {
  Card,
  PageHeader,
  Skeleton,
  StatusPill,
  tableStyle,
  td,
  th,
  trStyle,
  iconBtnAd,
} from '../../../components/admin';
import { AnimatedButton } from '../../../components/shared/AnimatedButton';
import { Icon } from '../../../components/shared/Icon';
import { ModalOverlay } from '../../../components/shared/ModalOverlay';
import { PaginationControls } from '../components/PaginationControls';
`,
    ctxVars: [
      'showOrdersSkeleton',
      'orderSearch',
      'setOrderSearch',
      'orderFulfillmentFilter',
      'setOrderFulfillmentFilter',
      'fulfillmentStatusOptions',
      'fulfillmentStatusLabels',
      'displayedOrders',
      'paginatedOrders',
      'ordersPage',
      'setOrdersPage',
      'orderStatusDrafts',
      'setOrderStatusDrafts',
      'setConfirmOrderStatus',
      'confirmOrderStatus',
      'orderStatusesMutation',
      'getNextFulfillmentStatus',
      'setProductSuccess',
      'productSuccess',
    ],
  },
  {
    name: 'ProductsSection',
    file: 'ProductsSection.tsx',
    ranges: [[1616, 2484]],
    extraImports: `import {
  Card,
  PageHeader,
  Skeleton,
  StatusPill,
  tableStyle,
  td,
  th,
  trStyle,
  iconBtnAd,
} from '../../../components/admin';
import { AnimatedButton } from '../../../components/shared/AnimatedButton';
import { Icon } from '../../../components/shared/Icon';
import { ModalOverlay } from '../../../components/shared/ModalOverlay';
import { ProductImage } from '../../../components/shared/ProductImage';
import { PaginationControls } from '../components/PaginationControls';
import { ProductModal } from '../components/ProductModal';
`,
    ctxVars: [
      'showProductsSkeleton',
      'products',
      'productCatFilter',
      'setProductCatFilter',
      'categories',
      'productSearch',
      'setProductSearch',
      'setProductModal',
      'selectedProductIds',
      'setSelectedProductIds',
      'allDisplayedSelected',
      'selectedDisplayedIds',
      'displayedProductIds',
      'displayedProducts',
      'paginatedProducts',
      'productsPage',
      'setProductsPage',
      'setConfirmDeleteId',
      'setConfirmBulkDelete',
      'setConfirmDeleteAll',
      'confirmDeleteId',
      'confirmBulkDelete',
      'confirmDeleteAll',
      'confirmUserDelete',
      'setConfirmUserDelete',
      'productModal',
      'isSaving',
      'productUpdateMutation',
      'productCreateMutation',
      'productDeleteMutation',
      'bulkDeleteMutation',
      'deleteAllMutation',
      'userDeleteMutation',
      'deleteError',
      'setDeleteError',
    ],
  },
  {
    name: 'UsersSection',
    file: 'UsersSection.tsx',
    ranges: [[2489, 2726]],
    extraImports: `import {
  Card,
  PageHeader,
  Skeleton,
  StatusPill,
  tableStyle,
  td,
  th,
  trStyle,
  iconBtnAd,
} from '../../../components/admin';
import { AnimatedButton } from '../../../components/shared/AnimatedButton';
import { Icon } from '../../../components/shared/Icon';
import { PaginationControls } from '../components/PaginationControls';
`,
    ctxVars: [
      'showUsersSkeleton',
      'customers',
      'users',
      'paginatedUsers',
      'usersPage',
      'setUsersPage',
      'setConfirmUserDelete',
    ],
  },
  {
    name: 'SalesSection',
    file: 'SalesSection.tsx',
    ranges: [[2731, 3146]],
    extraImports: `import {
  BarChart,
  Card,
  KpiCard,
  LineChart,
  PageHeader,
  Skeleton,
  StatusPill,
  tableStyle,
  td,
  th,
  trStyle,
} from '../../../components/admin';
`,
    ctxVars: [
      'showSalesSkeleton',
      'sales',
      'isMobile',
      'isTablet',
      'isSmall',
    ],
  },
  {
    name: 'EarningsSection',
    file: 'EarningsSection.tsx',
    ranges: [[3151, 3271]],
    extraImports: `import {
  Card,
  KpiCard,
  LineChart,
  PageHeader,
  Skeleton,
  tableStyle,
  td,
  th,
  trStyle,
} from '../../../components/admin';
`,
    ctxVars: [
      'showEarningsSkeleton',
      'earnings',
      'isMobile',
      'isTablet',
    ],
  },
];

const sectionsDir = path.join(adminDir, 'sections');
fs.mkdirSync(sectionsDir, { recursive: true });

for (const section of sections) {
  const body = section.ranges.map(([s, e]) => extract(s, e)).join('\n\n');
  const destructure = section.ctxVars.join(',\n  ');
  const content = `${section.extraImports}import { useAdminPanelContext } from '../AdminPanelContext';

export function ${section.name}() {
  const {
  ${destructure},
  } = useAdminPanelContext();

  return (
    <>
${body}
    </>
  );
}
`;
  fs.writeFileSync(path.join(sectionsDir, section.file), content);
}

const layoutStart = extract(535, 587);
const layoutEnd = extract(3272, 3273);

const newAdminPanel = `import { Icon } from '../../components/shared/Icon';
import { Sidebar } from '../../components/admin';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import type { AdminAccess } from './types';
import { AdminPanelProvider, useAdminPanelContext } from './AdminPanelContext';
import { DashboardSection } from './sections/DashboardSection';
import { EarningsSection } from './sections/EarningsSection';
import { OrdersSection } from './sections/OrdersSection';
import { ProductsSection } from './sections/ProductsSection';
import { SalesSection } from './sections/SalesSection';
import { UsersSection } from './sections/UsersSection';

function AdminPanelLayout({
  access,
  onGoToStore,
}: {
  access: AdminAccess;
  onGoToStore: () => void;
}) {
  const {
    page,
    setPage,
    sidebarOpen,
    setSidebarOpen,
    sidebarCounts,
    user,
    isSmall,
    isMobile,
    isTablet,
  } = useAdminPanelContext();

${layoutStart}

      <div style={{ padding: isMobile ? "20px 16px 60px" : isTablet ? "28px 28px 60px" : "36px 48px 80px", overflow: "auto" }}>
        {page === "dashboard" && <DashboardSection />}
        {page === "orders" && <OrdersSection />}
        {page === "products" && <ProductsSection />}
        {page === "users" && <UsersSection />}
        {page === "sales" && <SalesSection />}
        {page === "earnings" && <EarningsSection />}
      </div>
${layoutEnd}
}

export function AdminPanel({
  access,
  onGoToStore,
}: {
  access: AdminAccess;
  onGoToStore: () => void;
}) {
  return (
    <AdminPanelProvider access={access} onGoToStore={onGoToStore}>
      <AdminPanelLayout access={access} onGoToStore={onGoToStore} />
    </AdminPanelProvider>
  );
}
`;

fs.writeFileSync(panelPath, newAdminPanel);
console.log('Sections extracted successfully');
