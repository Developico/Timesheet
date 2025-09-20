"use client"

import Image from "next/image"
import { useState, useEffect } from "react"
import { useTheme } from "next-themes"
import { Search, Sun, Moon, LogOut, User, Sparkles, SlidersHorizontal } from "lucide-react"
import { useNewProjects } from "@/lib/use-new-projects"
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

import { useAuth } from "@/lib/auth-client"
import Link from "next/link"
import { useFilters } from "@/lib/filter-context"

export function AppHeader() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  // Try to access global filters if provider is mounted; fallback to local state otherwise
  let filterCtx: ReturnType<typeof useFilters> | null = null
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    filterCtx = useFilters()
  } catch { /* Header can render outside provider on sign-in screen */ }
  const [localQuery, setLocalQuery] = useState("")
  const query = filterCtx?.filters.searchQuery ?? localQuery
  const [logoOk, setLogoOk] = useState(true)
  useEffect(() => setMounted(true), [])

  const { user, isLoading, logout } = useAuth()
  const { newProjects } = useNewProjects()
  const [openNew, setOpenNew] = useState(false)
  // Ensure popover is closed if there are no new projects
  useEffect(()=>{ if(newProjects.length===0 && openNew) setOpenNew(false) }, [newProjects.length, openNew])

  return (
    <header
      className="sticky top-2 z-50 w-full bg-transparent transition-[padding,background] mb-4"
    >
      <div className="h-16 w-full flex items-center justify-between rounded-xl border border-border/60 bg-background/80 backdrop-blur-md backdrop-saturate-150 shadow-sm px-4 md:px-6 supports-[backdrop-filter]:bg-background/60">
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
            <p className="text-[10px] sm:text-xs text-muted-token">Reporting</p>
          </div>
        </div>

    {/* Search (desktop) */}
  <div className="hidden md:block flex-1 max-w-md mx-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-token" />
            <Input
              placeholder="Search projects… (client, code, name, description)"
              className="pl-10"
              value={query}
              onChange={(e) => {
                const val = e.target.value
                // Tiny debounce via microtask to avoid excessive updates when typing
                queueMicrotask(() => {
                  if (filterCtx) {
                    filterCtx.updateFilter('searchQuery', val)
                  } else {
                    setLocalQuery(val)
                  }
                })
              }}
              aria-label="Search"
            />
          </div>
        </div>

        {/* Actions */}
  <div className="flex items-center gap-3 relative">
          {/* Mobile Options trigger (dispatch custom event, identical pattern to dvlp-snippets) */}
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Options"
            className="h-8 w-8 md:hidden"
            onClick={()=>{
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('tt:open-options'))
                // Also emit snippets-compatible event name for parity
                window.dispatchEvent(new CustomEvent('snippetlib:open-options'))
              }
            }}
            title="Open options"
          >
            <SlidersHorizontal className="h-4 w-4" />
          </Button>
          {newProjects.length>0 && (
            <div className="relative">
              <Button
                variant="outline"
                size="icon"
                aria-label="New project assignments"
                className={`h-8 w-8 ${openNew? 'bg-muted':''}`}
                onClick={()=>setOpenNew(o=>!o)}
              >
                <Sparkles className="h-4 w-4" />
                <span className="absolute -top-1 -right-1 min-w-[18px] h-5 rounded-full bg-[#6eedd9] text-[10px] font-semibold flex items-center justify-center text-black px-1">
                  {newProjects.length}
                </span>
              </Button>
              {openNew && (
                <div className="absolute right-0 mt-2 w-64 rounded-lg border bg-[var(--surface-overlay)] text-[var(--text-primary)] shadow-lg p-3 z-50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium tracking-wide">New Projects</span>
                    <button onClick={()=>setOpenNew(false)} className="text-xs text-muted-token hover:text-foreground">✕</button>
                  </div>
                  <ul className="space-y-2 max-h-56 overflow-auto">
                    {newProjects.map(p=> {
                      // Semantic coloring: absence (code ABS or name contains absence) pink, billable aqua, else navy
                      const isAbs = p.id === 'Office.Absences' || p.code === 'ABS' || p.name?.toLowerCase().includes('absence')
                      const dotColor = isAbs ? '#e03768' : p.billable ? '#6eedd9' : '#174076'
                      return (
                      <li key={p.id} className="flex items-center gap-2 text-xs">
                        <span className={`w-2 h-2 rounded-full ${dotColor==='#e03768'?'bg-[#e03768]':dotColor==='#6eedd9'?'bg-[#6eedd9]':dotColor==='#174076'?'bg-[#174076]':'bg-gray-400'}`} />
                        <button
                          className="font-mono underline decoration-dotted hover:text-foreground"
                          onClick={()=>{
                            // Dispatch global events to change tab & open panel
                            window.dispatchEvent(new CustomEvent('ts:setActiveTab', { detail: { tab: 'projects' }}));
                            window.dispatchEvent(new CustomEvent('ts:openProject', { detail: { projectId: p.id }}));
                            setOpenNew(false);
                          }}
                        >{p.code}</button>
                        <button
                          className="ml-auto px-1 py-0.5 border rounded hover:bg-muted"
                          onClick={()=>{navigator.clipboard?.writeText(p.code || '').catch(()=>{});}}
                          title="Copy code"
                        >Copy</button>
                      </li>
                    )})}
                  </ul>
                </div>
              )}
            </div>
          )}
          {mounted && (
            <Button
              variant="outline"
              size="icon"
              aria-label="Toggle theme"
              className="h-8 w-8 hidden md:inline-flex"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              title="Toggle theme"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          )}
          {!isLoading && user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full" aria-label="User menu">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user.avatar || "/placeholder.svg"} alt={user.name} />
                    <AvatarFallback>{user.name?.charAt(0) || <User className="h-4 w-4" />}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56" forceMount>
                <div className="flex flex-col space-y-1 p-2">
                  <p className="text-sm font-medium leading-none">{user.name}</p>
                  <p className="text-xs leading-none text-muted-token">{user.email}</p>
                  <div className="flex items-center gap-1 pt-1">
                    <span className="text-[10px] uppercase tracking-wide text-muted-token">Role:</span>
                    {user.role === "Administrator" ? (
                      <Badge className="text-[10px] px-2 py-0.5 font-medium border-transparent bg-[#e03768] text-white">
                        {user.role}
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px] px-2 py-0.5 font-medium">
                        {user.role}
                      </Badge>
                    )}
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <a
                    href="https://myaccount.microsoft.com/?ref=MeControl"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center"
                  >
                    <User className="mr-2 h-4 w-4" /> Profile
                  </a>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => logout()} className="text-destructive">
                  <LogOut className="mr-2 h-4 w-4" /> Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {!isLoading && !user && (
            <Button asChild variant="outline" size="sm">
              <Link href="/api/auth/signin">Sign in</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}
