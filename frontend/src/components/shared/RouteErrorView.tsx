import { useRouter, type ErrorComponentProps } from '@tanstack/react-router';
import { ErrorPage } from '../../pages/ErrorPage';

export function RouteErrorView({ error }: ErrorComponentProps) {
  const router = useRouter();

  console.error('[RouteError]', error);

  return (
    <ErrorPage
      code={500}
      title={
        <>
          Algo salió <em style={{ color: 'var(--coral)' }}>mal</em>
        </>
      }
      message="Ocurrió un error inesperado al cargar esta página. Puedes reintentar o volver al inicio."
      onHome={() => router.navigate({ to: '/' })}
      onRetry={() => router.invalidate()}
    />
  );
}
