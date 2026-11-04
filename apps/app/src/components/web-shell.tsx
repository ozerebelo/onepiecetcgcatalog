import type { ReactNode } from 'react';

/** Native apps use their own tab bar and headers; the web shell (web-shell.web.tsx) is web-only. */
export function WebShell({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
