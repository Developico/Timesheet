import fs from 'fs';
import path from 'path';

type Entry = { value: string; exp: number };
const store = new Map<string, Entry>();
const PERSIST_ENABLED = String(process.env.VOLATILE_STORE_PERSIST || (process.env.NODE_ENV !== 'production' ? 'true' : '')).toLowerCase() === 'true';
const PERSIST_PATH = path.join(process.cwd(), '.next', 'volatile-store.json');
let timer: NodeJS.Timeout | null = null;

function ensureDir(file: string) { try { const dir = path.dirname(file); if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); } catch {}
}
function saveDebounced() { if (!PERSIST_ENABLED) return; if (timer) clearTimeout(timer); timer = setTimeout(() => { try { ensureDir(PERSIST_PATH); const obj: Record<string, Entry> = {}; for (const [k,v] of store.entries()) obj[k]=v; fs.writeFileSync(PERSIST_PATH, JSON.stringify(obj)); } catch {} }, 50); }
function load() { if (!PERSIST_ENABLED) return; try { if (!fs.existsSync(PERSIST_PATH)) return; const raw = fs.readFileSync(PERSIST_PATH,'utf8'); const obj = JSON.parse(raw) as Record<string, Entry>; const now = Math.floor(Date.now()/1000); for (const [k,v] of Object.entries(obj)) if (v.exp > now) store.set(k,v); } catch {} }
load();

export function vsSet(key: string, value: string, exp: number, persistNow=false){ store.set(key,{value,exp}); if(!PERSIST_ENABLED) return; if(persistNow){ try{ ensureDir(PERSIST_PATH); const obj: Record<string, Entry>={}; for(const [k,v] of store.entries()) obj[k]=v; fs.writeFileSync(PERSIST_PATH, JSON.stringify(obj)); } catch{} } else saveDebounced(); }
export function vsGet(key: string){ const e=store.get(key); if(!e) return; const now=Math.floor(Date.now()/1000); if(e.exp<=now){ store.delete(key); saveDebounced(); return; } return e.value; }
export function vsGetWithReload(key:string){ const v=vsGet(key); if(v!==undefined) return v; try{ load(); }catch{} return vsGet(key); }
if (typeof setInterval !== 'undefined'){ setInterval(()=>{ const now=Math.floor(Date.now()/1000); let removed=false; for(const [k,v] of store.entries()){ if(v.exp<=now){ store.delete(k); removed=true; } } if(removed) saveDebounced(); },60000).unref?.(); }
