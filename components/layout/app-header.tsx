"use client"

import Image from "next/image"
import { useState, useEffect } from "react"
import { useTheme } from "next-themes"
import { Search, Sun, Moon, LogOut, User, Settings } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "../ui/dropdown-menu"

// Placeholder future identity (Entra ID integration later)
interface UserIdentity {
  id: string
  name: string
  email: string
  role: "consultant" | "administrator"
  avatarUrl?: string
}

const mockUser: UserIdentity = {
  id: "local-user",
  name: "John Kowalski",
  email: "john.kowalski@example.com",
  role: "consultant",
  avatarUrl: "/professional-avatar.png",
}

export function AppHeader() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [query, setQuery] = useState("")
  const [logoOk, setLogoOk] = useState(true)
  useEffect(() => setMounted(true), [])

  const user = mockUser // later: fetched from Entra ID / MS Graph

  return (
    <header
      className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/70 backdrop-blur-md backdrop-saturate-150 supports-[backdrop-filter]:bg-background/40 shadow-[0_4px_12px_-4px_rgb(0_0_0/0.08)] transition-colors"
    >
      <div className="flex h-16 items-center justify-between px-4 md:px-6">
        {/* Logo & Title */}
        <div className="flex items-center gap-3 select-none">
          <div className="flex h-8 w-8 items-center justify-center">
            {logoOk ? (
              <Image src="/developico-logo.png" alt="Developico" width={32} height={32} className="rounded-lg" priority onError={() => setLogoOk(false)} />
            ) : (
              <span className="text-[10px] font-extrabold tracking-tight text-primary">TT</span>
            )}
          </div>
          <div className="leading-tight">
            <h1 className="text-base sm:text-lg font-semibold tracking-tight">Timesheet</h1>
            <p className="text-[10px] sm:text-xs text-muted-foreground">Reporting</p>
          </div>
        </div>

        {/* Search (desktop) */}
  <div className="hidden md:block flex-1 max-w-md mx-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search..."
              className="pl-10"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search"
            />
          </div>
        </div>

        {/* Actions */}
  <div className="flex items-center gap-3">
          {mounted && (
            <Button
              variant="outline"
              size="icon"
              aria-label="Toggle theme"
              className="h-8 w-8"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-8 w-8 rounded-full" aria-label="User menu">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user.avatarUrl} alt={user.name} />
                  <AvatarFallback>{user.name.charAt(0) || <User className="h-4 w-4" />}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56" forceMount>
              <div className="flex flex-col space-y-1 p-2">
                <p className="text-sm font-medium leading-none">{user.name}</p>
                <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
                <div className="flex items-center gap-1 pt-1">
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Role:</span>
                  <Badge variant={user.role === "administrator" ? "destructive" : "secondary"} className="text-[10px] px-2 py-0.5 font-medium">
                    {user.role === "administrator" ? "Administrator" : "Consultant"}
                  </Badge>
                </div>
              </div>
              {user.role === "administrator" && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => { /* TODO: admin panel */ }}>
                    <Settings className="mr-2 h-4 w-4" /> Administration
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => { /* later profile modal */ }}>
                <User className="mr-2 h-4 w-4" /> Profile
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => { /* TODO: logout */ }} className="text-destructive">
                <LogOut className="mr-2 h-4 w-4" /> Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
