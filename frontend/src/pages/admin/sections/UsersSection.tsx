import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Card,
  PageHeader,
  Skeleton,
  StatusPill,
  tableStyle,
  td,
  th,
  trStyle,
  SortableTh,
  SortClearChip,
} from '../../../components/admin';
import { Icon } from '../../../components/shared/Icon';
import { PaginationControls } from '../components/PaginationControls';
import { useAdminPanelContext } from '../AdminPanelContext';
import type { UserSortKey } from '../hooks/useAdminPanel';
import { formatPanamaShortDate } from '../../../lib/dates';
import { formatCurrency } from '../../../lib/currency';

// Key suffixes under `admin.users.role.*` (HU-084) - module-level consts can't call t().
const ROLE_LABEL_KEYS: Record<string, string> = {
  owner: 'owner',
  admin: 'admin',
  customer: 'customer',
};

const ROLE_FILTER_OPTIONS: { value: '' | 'customer' | 'admin' | 'owner'; labelKey: string }[] = [
  { value: '', labelKey: 'all' },
  { value: 'customer', labelKey: 'customer' },
  { value: 'admin', labelKey: 'admin' },
  { value: 'owner', labelKey: 'owner' },
];

export function UsersSection() {
  const { t } = useTranslation();
  const USER_SORT_LABEL: Record<UserSortKey, string> = {
    orders: t('admin.users.table.columns.orders'),
    spend: t('admin.users.table.columns.spend'),
    registered: t('admin.users.table.columns.registered'),
  };
  const {
  access,
  showUsersSkeleton,
  customers,
  userSearch,
  setUserSearch,
  userRoleFilter,
  setUserRoleFilter,
  userRoleCounts,
  userSort,
  toggleUserSort,
  clearUserSort,
  displayedUsers,
  paginatedUsers,
  setUsersPage,
  roleMutation,
  } = useAdminPanelContext();
  const [confirmRoleChange, setConfirmRoleChange] = useState<{ id: string; nextRole: 'admin' | 'customer' } | null>(null);
  const [justUpdatedId, setJustUpdatedId] = useState<string | null>(null);
  // imageUrl is already the most reliable source the backend has (#314) - this is just a safety
  // net so a network hiccup falls back to initials instead of leaving the browser's broken-image
  // icon up.
  const [brokenAvatarIds, setBrokenAvatarIds] = useState<Set<string>>(new Set());
  const isOwnerViewer = access.role === 'owner';

  return (
    <>
          <>
            <style>{`@keyframes usersRoleSpin { to { transform: rotate(360deg); } }`}</style>
            <PageHeader
              loading={showUsersSkeleton}
              kicker={
                showUsersSkeleton
                  ? undefined
                  : t('admin.users.kicker', { count: customers.length })
              }
              title={
                <>
                  {t('admin.users.titlePrefix')} <em style={{ color: "var(--green)" }}>{t('admin.users.titleEmphasis')}</em>
                </>
              }
              sub={t('admin.users.sub')}
            />
            {!showUsersSkeleton && (
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
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder={t('admin.users.searchPlaceholder')}
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
                  {userSearch && (
                    <button
                      onClick={() => setUserSearch("")}
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
                    fontSize: 12,
                    fontFamily: '"Geist", sans-serif',
                    color: "var(--ink-60)",
                  }}
                >
                  {userSearch
                    ? t('admin.users.resultsCount', { count: displayedUsers.length, total: customers.length })
                    : t('admin.users.customersCount', { count: displayedUsers.length })}
                </div>
                <SortClearChip sort={userSort} labels={USER_SORT_LABEL} onClear={clearUserSort} />
              </div>
            )}
            {!showUsersSkeleton && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  marginBottom: 20,
                  flexWrap: "wrap",
                }}
              >
                <span
                  style={{
                    fontSize: 10,
                    fontFamily: '"JetBrains Mono", monospace',
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    color: "var(--ink-40)",
                    flexShrink: 0,
                    width: 48,
                  }}
                >
                  {t('admin.users.roleFilterLabel')}
                </span>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {ROLE_FILTER_OPTIONS.map((option) => (
                    <button
                      key={option.value || "all"}
                      onClick={() => { setUserRoleFilter(option.value); setUsersPage(1); }}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "7px 14px",
                        borderRadius: 999,
                        fontSize: 12,
                        cursor: "pointer",
                        border: "1px solid " + (userRoleFilter === option.value ? "var(--ink)" : "var(--ink-20)"),
                        background: userRoleFilter === option.value ? "var(--ink)" : "transparent",
                        color: userRoleFilter === option.value ? "var(--cream)" : "var(--ink)",
                        fontFamily: '"Geist", sans-serif',
                      }}
                    >
                      <span>{t(`admin.users.role.${option.labelKey}`)}</span>
                      <span
                        style={{
                          fontSize: 10,
                          fontFamily: '"JetBrains Mono", monospace',
                          opacity: userRoleFilter === option.value ? 0.8 : 0.6,
                        }}
                      >
                        {userRoleCounts[option.value] ?? 0}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
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
                    <th style={th}>{t('admin.users.table.columns.user')}</th>
                    <th style={th}>{t('admin.users.table.columns.role')}</th>
                    <SortableTh label={t('admin.users.table.columns.orders')} sortKey="orders" activeSort={userSort} onSort={toggleUserSort} />
                    <SortableTh label={t('admin.users.table.columns.spend')} sortKey="spend" activeSort={userSort} onSort={toggleUserSort} />
                    <SortableTh label={t('admin.users.table.columns.registered')} sortKey="registered" activeSort={userSort} onSort={toggleUserSort} />
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
                          {user.imageUrl && !brokenAvatarIds.has(user._id) ? (
                            <img
                              src={user.imageUrl}
                              alt={user.name || t('admin.users.table.defaultAvatarAlt')}
                              onError={() =>
                                setBrokenAvatarIds((prev) => new Set(prev).add(user._id))
                              }
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
                              {user.name || t('admin.users.table.noName')}
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
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span
                            style={{
                              display: "inline-flex",
                              borderRadius: 999,
                              padding: 2,
                              transition: "background-color 1.2s ease",
                              backgroundColor: justUpdatedId === user._id ? "color-mix(in oklch, var(--green) 25%, transparent)" : "transparent",
                            }}
                          >
                            <StatusPill
                              status={user.role || "customer"}
                              label={t(`admin.users.role.${ROLE_LABEL_KEYS[user.role || "customer"] ?? "customer"}`)}
                            />
                          </span>
                          {isOwnerViewer && user.role !== "owner" && (
                            confirmRoleChange?.id === user._id ? (
                              roleMutation.isPending ? (
                                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--ink-60)" }}>
                                  <span
                                    style={{
                                      width: 12,
                                      height: 12,
                                      borderRadius: "50%",
                                      border: "2px solid var(--ink-12)",
                                      borderTopColor: "var(--green)",
                                      animation: "usersRoleSpin 0.7s linear infinite",
                                    }}
                                  />
                                  {t('admin.users.saving')}
                                </span>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const nextRole = confirmRoleChange.nextRole;
                                      roleMutation.mutate(
                                        { id: user._id, role: nextRole },
                                        {
                                          onSuccess: () => {
                                            setConfirmRoleChange(null);
                                            setJustUpdatedId(user._id);
                                            setTimeout(
                                              () => setJustUpdatedId((current) => (current === user._id ? null : current)),
                                              1500,
                                            );
                                          },
                                          onError: () => setConfirmRoleChange(null),
                                        },
                                      );
                                    }}
                                    style={{ background: "var(--green)", border: "none", borderRadius: 8, padding: "6px 10px", cursor: "pointer", color: "var(--lime)", fontSize: 12 }}
                                  >
                                    {t('admin.users.confirm')}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmRoleChange(null)}
                                    style={{ background: "transparent", border: "1px solid var(--ink-12)", borderRadius: 8, padding: "6px 10px", cursor: "pointer", color: "var(--ink-60)", fontSize: 12 }}
                                  >
                                    {t('admin.users.cancel')}
                                  </button>
                                </>
                              )
                            ) : (
                              <button
                                type="button"
                                onClick={() =>
                                  setConfirmRoleChange({
                                    id: user._id,
                                    nextRole: user.role === "admin" ? "customer" : "admin",
                                  })
                                }
                                style={{ background: "transparent", border: "1px solid var(--ink-12)", borderRadius: 8, padding: "6px 10px", cursor: "pointer", color: "var(--ink-60)", fontSize: 12 }}
                              >
                                {user.role === "admin" ? t('admin.users.removeAdmin') : t('admin.users.makeAdmin')}
                              </button>
                            )
                          )}
                        </div>
                        {roleMutation.isError && confirmRoleChange === null && roleMutation.variables?.id === user._id && (
                          <div style={{ fontSize: 11, color: "var(--coral)", marginTop: 4 }}>
                            {roleMutation.error?.message || t('admin.users.roleChangeError')}
                          </div>
                        )}
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
                        {formatCurrency(user.ltv ?? 0)}
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
                          ? formatPanamaShortDate(user.createdAt)
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
                totalItems={displayedUsers.length}
                start={paginatedUsers.start}
                end={paginatedUsers.end}
                onPageChange={setUsersPage}
              />
            </Card>
          </>
    </>
  );
}
