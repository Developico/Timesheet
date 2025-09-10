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

interface LogPayload { level?: 'debug'|'info'|'warn'|'error'; msg: string; data?: any; }
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
const logDebug = (msg: string, data?: any)=> writeStructured({ level: 'debug', msg, data });
const logInfo  = (msg: string, data?: any)=> writeStructured({ level: 'info', msg, data });
const logWarn  = (msg: string, data?: any)=> writeStructured({ level: 'warn', msg, data });
const logError = (msg: string, err?: any)=> writeStructured({ level: 'error', msg, data: sanitizeError(err) });

function sanitizeError(e: any){ if(!e) return undefined; return { name: e.name, message: e.message, stack: typeof e.stack==='string'? e.stack.split('\n').slice(0,6).join('\n'): undefined, code: (e as any).code }; }

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
    async jwt({ token, account, profile, user }) {
      if (account) {
  logDebug('JWT account received', { provider: account.provider, hasIdToken: !!account.id_token, hasAccess: !!account.access_token, scope: account.scope });
      }
      if (account?.access_token) {
        const key = crypto.randomBytes(12).toString('base64url');
        const now = Math.floor(Date.now()/1000);
        const exp = (account.expires_at && typeof account.expires_at==='number') ? account.expires_at : now+3600;
        vsSet(key, account.access_token, exp, true);
        (token as any).aad_obo_key = key;
  logDebug('Stored access token pointer', { exp, keyLen: key.length });
      }
      if (account?.refresh_token) {
        const rtKey = crypto.randomBytes(12).toString('base64url');
        const now = Math.floor(Date.now()/1000);
        vsSet(rtKey, account.refresh_token, now + 60*60*24*30, true);
        (token as any).aad_rt_key = rtKey;
  logDebug('Stored refresh token pointer', { keyLen: rtKey.length });
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
  } catch (e) { logWarn('Group parse failed', sanitizeError(e)); }
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
      logInfo('JWT roles assigned', { roles: (token as any).roles, primary: (token as any).role, adminSet: !!groupIds.admin, consultantSet: !!groupIds.consultant, sampledGroups: resolvedGroups.slice(0,5) });
      return token as JWT;
    },
    async session({ session, token }) {
      (session.user as any).role = (token as any).role;
      (session.user as any).roles = (token as any).roles;
      (session.user as any).id = token.sub;
      logDebug('Session issued', { role: (token as any).role, user: (session.user as any).email });
      return session;
    }
  },
  logger: {
    error(code, meta){
      // meta may be Error or { error: Error; [k:string]:unknown }
      let safe: any = meta;
      if (meta && typeof meta === 'object' && 'error' in meta) {
        const m: any = meta as any;
        safe = { ...m, error: sanitizeError(m.error) };
      } else if (meta instanceof Error) {
        safe = sanitizeError(meta);
      }
      logError('NextAuth logger error', { code, meta: safe });
    },
    warn(code){ logWarn('NextAuth logger warn', { code }); },
    debug(code, meta){ logDebug('NextAuth logger debug', { code, meta }); }
  },
  events: {
    async signIn(message: any){ logInfo('Event signIn', { user: message?.user?.email, account: message?.account?.provider }); },
    async signOut(message: any){ logInfo('Event signOut', { tokenSub: message?.token?.sub }); },
    async session(message: any){ logDebug('Event session', { user: message?.session?.user?.email }); },
    async linkAccount(message: any){ logInfo('Event linkAccount', { provider: message?.account?.provider }); }
  },
};

export default NextAuth(authOptions);
