import { useEffect, useRef } from 'react';

const RING = 36;
const RING_HOVER = 60;
const DOT = 5;
const SPEED = 0.17;
const TARGET_HOVER = RING_HOVER / RING; // scale factor ≈ 1.67
const TRAIL_LENGTH = 20;
const TRAIL_DOT_SIZE = 6;

const isClickable = (el: EventTarget | null): boolean => {
  const node = el as HTMLElement | null;
  if (!node) return false;
  try {
    if (window.getComputedStyle(node).cursor === 'pointer') return true;
  } catch { /* noop */ }
  let cur: HTMLElement | null = node;
  for (let i = 0; i < 5 && cur && cur !== document.body; i++, cur = cur.parentElement) {
    const tag = cur.tagName?.toLowerCase() ?? '';
    if (['button', 'a', 'input', 'select', 'textarea'].includes(tag)) return true;
    if (cur.getAttribute?.('role') === 'button') return true;
    if (cur.style?.cursor === 'pointer') return true;
  }
  return false;
};

export function CustomCursor() {
  const ringRef = useRef<HTMLDivElement>(null);
  const dotRef  = useRef<HTMLDivElement>(null);
  const trailRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const ring = ringRef.current;
    const dot  = dotRef.current;
    if (!ring || !dot) return;

    const mouse = { x: -200, y: -200 };
    const prev  = { x: -200, y: -200 };
    const pos   = { x: -200, y: -200 };
    let squeeze     = 0;
    let angle       = 0;
    let sizeScale   = 1;
    let targetScale = 1;
    let raf: number;

    const trailPositions = Array.from({ length: TRAIL_LENGTH }, () => ({ x: -200, y: -200 }));

    const onMove = (e: MouseEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      dot.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
      targetScale = isClickable(e.target) ? TARGET_HOVER : 1;
    };

    window.addEventListener('mousemove', onMove);

    const tick = () => {
      // smooth follow
      pos.x += (mouse.x - pos.x) * SPEED;
      pos.y += (mouse.y - pos.y) * SPEED;

      // velocity → squeeze
      const dx = mouse.x - prev.x;
      const dy = mouse.y - prev.y;
      prev.x = mouse.x;
      prev.y = mouse.y;
      const vel = Math.min(Math.sqrt(dx * dx + dy * dy) * 4, 150);
      squeeze += ((vel / 150) * 0.75 - squeeze) * SPEED;

      // angle (suppress jitter at low speed)
      if (vel > 20) angle = Math.atan2(dy, dx) * 180 / Math.PI;

      // hover size — interpolated every frame so it's smooth even when mouse is still
      sizeScale += (targetScale - sizeScale) * 0.12;

      // border thins as ring grows: 1.5px → 0.5px
      const t = (sizeScale - 1) / (TARGET_HOVER - 1);
      ring.style.borderWidth = `${Math.max(0.5, 1.5 - t)}px`;

      ring.style.transform = `translate(${pos.x}px, ${pos.y}px) rotate(${angle}deg) scale(${sizeScale * (1 + squeeze)}, ${sizeScale * (1 - squeeze)})`;

      // Trail follow logic
      let currX = mouse.x;
      let currY = mouse.y;
      for (let i = 0; i < TRAIL_LENGTH; i++) {
        // By using a higher factor like 0.45, the dots keep up better, 
        // but because there are 20 dots and they are a bit bigger, the trail is very noticeable.
        trailPositions[i].x += (currX - trailPositions[i].x) * 0.45;
        trailPositions[i].y += (currY - trailPositions[i].y) * 0.45;
        currX = trailPositions[i].x;
        currY = trailPositions[i].y;

        const el = trailRefs.current[i];
        if (el) {
          const scale = 1 - (i / TRAIL_LENGTH);
          el.style.transform = `translate(${trailPositions[i].x}px, ${trailPositions[i].y}px) scale(${scale})`;
        }
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener('mousemove', onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <>
      <style>{`@media (pointer: fine) { * { cursor: none !important; } }`}</style>

      {/* Trail */}
      {Array.from({ length: TRAIL_LENGTH }).map((_, i) => (
        <div
          key={i}
          ref={(el) => (trailRefs.current[i] = el)}
          style={{
            position: 'fixed', zIndex: 99998, pointerEvents: 'none',
            width: TRAIL_DOT_SIZE, height: TRAIL_DOT_SIZE,
            top: -(TRAIL_DOT_SIZE / 2), left: -(TRAIL_DOT_SIZE / 2),
            background: 'white',
            borderRadius: '50%',
            mixBlendMode: 'difference',
            willChange: 'transform',
          }}
        />
      ))}

      {/* Ring — white + mix-blend-mode:difference inverts against any background */}
      <div
        ref={ringRef}
        style={{
          position: 'fixed', zIndex: 99999, pointerEvents: 'none',
          width: RING, height: RING,
          top: -(RING / 2), left: -(RING / 2),
          border: '1.5px solid white', // initial value, overwritten each frame
          borderRadius: '50%',
          mixBlendMode: 'difference',
          willChange: 'transform',
        }}
      />

      {/* Dot — same blend mode */}
      <div
        ref={dotRef}
        style={{
          position: 'fixed', zIndex: 99999, pointerEvents: 'none',
          width: DOT, height: DOT,
          top: -(DOT / 2), left: -(DOT / 2),
          background: 'white',
          borderRadius: '50%',
          mixBlendMode: 'difference',
          willChange: 'transform',
        }}
      />
    </>
  );
}