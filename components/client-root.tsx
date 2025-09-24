"use client";
import { SessionProvider } from 'next-auth/react';
import { AuthProvider } from '@/lib/auth-client';
import { ThemeProvider } from '@/components/theme-provider';
import { ReactNode, Suspense, useEffect } from 'react';
import { prime } from '@/lib/client-cache';
import { ViewingScopeProvider } from '@/lib/viewing-scope';
import { usePreventFocusAnimations } from '@/hooks/use-prevent-focus-animations';

export function ClientRoot({ children }: { children: ReactNode }) {
  // Suppress animations during window focus changes
  usePreventFocusAnimations();
  
  // Simple prefetch (fire-and-forget). We don't block rendering.
  useEffect(() => {
    let cancelled = false;
    // Fetch projects & consultants in parallel only if running in browser
    (async () => {
      try {
        const [pRes, cRes] = await Promise.all([
          fetch('/api/dataverse/projects').catch(()=>null),
          fetch('/api/dataverse/consultants').catch(()=>null)
        ]);
        if (!cancelled) {
          if (pRes && pRes.ok) {
            pRes.json().then(json => {
              const value = Array.isArray(json?.value) ? json.value : [];
              prime('projects:v1', value, { ttlMs: 15*60_000, staleWindowMs: 2*60*60_000 });
            });
          }
          if (cRes && cRes.ok) {
            cRes.json().then(json => {
              const value = Array.isArray(json?.value) ? json.value : [];
              prime('consultants:v1', value, { ttlMs: 15*60_000, staleWindowMs: 2*60*60_000 });
            });
          }
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []);
  return (
    <Suspense fallback={null}>
      <SessionProvider>
        <AuthProvider>
          <ViewingScopeProvider>
            <ThemeProvider 
              attribute="class" 
              defaultTheme="light" 
              enableSystem={false}
              disableTransitionOnChange={true}
              themes={['light', 'dark']}
              storageKey="tt-theme"
            >
              {children}
            </ThemeProvider>
          </ViewingScopeProvider>
        </AuthProvider>
      </SessionProvider>
    </Suspense>
  );
}
