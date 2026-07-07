export function SkipToContent({ targetId = 'main-content' }: { targetId?: string }) {
  return (
    <a href={`#${targetId}`} className="skip-link">
      Saltar al contenido principal
    </a>
  );
}
