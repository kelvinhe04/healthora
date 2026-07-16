import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { AnimatedButton } from "../components/shared/AnimatedButton";
import { Icon } from "../components/shared/Icon";
import { useBreakpoint } from "../hooks/useBreakpoint";

interface ErrorPageProps {
  code: 404 | 500;
  title: ReactNode;
  message: string;
  onHome: () => void;
  onCatalog?: () => void;
  onRetry?: () => void;
  extra?: ReactNode;
}

export function ErrorPage({
  code,
  title,
  message,
  onHome,
  onCatalog,
  onRetry,
  extra,
}: ErrorPageProps) {
  const { t } = useTranslation();
  const bp = useBreakpoint();
  const isMobile = bp === "mobile";

  return (
    <div
      role="alert"
      aria-live="polite"
      style={{
        padding: isMobile ? "48px 16px 80px" : "72px 40px 96px",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div style={{ maxWidth: 560, width: "100%", textAlign: "center" }}>
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: 999,
            background: code === 404 ? "var(--cream-2)" : "color-mix(in srgb, var(--coral) 12%, var(--cream))",
            border: `1px solid ${code === 404 ? "var(--ink-06)" : "color-mix(in srgb, var(--coral) 30%, transparent)"}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 28px",
            color: code === 404 ? "var(--ink-60)" : "var(--coral)",
          }}
        >
          <Icon name={code === 404 ? "search" : "alert-circle"} size={34} />
        </div>

        <div
          style={{
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: 11,
            color: "var(--ink-60)",
            letterSpacing: "0.12em",
            marginBottom: 12,
          }}
        >
          {t('errorPage.errorCode', { code })}
        </div>

        <h1
          style={{
            fontFamily: '"Instrument Serif", serif',
            fontSize: isMobile ? 44 : 64,
            letterSpacing: "-0.035em",
            lineHeight: 0.98,
            margin: "0 0 16px",
            color: "var(--ink)",
            fontWeight: 400,
          }}
        >
          {title}
        </h1>

        <p
          style={{
            fontSize: 16,
            lineHeight: 1.6,
            color: "var(--ink-80)",
            marginBottom: 28,
            fontFamily: '"Geist", sans-serif',
          }}
        >
          {message}
        </p>

        {extra}

        <div
          style={{
            display: "flex",
            gap: 10,
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          <AnimatedButton variant="primary" onClick={onHome} text={t('errorPage.goHome')} />
          {onCatalog && (
            <AnimatedButton
              variant="outline"
              onClick={onCatalog}
              text={t('errorPage.viewCatalog')}
            />
          )}
          {onRetry && (
            <AnimatedButton variant="outline" onClick={onRetry} text={t('errorPage.retry')} />
          )}
        </div>
      </div>
    </div>
  );
}
