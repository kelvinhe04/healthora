import { Icon } from './Icon';

interface StarsProps { value: number; size?: number; }

const FILLED = 'oklch(0.65 0.15 75)';
const EMPTY  = 'oklch(0.88 0.05 75)';

export function Stars({ value, size = 12 }: StarsProps) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 1, lineHeight: 0 }}>
      {[1, 2, 3, 4, 5].map((i) => {
        const fill = Math.min(1, Math.max(0, value - (i - 1)));
        return (
          <span key={i} style={{ position: 'relative', display: 'block', width: size, height: size, flexShrink: 0 }}>
            <Icon name="star" size={size} stroke={EMPTY} />
            {fill > 0 && (
              <span style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: `${fill * 100}%`, overflow: 'hidden', display: 'block' }}>
                <Icon name="star" size={size} stroke={FILLED} />
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
}
