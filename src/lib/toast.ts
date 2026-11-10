export type ToastKind = 'ok' | 'error';
export const toast = (msg: string, kind: ToastKind = 'ok') => {
  if (typeof window !== 'undefined')
    window.dispatchEvent(new CustomEvent('app-toast', { detail: { msg, kind } }));
};
