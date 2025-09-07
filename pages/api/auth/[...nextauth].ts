import NextAuth, { type NextAuthOptions } from 'next-auth';
import AzureADProvider from 'next-auth/providers/azure-ad';
import type { JWT } from 'next-auth/jwt';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { vsSet } from '@/lib/volatile-store';

// Group-claim strategy (groups in id_token) -> only need openid+profile+email+offline_access scope (optionally custom app scope)
const LOG_MODE = (process.env.LOG_MODE || (process.env.NODE_ENV === 'production' ? 'console':'file')).toLowerCase();
const logFilePath = path.join(process.cwd(), 'nextauth-debug.log');
function logDebug(msg: string, data?: unknown){ try { const line = `[${new Date().toISOString()}] ${msg}${data? ' '+JSON.stringify(data): ''}`; if (LOG_MODE==='file' && process.env.NODE_ENV!=='production') fs.appendFileSync(logFilePath,line+'\n'); else if (LOG_MODE!=='silent' && process.env.NODE_ENV!=='production') console.debug(line); } catch {} }

function normalizeAppScope(raw: string | undefined){ const val=(raw||'').trim(); if(!val) return null; const needs=/^api:\/\/[0-9a-f-]+\/?$/i.test(val); const base=val.replace(/\/$/,''); return needs? `${base}/access_as_user`: val; }

const rawSecret = (process.env.NEXTAUTH_SECRET || '').trim();
if (!rawSecret) logDebug('WARNING: NEXTAUTH_SECRET missing or empty');
logDebug('Auth env summary', {
  hasClientId: !!process.env.AZURE_AD_CLIENT_ID,
  hasTenant: !!process.env.AZURE_AD_TENANT_ID,
  hasSecret: !!rawSecret,
  appScopeSet: !!process.env.AZURE_AD_APP_SCOPE,
  adminGroupSet: !!process.env.NEXT_PUBLIC_ADMIN_GROUP,
  consultantGroupSet: !!process.env.NEXT_PUBLIC_CONSULTANT_GROUP
});

const tenantIdForUrl = process.env.AZURE_AD_TENANT_ID || 'common';

export const authOptions: NextAuthOptions = {
  providers: [
    AzureADProvider({
      clientId: process.env.AZURE_AD_CLIENT_ID!,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
      tenantId: process.env.AZURE_AD_TENANT_ID!,
      authorization: {
        url: `https://login.microsoftonline.com/${tenantIdForUrl}/oauth2/v2.0/authorize`,
        params: {
          scope: (()=>{ const appScope=normalizeAppScope(process.env.AZURE_AD_APP_SCOPE); return `openid profile email offline_access${appScope? ' '+appScope: ''}`; })(),
          prompt: 'select_account'
        }
      }
    })
  ],
  secret: rawSecret || undefined,
  debug: process.env.NODE_ENV !== 'production',
  callbacks: {
    async jwt({ token, account, profile, user }) {
      if (account) {
        logDebug('JWT callback account present', { provider: account.provider, hasIdToken: !!account.id_token, hasAccess: !!account.access_token });
      }
      if (account?.access_token) {
        const key = crypto.randomBytes(12).toString('base64url');
        const now = Math.floor(Date.now()/1000);
        const exp = (account.expires_at && typeof account.expires_at==='number') ? account.expires_at : now+3600;
        vsSet(key, account.access_token, exp, true);
        (token as any).aad_obo_key = key;
      }
      if (account?.refresh_token) {
        const rtKey = crypto.randomBytes(12).toString('base64url');
        const now = Math.floor(Date.now()/1000);
        vsSet(rtKey, account.refresh_token, now + 60*60*24*30, true);
        (token as any).aad_rt_key = rtKey;
      }
      // Roles from group claims (id_token) only computed on fresh OAuth callback (when account present)
      // Preserve previously computed roles on silent subsequent jwt callbacks.
      const existingRoles: string[] | undefined = (token as any).roles;
      if (!account) {
        if (existingRoles && existingRoles.length) {
          // Nothing to recompute
          logDebug('JWT reuse existing roles', { roles: existingRoles });
          return token as JWT;
        }
      }
      let resolvedGroups: string[] = [];
      try {
        if (account?.id_token) {
          const parts = account.id_token.split('.');
          if (parts.length >= 2) {
            const b = parts[1].replace(/-/g, '+').replace(/_/g, '/');
            const pad = b.length % 4 === 2 ? '==' : b.length % 4 === 3 ? '=' : '';
            const json = Buffer.from(b + pad, 'base64').toString();
            const payload = JSON.parse(json);
            if (Array.isArray(payload.groups)) resolvedGroups = payload.groups;
          }
        }
      } catch (e) { logDebug('Group parse error ' + e); }
      const groupIds = {
        admin: process.env.NEXT_PUBLIC_ADMIN_GROUP || '',
        consultant: process.env.NEXT_PUBLIC_CONSULTANT_GROUP || '',
      };
      const nextRoles: string[] = [];
      if (groupIds.admin && resolvedGroups.includes(groupIds.admin)) nextRoles.push('Administrator');
      if (groupIds.consultant && resolvedGroups.includes(groupIds.consultant)) nextRoles.push('Consultant');
      if (nextRoles.length === 0) nextRoles.push('Unauthorized');
      (token as any).role = nextRoles[0];
      (token as any).roles = nextRoles;
      logDebug('JWT roles assigned', { roles: (token as any).roles, primary: (token as any).role, groupIdAdmin: groupIds.admin?.slice(0,8), groupIdConsultant: groupIds.consultant?.slice(0,8), sampleGroups: resolvedGroups.slice(0,5) });
      return token as JWT;
    },
    async session({ session, token }) {
      (session.user as any).role = (token as any).role;
      (session.user as any).roles = (token as any).roles;
      (session.user as any).id = token.sub;
      logDebug('Session callback', { role: (token as any).role });
      return session;
    }
  },
  logger: {
    error(code, meta){ logDebug(`[error] code=${code} meta=${JSON.stringify(meta||{})}`); },
    warn(code){ logDebug(`[warn] code=${code}`); },
    debug(code, meta){ logDebug(`[debug] code=${code} meta=${JSON.stringify(meta||{})}`); }
  },
  events: {
    async signIn(message: any){ logDebug('NextAuth event signIn', message); },
    async session(message: any){ logDebug('NextAuth event session', { user: message?.session?.user?.email }); }
  },
};

export default NextAuth(authOptions);
