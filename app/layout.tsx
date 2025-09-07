import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { ClientRoot } from "@/components/client-root"
import { Suspense } from "react"
import "./globals.css"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
})

export const metadata: Metadata = {
  title: "Developico Timesheet",
  description: "Professional timesheet application for tracking work hours and projects",
  generator: "v0.app",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`font-sans ${inter.variable}`}>
  <ClientRoot>{children}</ClientRoot>
        {/* Analytics component removed to fix import error */}
      </body>
    </html>
  )
}
