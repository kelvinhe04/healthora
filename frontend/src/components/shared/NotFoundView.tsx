import { useRouter } from '@tanstack/react-router';
import { ErrorPage } from '../../pages/ErrorPage';

export function NotFoundView() {
  const router = useRouter();

  return (
    <ErrorPage
      code={404}
      title={
        <>
          Página <em style={{ color: 'var(--coral)' }}>no encontrada</em>
        </>
      }
      message="La página que buscas no existe o fue movida. Revisa la URL o vuelve al inicio."
      onHome={() => router.navigate({ to: '/' })}
      onCatalog={() => router.navigate({ to: '/catalog' })}
    />
  );
}
