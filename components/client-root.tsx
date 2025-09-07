"use client";
import { SessionProvider } from 'next-auth/react';
import { AuthProvider } from '@/lib/auth-client';
import { ThemeProvider } from '@/components/theme-provider';
import { ReactNode, Suspense } from 'react';

export function ClientRoot({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={null}>
      <SessionProvider>
        <AuthProvider>
          <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
            {children}
          </ThemeProvider>
        </AuthProvider>
      </SessionProvider>
    </Suspense>
  );
}
