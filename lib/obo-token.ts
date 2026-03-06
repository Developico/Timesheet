import { ConfidentialClientApplication, type Configuration, type OnBehalfOfRequest } from '@azure/msal-node';
import { createLogger } from './logger';

let cca: ConfidentialClientApplication | null = null;
const tokenCache = new Map<string, { token: string; exp: number }>();
const IN_FLIGHT = new Map<string, Promise<string>>();

function getCca(){ if(cca) return cca; const clientId=process.env.AZURE_AD_CLIENT_ID; const clientSecret=process.env.AZURE_AD_CLIENT_SECRET; const tenantId=process.env.AZURE_AD_TENANT_ID; if(!clientId||!clientSecret||!tenantId) throw new Error('Missing AAD env for OBO'); const config: Configuration={ auth:{ clientId, clientSecret, authority:`https://login.microsoftonline.com/${tenantId}` } }; cca=new ConfidentialClientApplication(config); return cca; }

export async function getOnBehalfOfToken(userAssertion: string, scope: string){ if(!userAssertion) throw new Error('Missing user assertion'); if(!scope) throw new Error('Missing resource scope'); const logger=createLogger({route:'obo'}); const suffix=userAssertion.slice(-16); const key=`${scope}::${suffix}`; const now=Math.floor(Date.now()/1000); const cached=tokenCache.get(key); if(cached && cached.exp-60>now) return cached.token; const inflight=IN_FLIGHT.get(key); if(inflight) return inflight; const p=(async()=>{ const app=getCca(); const req: OnBehalfOfRequest={ oboAssertion:userAssertion, scopes:[scope] }; const res=await app.acquireTokenOnBehalfOf(req); if(!res?.accessToken) throw new Error('Failed OBO'); const exp=res.expiresOn?.getTime()? Math.floor(res.expiresOn.getTime()/1000): now+3000; tokenCache.set(key,{token:res.accessToken, exp}); logger.info('obo_success',{scope, exp}); return res.accessToken; })().catch(e=>{ createLogger({route:'obo'}).error('obo_err',{msg:String(e)}); throw e; }).finally(()=>IN_FLIGHT.delete(key)); IN_FLIGHT.set(key,p); return p; }
