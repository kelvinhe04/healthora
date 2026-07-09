import {
  Card,
  PageHeader,
  Skeleton,
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

const USER_SORT_LABEL: Record<UserSortKey, string> = {
  orders: 'Órdenes',
  spend: 'Gasto total',
  registered: 'Registro',
};

export function UsersSection() {
  const {
  showUsersSkeleton,
  customers,
  userSearch,
  setUserSearch,
  userSort,
  toggleUserSort,
  clearUserSort,
  displayedUsers,
  paginatedUsers,
  setUsersPage,
  } = useAdminPanelContext();

  return (
    <>
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
                    placeholder="Buscar por nombre o email…"
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
                    ? `${displayedUsers.length} resultado${displayedUsers.length !== 1 ? "s" : ""} de ${customers.length}`
                    : `${displayedUsers.length} cliente${displayedUsers.length !== 1 ? "s" : ""}`}
                </div>
                <SortClearChip sort={userSort} labels={USER_SORT_LABEL} onClear={clearUserSort} />
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
                    <th style={th}>Usuario</th>
                    <th style={th}>Rol</th>
                    <SortableTh label="Órdenes" sortKey="orders" activeSort={userSort} onSort={toggleUserSort} />
                    <SortableTh label="Gasto total" sortKey="spend" activeSort={userSort} onSort={toggleUserSort} />
                    <SortableTh label="Registro" sortKey="registered" activeSort={userSort} onSort={toggleUserSort} />
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
