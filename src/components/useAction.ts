'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { toast } from '@/lib/toast';
import type { Res } from '@/lib/action';

/** מריץ Server Action, מציג הודעה ומרענן את הדף */
export function useAction() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = <T,>(fn: () => Promise<Res<T>>, opts?: { ok?: string; onDone?: (data?: T) => void; refresh?: boolean }) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) return toast(r.error, 'error');
      if (opts?.ok) toast(opts.ok);
      if (opts?.refresh !== false) router.refresh();
      opts?.onDone?.(r.data);
    });
  return { run, pending, router };
}
