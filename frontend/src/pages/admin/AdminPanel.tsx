import { Sidebar } from '../../components/admin';
import { Icon } from '../../components/shared/Icon';
import { SkipToContent } from '../../components/shared/SkipToContent';
import type { AdminAccess } from './types';
import { AdminPanelProvider, useAdminPanelContext } from './AdminPanelContext';
import { DashboardSection } from './sections/DashboardSection';
import { EarningsSection } from './sections/EarningsSection';
import { ErrorsSection } from './sections/ErrorsSection';
import { OrdersSection } from './sections/OrdersSection';
import { PerformanceSection } from './sections/PerformanceSection';
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

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: isSmall ? "1fr" : "240px 1fr",
        minHeight: "100vh",
        background: "var(--cream-2)",
      }}
    >
      <SkipToContent targetId="admin-main-content" />
      {/* Mobile top bar */}
      {isSmall && (
        <div style={{ position: "sticky", top: 0, zIndex: 50, background: "var(--cream)", borderBottom: "1px solid var(--ink-06)", padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 26, height: 26, borderRadius: 999, background: "var(--green)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--lime)", fontFamily: '"Instrument Serif", serif', fontSize: 16 }}>h</div>
            <span style={{ fontFamily: '"Instrument Serif", serif', fontSize: 20, letterSpacing: "-0.02em" }}>Admin</span>
          </div>
          <button type="button" onClick={() => setSidebarOpen(true)} aria-label="Abrir menú de administración" aria-expanded={sidebarOpen} style={{ background: "transparent", border: "1px solid var(--ink-06)", borderRadius: 999, padding: "6px 10px", cursor: "pointer", display: "flex", alignItems: "center", color: "var(--ink)" }}>
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

      <main id="admin-main-content" style={{ padding: isMobile ? "20px 16px 60px" : isTablet ? "28px 28px 60px" : "36px 48px 80px", overflow: "auto" }} tabIndex={-1}>
        {page === "dashboard" && <DashboardSection />}
        {page === "orders" && <OrdersSection />}
        {page === "products" && <ProductsSection />}
        {page === "users" && <UsersSection />}
        {page === "sales" && <SalesSection />}
        {page === "earnings" && <EarningsSection />}
        {page === "performance" && <PerformanceSection />}
        {page === "errors" && <ErrorsSection />}
      </main>
    </div>
  );
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
