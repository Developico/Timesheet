import fs from "fs";
import path from "path";

const logPath = path.join(process.cwd(), "server-debug.log");
const LOG_MODE = (process.env.LOG_MODE || (process.env.NODE_ENV === "production" ? "console" : "file")).toLowerCase();

export type Logger = {
  id: string;
  info: (event: string, data?: Record<string, unknown>) => void;
  error: (event: string, data?: Record<string, unknown>) => void;
  debug: (event: string, data?: Record<string, unknown>) => void;
  child: (extra: Record<string, unknown>) => Logger;
};

function write(obj: Record<string, unknown>) {
  try {
    if (LOG_MODE === "silent") return;
    if (LOG_MODE === "file") {
      fs.appendFileSync(logPath, JSON.stringify(obj) + "\n");
      return;
    }
    const line = JSON.stringify(obj);
    const lvl = (obj.level as string) || "info";
    if (lvl === "error") console.error(line);
    else if (lvl === "debug") console.debug(line);
    else console.log(line);
  } catch {}
}

export function createLogger(ctx: { cid?: string; route?: string; [k: string]: unknown }): Logger {
  const cid = ctx.cid || `cid-${Math.random().toString(36).slice(2, 8)}`;
  const base = { cid, route: ctx.route };
  const log = (level: "info" | "error" | "debug", event: string, data?: Record<string, unknown>) =>
    write({ ts: new Date().toISOString(), level, event, ...base, ...(ctx || {}), ...(data || {}) });
  return {
    id: cid,
    info: (e, d) => log("info", e, d),
    error: (e, d) => log("error", e, d),
    debug: (e, d) => log("debug", e, d),
    child: (extra) => createLogger({ ...ctx, ...extra, cid }),
  };
}
