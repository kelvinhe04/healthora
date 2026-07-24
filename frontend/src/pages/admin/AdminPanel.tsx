import { useTranslation } from 'react-i18next';
import { Sidebar } from '../../components/admin';
import { Icon } from '../../components/shared/Icon';
import { AnimatedButton } from '../../components/shared/AnimatedButton';
import { ModalOverlay } from '../../components/shared/ModalOverlay';
import { SkipToContent } from '../../components/shared/SkipToContent';
import { NotificationCenter } from '../../components/shared/NotificationCenter';
import { LanguageSwitcher } from '../../components/shared/LanguageSwitcher';
import type { AdminAccess } from './types';
import { AdminPanelProvider, useAdminPanelContext } from './AdminPanelContext';
import { AuditLogsSection } from './sections/AuditLogsSection';
import { DashboardSection } from './sections/DashboardSection';
import { EarningsSection } from './sections/EarningsSection';
import { OrdersSection } from './sections/OrdersSection';
import { ProductAnalyticsSection } from './sections/ProductAnalyticsSection';
import { ReportsSection } from './sections/ReportsSection';
import { ProductsSection } from './sections/ProductsSection';
import { RepurchaseSection } from './sections/RepurchaseSection';
import { ReturnsSection } from './sections/ReturnsSection';
import { ReviewsSection } from './sections/ReviewsSection';
import { CategoriesSection } from './sections/CategoriesSection';
import { CouponsSection } from './sections/CouponsSection';
import { BannersSection } from './sections/BannersSection';
import { SalesSection } from './sections/SalesSection';
import { UsersSection } from './sections/UsersSection';

function AdminPanelLayout({
  access,
  onGoToStore,
}: {
  access: AdminAccess;
  onGoToStore: () => void;
}) {
  const { t } = useTranslation();
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
    productSuccess,
    setProductSuccess,
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
            <span style={{ fontFamily: '"Instrument Serif", serif', fontSize: 20, letterSpacing: "-0.02em" }}>{t('admin.mobileTopBar.title')}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <LanguageSwitcher
              buttonStyle={{ background: "transparent", border: "1px solid var(--ink-06)", borderRadius: 999, padding: "6px 8px", cursor: "pointer", display: "flex", alignItems: "center", color: "var(--ink)" }}
            />
            <NotificationCenter
              buttonStyle={{ background: "transparent", border: "1px solid var(--ink-06)", borderRadius: 999, padding: 7, cursor: "pointer", display: "flex", alignItems: "center", color: "var(--ink)" }}
              iconSize={16}
            />
            <button type="button" onClick={() => setSidebarOpen(true)} aria-label={t('admin.sidebar.openMenuAria')} aria-expanded={sidebarOpen} style={{ background: "transparent", border: "1px solid var(--ink-06)", borderRadius: 999, padding: "6px 10px", cursor: "pointer", display: "flex", alignItems: "center", color: "var(--ink)" }}>
              <Icon name="menu" size={18} />
            </button>
          </div>
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
          adminPhoto={access.imageUrl || user?.imageUrl}
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
              adminPhoto={access.imageUrl || user?.imageUrl}
            />
          </div>
        </div>
      )}

      <main id="admin-main-content" style={{ padding: isMobile ? "20px 16px 60px" : isTablet ? "28px 28px 60px" : "36px 48px 80px", overflow: "auto" }} tabIndex={-1}>
        {page === "dashboard" && <DashboardSection />}
        {page === "orders" && <OrdersSection />}
        {page === "products" && <ProductsSection />}
        {page === "categories" && <CategoriesSection />}
        {page === "coupons" && <CouponsSection />}
        {page === "banners" && <BannersSection />}
        {page === "users" && <UsersSection />}
        {page === "returns" && <ReturnsSection />}
        {page === "reviews" && <ReviewsSection />}
        {page === "sales" && <SalesSection />}
        {page === "earnings" && <EarningsSection />}
        {page === "reports" && <ReportsSection />}
        {page === "audit" && <AuditLogsSection />}
        {page === "repurchase" && <RepurchaseSection />}
        {page === "analytics" && <ProductAnalyticsSection />}
      </main>

      {/* Mounted at the layout level (not per-section) so it shows no matter which admin page
          triggered the mutation — product create/update/delete all set this via context. */}
      <ModalOverlay open={!!productSuccess} onClose={() => setProductSuccess(null)} zIndex={114} overlayColor="rgba(17, 24, 20, 0.28)">
        <div
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
                position: "relative",
                width: 44,
                height: 44,
                marginBottom: 18,
              }}
            >
              <div
                key={`ring-${productSuccess?.kicker}`}
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: 999,
                  border: "1.5px solid var(--green)",
                  animation: "success-ring-pulse 900ms ease-out 120ms both",
                }}
              />
              <div
                key={`icon-${productSuccess?.kicker}`}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 999,
                  background: "var(--green)",
                  color: "var(--cream)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  animation: "success-icon-pop 480ms cubic-bezier(0.34, 1.56, 0.64, 1) both",
                }}
              >
                <Icon name="check" size={20} />
              </div>
            </div>
            <div
              key={`kicker-${productSuccess?.kicker}`}
              style={{
                fontSize: 10,
                fontFamily: '"JetBrains Mono", monospace',
                textTransform: "uppercase",
                letterSpacing: "0.12em",
                color: "var(--ink-60)",
                marginBottom: 8,
                animation: "success-fade-up 360ms ease-out 80ms both",
              }}
            >
              {productSuccess?.kicker}
            </div>
            <div
              key={`title-${productSuccess?.kicker}`}
              style={{
                fontFamily: '"Instrument Serif", serif',
                fontSize: 32,
                lineHeight: 1,
                letterSpacing: "-0.03em",
                color: "var(--ink)",
                animation: "success-fade-up 360ms ease-out 140ms both",
              }}
            >
              {productSuccess?.title}{" "}
              <em style={{ color: "var(--green)" }}>
                {productSuccess?.emphasis}
              </em>
            </div>
            <p
              key={`msg-${productSuccess?.kicker}`}
              style={{
                margin: "12px 0 0",
                fontSize: 14,
                lineHeight: 1.55,
                color: "var(--ink-80)",
                fontFamily: '"Geist", sans-serif',
                animation: "success-fade-up 360ms ease-out 200ms both",
              }}
            >
              {productSuccess?.message}
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
            <AnimatedButton variant="primary" onClick={() => setProductSuccess(null)} text={t('admin.productSuccessModal.understood')} />
          </div>
        </div>
      </ModalOverlay>
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
