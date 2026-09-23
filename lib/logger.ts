// lib/logger.ts
// Production-grade structured JSON logger for RJA v4.3 Observability

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export interface LogContext {
  requestId?: string;
  userId?: string;
  jobId?: string;
  durationMs?: number;
  model?: string;
  endpoint?: string;
  status?: number | string;
  [key: string]: any;
}

export interface StructuredLogRecord {
  timestamp: string;
  level: LogLevel;
  event: string;
  context?: LogContext;
  error?: {
    message: string;
    stack?: string;
    code?: string;
  };
}

class StructuredLogger {
  private formatLog(
    level: LogLevel,
    event: string,
    context?: LogContext,
    err?: unknown
  ): StructuredLogRecord {
    const record: StructuredLogRecord = {
      timestamp: new Date().toISOString(),
      level,
      event,
    };

    if (context && Object.keys(context).length > 0) {
      record.context = context;
    }

    if (err) {
      const e = err as any;
      record.error = {
        message: e?.message || String(err),
        stack: process.env.NODE_ENV !== 'production' ? e?.stack : undefined,
        code: e?.code || undefined,
      };
    }

    return record;
  }

  public debug(event: string, context?: LogContext): void {
    if (process.env.LOG_LEVEL === 'DEBUG' || process.env.NODE_ENV !== 'production') {
      console.debug(JSON.stringify(this.formatLog('DEBUG', event, context)));
    }
  }

  public info(event: string, context?: LogContext): void {
    console.info(JSON.stringify(this.formatLog('INFO', event, context)));
  }

  public warn(event: string, context?: LogContext, err?: unknown): void {
    console.warn(JSON.stringify(this.formatLog('WARN', event, context, err)));
  }

  public error(event: string, context?: LogContext, err?: unknown): void {
    console.error(JSON.stringify(this.formatLog('ERROR', event, context, err)));
  }

  public ai(
    event: string,
    context: {
      model: string;
      durationMs: number;
      attempt?: number;
      success: boolean;
      requestId?: string;
      jobId?: string;
      inputTokensEst?: number;
      outputTokensEst?: number;
      [key: string]: any;
    },
    err?: unknown
  ): void {
    const level: LogLevel = context.success ? 'INFO' : 'WARN';
    const logObj = this.formatLog(level, `AI_${event}`, context, err);
    if (context.success) {
      console.info(JSON.stringify(logObj));
    } else {
      console.warn(JSON.stringify(logObj));
    }
  }
}

export const logger = new StructuredLogger();
