"use client";
import { SessionProvider } from 'next-auth/react';
import { AuthProvider } from '@/lib/auth-client';
import { ThemeProvider } from '@/components/theme-provider';
import { ReactNode, Suspense } from 'react';
import { ViewingScopeProvider } from '@/lib/viewing-scope';

export function ClientRoot({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={null}>
      <SessionProvider>
        <AuthProvider>
          <ViewingScopeProvider>
            <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
              {children}
            </ThemeProvider>
          </ViewingScopeProvider>
        </AuthProvider>
      </SessionProvider>
    </Suspense>
  );
}
