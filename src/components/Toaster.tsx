'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/lib/format';

interface T { id: number; msg: string; kind: 'ok' | 'error' }

export default function Toaster() {
  const [items, setItems] = useState<T[]>([]);
  useEffect(() => {
    let n = 0;
    const h = (e: Event) => {
      const { msg, kind } = (e as CustomEvent).detail;
      const id = ++n;
      setItems((s) => [...s, { id, msg, kind }]);
      setTimeout(() => setItems((s) => s.filter((x) => x.id !== id)), kind === 'error' ? 6000 : 3000);
    };
    window.addEventListener('app-toast', h);
    return () => window.removeEventListener('app-toast', h);
  }, []);
  return (
    <div className="pointer-events-none fixed bottom-4 start-4 z-[60] flex flex-col gap-2" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={cn('pointer-events-auto flex items-center gap-2 rounded-lg px-4 py-3 text-sm text-white shadow-lg', t.kind === 'error' ? 'bg-red-600' : 'bg-navy')}>
          {t.kind === 'error' ? <XCircle size={16} /> : <CheckCircle2 size={16} />}
          {t.msg}
        </div>
      ))}
    </div>
  );
}
