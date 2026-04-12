import type React from "react"
import { Inter } from "next/font/google"
import { ClientRoot } from "@/components/client-root"
import { Toaster } from "@/components/ui/toaster"
import { Suspense } from "react"
import { ConsultantDock } from "@/components/admin/consultant-dock"
import { ErrorBoundary } from "@/components/error-boundary"
import "./globals.css"
import { metadata } from "./metadata"; // Import metadata from the new file

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
})

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`font-sans ${inter.variable}`}>
        <ErrorBoundary>
          <ClientRoot>
            {/* Global centered width wrapper */}
            <div className="mx-auto w-full max-w-[1600px] px-4 xl:px-8">{children}</div>
            <ConsultantDock />
            <Toaster />
          </ClientRoot>
        </ErrorBoundary>
        {/* Analytics component removed to fix import error */}
      </body>
    </html>
  )
}
