"use client"
import { useState, useMemo } from 'react'
import { UserX } from 'lucide-react'

export interface InactiveResolvedItem {
  t: { consultantId: string; hours: number; billable: number; nonBillable: number }
  c: { id: string; name: string; email?: string; avatarUrl?: string; isActive?: boolean } | undefined
}

interface InactiveMembersProps {
  items: InactiveResolvedItem[]
}

export function InactiveMembers({ items }: InactiveMembersProps) {
  const [open, setOpen] = useState(false)
  // Filter out any empty shells just in case (defensive)
  const safeItems = useMemo(() => items.filter(i => i && i.t && i.t.consultantId), [items])

  function computeInitials(name?: string) {
    if (!name) return ''
    return name.split(/\s+/).map(p => p[0]).filter(Boolean).slice(0,2).join('').toUpperCase()
  }
  if (safeItems.length === 0) return null

  return (
    <div className="pt-1">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
  className="group w-full text-left text-[10px] uppercase tracking-wide text-muted-token hover:text-foreground flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
        data-state={open ? 'open' : 'closed'}
  aria-controls="inactive-members-panel"
        id="inactive-members-trigger"
      >
        <span
          aria-hidden="true"
          className="inline-block transition-transform duration-200 text-[9px] translate-y-px group-data-[state=open]:rotate-90"
        >▶</span>
        <span className="font-medium tracking-wider">Inactive Accounts</span>
        <span className="ml-1 text-[9px] bg-muted/60 px-1 py-0.5 rounded-sm" aria-label={`${safeItems.length} inactive accounts`}>{safeItems.length}</span>
      </button>
      <div
        id="inactive-members-panel"
  className="mt-1 space-y-1 rounded-md border border-border/60 bg-[var(--surface)] dark:bg-[color:var(--surface-overlay)_/_70] shadow-sm p-2" // standardized background
        role="region"
        aria-labelledby="inactive-members-trigger"
        hidden={!open}
      >
        <ul role="list" className="space-y-1 m-0 p-0 list-none">
        {open && safeItems.map(({ t, c }) => {
            const name = c?.name || 'Unknown'
            const email = c?.email
            const initials = computeInitials(c?.name)
            const totalHrs = (t.hours || 0).toFixed(1)
            const billHrs = (t.billable || 0).toFixed(1)
            const nbHrs = (t.nonBillable || 0).toFixed(1)
            const title = `${name}${email ? ' ('+email+')' : ''}\nTotal: ${totalHrs}h • Billable: ${billHrs}h • Non: ${nbHrs}h`
            return (
              <li
                key={t.consultantId}
                className="flex items-center text-sm opacity-70 hover:opacity-90 transition focus-within:outline-none"
                aria-label={`Former member: ${name}`}
                title={title}
                role="listitem"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-6 h-6 rounded-full bg-gray-100 border border-border overflow-hidden shrink-0 flex items-center justify-center text-[10px] font-semibold text-muted-token">
                    {c?.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.avatarUrl} alt={name} className="w-6 h-6 object-cover grayscale" />
                    ) : initials ? (
                      <span>{initials}</span>
                    ) : (
                      <UserX className="h-4 w-4 text-muted-token" />
                    )}
                  </div>
                  <div className="truncate">
                    <div className="truncate text-xs font-medium flex items-center gap-1 text-muted-token">
                      {name}
                      <span className="text-[9px] px-1 py-0.5 rounded border border-border/60 bg-background/40 uppercase tracking-wide">Inactive</span>
                      <span className="ml-1 text-[9px] px-1 py-0.5 rounded bg-muted/40 text-muted-token" aria-label={`Godziny: ${totalHrs} (B ${billHrs} / NB ${nbHrs})`}>{totalHrs}h</span>
                    </div>
                    {email && <div className="text-[10px] text-muted-token opacity-80 truncate">{email}</div>}
                  </div>
                </div>
              </li>
            )
        })}
        </ul>
      </div>
    </div>
  )
}
