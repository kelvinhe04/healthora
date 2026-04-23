import { Icon } from './Icon';

interface StarsProps { value: number; size?: number; }

export function Stars({ value, size = 12 }: StarsProps) {
  return (
    <span style={{ display: 'inline-flex', gap: 1, color: 'oklch(0.65 0.15 75)' }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} style={{ opacity: i <= Math.round(value) ? 1 : 0.25 }}>
          <Icon name="star" size={size} />
        </span>
      ))}
    </span>
  );
}
