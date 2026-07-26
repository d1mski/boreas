import { useEffect, useRef, useState, type ReactNode } from 'react';

const PEEK_VISIBLE = 190; // px of sheet shown when peeking

export function MobileSheet({ hasLocation, children }: { hasLocation: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [h, setH] = useState(0);                 // measured sheet height (px)
  const [pos, setPos] = useState<'hidden' | 'peek' | 'full'>('hidden');
  const [y, setY] = useState(0);                 // current translateY (px)
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ startY: number; startTrans: number; moved: number } | null>(null);

  const targetY = (p: typeof pos, height: number) =>
    p === 'full' ? 0 : p === 'peek' ? Math.max(height - PEEK_VISIBLE, 0) : height;

  // measure height
  useEffect(() => {
    const measure = () => ref.current && setH(ref.current.offsetHeight);
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  // appear on first location, hide when cleared
  useEffect(() => {
    setPos(prev => (hasLocation ? (prev === 'hidden' ? 'peek' : prev) : 'hidden'));
  }, [hasLocation]);

  // settle to snap target when not dragging
  useEffect(() => { if (!dragging && h) setY(targetY(pos, h)); }, [pos, h, dragging]);

  // Tapping a webcam map marker should reveal the player — slide the sheet fully up.
  // 'settl-webcam-select' fires only from map markers (panel clicks don't dispatch it).
  useEffect(() => {
    const handler = () => setPos('full');
    window.addEventListener('settl-webcam-select', handler);
    return () => window.removeEventListener('settl-webcam-select', handler);
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    drag.current = { startY: e.clientY, startTrans: y, moved: 0 };
    setDragging(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const dy = e.clientY - drag.current.startY;
    drag.current.moved = Math.max(drag.current.moved, Math.abs(dy));
    setY(Math.min(Math.max(drag.current.startTrans + dy, 0), h));
  };
  const onPointerUp = () => {
    if (!drag.current) return;
    const tapped = drag.current.moved < 6;
    drag.current = null;
    setDragging(false);
    if (tapped) { setPos(p => (p === 'full' ? 'peek' : 'full')); return; }
    const peekY = targetY('peek', h);
    setPos(y < peekY / 2 ? 'full' : 'peek');     // snap to nearest
  };

  return (
    <div
      ref={ref}
      className="md:hidden fixed inset-x-0 bottom-0 z-40 h-[92dvh] flex flex-col bg-panel border-t border-edge-bright/70 rounded-t-[20px] shadow-[0_-12px_40px_rgb(var(--c-void)/0.7)]"
      style={{ transform: `translateY(${y}px)`, transition: dragging ? 'none' : 'transform 320ms cubic-bezier(0.32,0.72,0,1)' }}
    >
      <div
        className="flex-none flex justify-center py-2.5 cursor-grab touch-none active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <div className="w-11 h-1 rounded-full bg-edge-bright" />
      </div>
      <div className="flex-1 min-h-0 flex flex-col">{children}</div>
    </div>
  );
}
