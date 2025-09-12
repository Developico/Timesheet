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

interface LogPayload { level?: 'debug'|'info'|'warn'|'error'; msg: string; data?: unknown; }
function writeStructured({ level='debug', msg, data }: LogPayload){
  try {
    const out = JSON.stringify({ ts: new Date().toISOString(), lvl: level, msg, ...(data? { data }: {}) });
    if (LOG_MODE === 'file' && process.env.NODE_ENV !== 'production') fs.appendFileSync(logFilePath, out + '\n');
    else if (LOG_MODE !== 'silent' && process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'debug'](out);
    }
  } catch { /* ignore logging errors */ }
}
const logDebug = (msg: string, data?: unknown)=> writeStructured({ level: 'debug', msg, data });
const logInfo  = (msg: string, data?: unknown)=> writeStructured({ level: 'info', msg, data });
const logWarn  = (msg: string, data?: unknown)=> writeStructured({ level: 'warn', msg, data });
const logError = (msg: string, err?: unknown)=> writeStructured({ level: 'error', msg, data: sanitizeError(err) });

function sanitizeError(e: unknown){
  if(!e || typeof e !== 'object') return undefined
  const err = e as { name?: string; message?: string; stack?: unknown; code?: unknown }
  return {
    name: err.name,
    message: err.message,
    stack: typeof err.stack === 'string' ? err.stack.split('\n').slice(0,6).join('\n') : undefined,
    code: err.code
  }
}

function normalizeAppScope(raw: string | undefined){ const val=(raw||'').trim(); if(!val) return null; const needs=/^api:\/\/[0-9a-f-]+\/?$/i.test(val); const base=val.replace(/\/$/,''); return needs? `${base}/access_as_user`: val; }

const rawSecret = (process.env.NEXTAUTH_SECRET || '').trim();
if (!rawSecret) logWarn('NEXTAUTH_SECRET missing or empty');
logInfo('Auth env summary', {
  hasClientId: !!process.env.AZURE_AD_CLIENT_ID,
  hasTenant: !!process.env.AZURE_AD_TENANT_ID,
  hasSecret: !!rawSecret,
  appScopeSet: !!process.env.AZURE_AD_APP_SCOPE,
  adminGroupSet: !!process.env.NEXT_PUBLIC_ADMIN_GROUP,
  consultantGroupSet: !!process.env.NEXT_PUBLIC_CONSULTANT_GROUP
});
logDebug('Node/Env meta', { node: process.version, env: process.env.NODE_ENV, logMode: LOG_MODE });

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
          // Explicitly request Graph scopes required for listing group members
          scope: (()=>{
            const appScope = normalizeAppScope(process.env.AZURE_AD_APP_SCOPE)
            // Group.Read.All enables transitiveMembers (nested groups). User.ReadBasic.All helps read basic props in some tenants.
            const graphScopes = 'User.Read User.ReadBasic.All GroupMember.Read.All Group.Read.All'
            return `openid profile email offline_access ${graphScopes}${appScope? ' '+appScope: ''}`.trim()
          })(),
          prompt: 'select_account'
        }
      }
    })
  ],
  secret: rawSecret || undefined,
  debug: process.env.NODE_ENV !== 'production',
  callbacks: {
  async jwt({ token, account }) {
      if (account) {
  logDebug('JWT account received', { provider: account.provider, hasIdToken: !!account.id_token, hasAccess: !!account.access_token, scope: account.scope });
      }
      if (account?.access_token) {
        const key = crypto.randomBytes(12).toString('base64url');
        const now = Math.floor(Date.now()/1000);
        const exp = (account.expires_at && typeof account.expires_at==='number') ? account.expires_at : now+3600;
        vsSet(key, account.access_token, exp, true);
  (token as Record<string, unknown>).aad_obo_key = key;
  logDebug('Stored access token pointer', { exp, keyLen: key.length });
      }
      if (account?.refresh_token) {
        const rtKey = crypto.randomBytes(12).toString('base64url');
        const now = Math.floor(Date.now()/1000);
        vsSet(rtKey, account.refresh_token, now + 60*60*24*30, true);
  (token as Record<string, unknown>).aad_rt_key = rtKey;
  logDebug('Stored refresh token pointer', { keyLen: rtKey.length });
      }
      // Roles from group claims (id_token) only computed on fresh OAuth callback (when account present)
      // Preserve previously computed roles on silent subsequent jwt callbacks.
  const existingRoles = (token as Record<string, unknown>).roles as string[] | undefined;
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
  } catch (e) { logWarn('Group parse failed', sanitizeError(e)); }
      const groupIds = {
        admin: process.env.NEXT_PUBLIC_ADMIN_GROUP || '',
        consultant: process.env.NEXT_PUBLIC_CONSULTANT_GROUP || '',
      };
      const nextRoles: string[] = [];
      if (groupIds.admin && resolvedGroups.includes(groupIds.admin)) nextRoles.push('Administrator');
      if (groupIds.consultant && resolvedGroups.includes(groupIds.consultant)) nextRoles.push('Consultant');
      if (nextRoles.length === 0) nextRoles.push('Unauthorized');
      (token as Record<string, unknown>).role = nextRoles[0];
      (token as Record<string, unknown>).roles = nextRoles;
      logInfo('JWT roles assigned', { roles: nextRoles, primary: nextRoles[0], adminSet: !!groupIds.admin, consultantSet: !!groupIds.consultant, sampledGroups: resolvedGroups.slice(0,5) });
      return token as JWT;
    },
    async session({ session, token }) {
      const rec = token as Record<string, unknown>
      const userRec = session.user as Record<string, unknown>
      userRec.role = rec.role
      userRec.roles = rec.roles
      userRec.id = token.sub
      logDebug('Session issued', { role: rec.role, user: userRec.email });
      return session;
    }
  },
  logger: {
    error(code, meta){
      // meta may be Error or { error: Error; [k:string]:unknown }
      let safe: unknown = meta;
      if (meta && typeof meta === 'object' && 'error' in meta) {
        const m = meta as { [k:string]: unknown; error?: unknown }
        safe = { ...m, error: sanitizeError(m.error) };
      } else if (meta instanceof Error) safe = sanitizeError(meta);
      logError('NextAuth logger error', { code, meta: safe });
    },
    warn(code){ logWarn('NextAuth logger warn', { code }); },
    debug(code, meta){ logDebug('NextAuth logger debug', { code, meta }); }
  },
  events: {
    async signIn(message: unknown){
      const m = message as { user?: { email?: string }; account?: { provider?: string } } | undefined
      logInfo('Event signIn', { user: m?.user?.email, account: m?.account?.provider });
    },
    async signOut(message: unknown){
      const m = message as { token?: { sub?: string } } | undefined
      logInfo('Event signOut', { tokenSub: m?.token?.sub });
    },
    async session(message: unknown){
      const m = message as { session?: { user?: { email?: string } } } | undefined
      logDebug('Event session', { user: m?.session?.user?.email });
    },
    async linkAccount(message: unknown){
      const m = message as { account?: { provider?: string } } | undefined
      logInfo('Event linkAccount', { provider: m?.account?.provider });
    }
  },
};

export default NextAuth(authOptions);
