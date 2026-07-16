import { useRouter } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { ErrorPage } from '../../pages/ErrorPage';

export function NotFoundView() {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <ErrorPage
      code={404}
      title={
        <>
          {t('errorPage.notFound.titlePrefix')} <em style={{ color: 'var(--coral)' }}>{t('errorPage.notFound.titleEmphasis')}</em>
        </>
      }
      message={t('errorPage.notFound.message')}
      onHome={() => router.navigate({ to: '/' })}
      onCatalog={() => router.navigate({ to: '/catalog' })}
    />
  );
}
