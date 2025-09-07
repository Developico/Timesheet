'use client'

import * as React from 'react'
import { ThemeProvider as NextThemesProvider, type ThemeProviderProps } from 'next-themes'

interface ThemeProviderWrapperProps extends ThemeProviderProps {
  children: React.ReactNode
}

export function ThemeProvider({ children, ...props }: ThemeProviderWrapperProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}
