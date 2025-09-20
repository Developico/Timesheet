"use client";
import { signIn } from "next-auth/react";
import Image from "next/image";
import { LogIn, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface SignInScreenProps { productName?: string; }

export function SignInScreen({ productName = "Timesheet" }: SignInScreenProps) {
  const [loading, setLoading] = useState(false)
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-10 md:px-8">
      <div className="w-full max-w-md rounded-xl border bg-card/50 backdrop-blur-sm shadow-sm p-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
        <div className="flex flex-col items-center space-y-4 text-center">
          <div className="h-14 w-14 relative rounded-lg ring-1 ring-border/40 overflow-hidden shadow-sm bg-background">
            <Image src="/developico-logo.png" alt="Developico" fill className="object-contain p-2" priority />
          </div>
          <div className="space-y-1">
            <h1 className="text-xl md:text-2xl font-semibold tracking-tight">Welcome Back</h1>
            <p className="text-sm text-muted-foreground">Sign in to access {productName}</p>
          </div>
        </div>
        <div>
          <Button
            onClick={async () => {
              try {
                setLoading(true)
                await signIn("azure-ad")
              } finally {
                // If provider redirects immediately this won't be seen; if it doesn't, keep feedback until route changes
                setLoading(false)
              }
            }}
            className="w-full gap-2 bg-[#2563eb] hover:bg-[#1d4ed8] text-white transition-all duration-150 disabled:opacity-70 disabled:cursor-not-allowed shadow-sm hover:shadow active:translate-y-[1px]"
            size="lg"
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <LogIn className="h-4 w-4" />
            )}
            <span>{loading ? 'Signing in…' : 'Sign in with Microsoft'}</span>
          </Button>
        </div>
        <p className="text-[11px] text-center text-muted-foreground leading-relaxed">
          You agree to appropriate use and monitoring. Unauthorized users have no access.
        </p>
      </div>
    </div>
  );
}
