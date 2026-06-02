/**
 * Lightweight logger facade.
 *
 * Wraps `pino` when it is installed (production) and falls back to `console`
 * otherwise so the codebase keeps building / running without the dependency.
 *
 * Configurable via env:
 *   LOG_LEVEL  = "trace" | "debug" | "info" | "warn" | "error"  (default: info)
 *   LOG_FORMAT = "json" | "pretty"  (default: pretty for non-production, json otherwise)
 */

type LogLevel = "trace" | "debug" | "info" | "warn" | "error";

interface Logger {
  trace: (...args: any[]) => void;
  debug: (...args: any[]) => void;
  info: (...args: any[]) => void;
  warn: (...args: any[]) => void;
  error: (...args: any[]) => void;
  child: (bindings: Record<string, unknown>) => Logger;
}

const LEVEL_ORDER: Record<LogLevel, number> = { trace: 10, debug: 20, info: 30, warn: 40, error: 50 };

function createConsoleLogger(bindings: Record<string, unknown> = {}): Logger {
  const minLevel = (process.env.LOG_LEVEL as LogLevel) || "info";
  const threshold = LEVEL_ORDER[minLevel] ?? LEVEL_ORDER.info;
  const emit = (level: LogLevel, args: any[]) => {
    if (LEVEL_ORDER[level] < threshold) return;
    const prefix = `[${level.toUpperCase()}]`;
    const ctx = Object.keys(bindings).length ? JSON.stringify(bindings) : "";
    // eslint-disable-next-line no-console
    (console[level === "trace" || level === "debug" ? "log" : level] as any)(prefix, ctx, ...args);
  };
  return {
    trace: (...a) => emit("trace", a),
    debug: (...a) => emit("debug", a),
    info: (...a) => emit("info", a),
    warn: (...a) => emit("warn", a),
    error: (...a) => emit("error", a),
    child: (more) => createConsoleLogger({ ...bindings, ...more }),
  };
}

function createPinoLogger(): Logger | null {
  try {
    // Optional dependency — fall back silently if not installed.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pino = require("pino");
    const isProd = process.env.NODE_ENV === "production";
    const format = process.env.LOG_FORMAT || (isProd ? "json" : "pretty");
    const options: any = { level: process.env.LOG_LEVEL || "info" };
    if (format === "pretty") {
      options.transport = { target: "pino-pretty", options: { colorize: true } };
    }
    return pino(options) as Logger;
  } catch {
    return null;
  }
}

export const logger: Logger = createPinoLogger() ?? createConsoleLogger();
