"use client";
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useSession, signOut } from 'next-auth/react';

interface AppUser { id: string; name: string; email: string; role: string; roles: string[]; avatar?: string; }
interface AuthCtx { user: AppUser | null; isLoading: boolean; logout: () => void; hasPermission: (action: string) => boolean; }
const AuthContext = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();
  const [user, setUser] = useState<AppUser | null>(null);
  const loading = status === 'loading';

  useEffect(()=>{
    if (loading) return;
    if (session?.user){
      const su = session.user as Record<string, unknown>;
      const role = typeof su.role === 'string' ? su.role : 'Unauthorized';
      const rawRoles = su.roles;
      const roles = Array.isArray(rawRoles) ? (rawRoles.filter(r=> typeof r === 'string') as string[]) : [role];
      const baseUser: AppUser = {
        id: typeof su.id === 'string' ? su.id : '',
        name: typeof session.user.name === 'string' ? session.user.name : '',
        email: typeof session.user.email === 'string' ? session.user.email : '',
        role,
        roles,
        avatar: typeof su.image === 'string' ? su.image : '/placeholder.svg'
      };
      setUser(baseUser);
      // Attempt to fetch Graph photo (fire and forget)
      fetch('/api/me/photo').then(async r => {
        if (r.ok && r.status === 200) {
          const blob = await r.blob();
            const url = URL.createObjectURL(blob);
            setUser(u => u ? { ...u, avatar: url } : u);
        }
      }).catch(()=>{});
    } else setUser(null);
  }, [session, loading]);

  const hasPermission = (action: string) => {
    const r = user?.role;
    switch(action){
      case 'read': return r === 'Consultant' || r === 'Administrator';
      case 'create':
      case 'update': return r === 'Consultant' || r === 'Administrator';
      case 'delete':
      case 'admin': return r === 'Administrator';
      default: return false;
    }
  };

  return <AuthContext.Provider value={{ user, isLoading: loading, logout: ()=>signOut(), hasPermission }}>{children}</AuthContext.Provider>;
}

export function useAuth(){ const ctx=useContext(AuthContext); if(!ctx) throw new Error('useAuth must be used within AuthProvider'); return ctx; }
