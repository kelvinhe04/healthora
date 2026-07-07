import { useQuery } from '@tanstack/react-query';
import { useClerk, useUser } from '@clerk/clerk-react';
import { AnimatedButton } from '../../components/shared/AnimatedButton';
import { Icon } from '../../components/shared/Icon';
import { api } from '../../lib/api';
import { AdminPanel } from './AdminPanel';
import { useAdminToken } from './hooks/useAdminToken';

export function AdminAccessGate({ onGoToStore }: { onGoToStore: () => void }) {
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
