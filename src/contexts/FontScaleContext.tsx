import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

const STORAGE_KEY = 'settl-font-scale';
const MIN = 0.8;
const MAX = 1.4;
const STEP = 0.1;

interface FontScaleContextValue {
  scale: number;
  increase: () => void;
  decrease: () => void;
}

const FontScaleContext = createContext<FontScaleContextValue>({
  scale: 1,
  increase: () => {},
  decrease: () => {},
});

export function FontScaleProvider({ children }: { children: ReactNode }) {
  const [scale, setScale] = useState<number>(() => {
    const stored = parseFloat(localStorage.getItem(STORAGE_KEY) ?? '1');
    return isFinite(stored) ? Math.min(MAX, Math.max(MIN, stored)) : 1;
  });

  useEffect(() => {
    document.documentElement.style.fontSize = `${scale * 100}%`;
    localStorage.setItem(STORAGE_KEY, String(scale));
  }, [scale]);

  const increase = () => setScale(s => Math.min(MAX, parseFloat((s + STEP).toFixed(2))));
  const decrease = () => setScale(s => Math.max(MIN, parseFloat((s - STEP).toFixed(2))));

  return (
    <FontScaleContext.Provider value={{ scale, increase, decrease }}>
      {children}
    </FontScaleContext.Provider>
  );
}

export const useFontScale = () => useContext(FontScaleContext);
