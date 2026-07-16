import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useClerk } from '@clerk/clerk-react';

export function SSOCallbackPage({ onSuccess }: { onSuccess: () => void }) {
  const { t } = useTranslation();
  const clerk = useClerk();

  useEffect(() => {
    if (!clerk) return;

    const handleCallback = async () => {
      try {
        await clerk.handleRedirectCallback({});
        onSuccess();
      } catch (err) {
        console.error('SSO callback error:', err);
      }
    };

    void handleCallback();
  }, [clerk, onSuccess]);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--cream)',
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: 48,
          height: 48,
          borderRadius: '50%',
          border: '3px solid var(--ink-12)',
          borderTopColor: 'var(--green)',
          animation: 'spin 1s linear infinite',
          margin: '0 auto 16px',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <p style={{
          fontFamily: '"Geist", sans-serif',
          fontSize: 16,
          color: 'var(--ink-60)',
        }}>
          {t('ssoCallback.processing')}
        </p>
      </div>
    </div>
  );
}