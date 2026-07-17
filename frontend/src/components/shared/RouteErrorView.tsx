import { useRouter, type ErrorComponentProps } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { ErrorPage } from '../../pages/ErrorPage';

export function RouteErrorView({ error }: ErrorComponentProps) {
  const { t } = useTranslation();
  const router = useRouter();

  console.error('[RouteError]', error);

  return (
    <ErrorPage
      code={500}
      title={
        <>
          {t('errorPage.routeError.titlePrefix')} <em style={{ color: 'var(--coral)' }}>{t('errorPage.routeError.titleEmphasis')}</em>
        </>
      }
      message={t('errorPage.routeError.message')}
      onHome={() => router.navigate({ to: '/' })}
      onRetry={() => router.invalidate()}
    />
  );
}
