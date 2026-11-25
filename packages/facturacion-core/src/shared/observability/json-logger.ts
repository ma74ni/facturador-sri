import { LoggerService, LogLevel } from '@nestjs/common';

import { currentRequestContext } from './request-context';
import { redactPersonalData } from './redact';

type Level = Exclude<LogLevel, 'fatal'> | 'fatal';

/**
 * Logs en JSON, una línea por evento, con el contexto de la petición (requestId, companyId,
 * userId). Un servicio de logs los indexa y se buscan por campo: "companyId = X" o el código
 * que el usuario vio en el error. En desarrollo se sigue usando el logger de Nest, más legible.
 */
export class JsonLogger implements LoggerService {
  constructor(
    private readonly write: (line: string, stream: 'stdout' | 'stderr') => void = defaultWrite,
  ) {}

  log(message: unknown, ...params: unknown[]) {
    this.print('log', message, params);
  }

  error(message: unknown, ...params: unknown[]) {
    this.print('error', message, params);
  }

  warn(message: unknown, ...params: unknown[]) {
    this.print('warn', message, params);
  }

  debug(message: unknown, ...params: unknown[]) {
    this.print('debug', message, params);
  }

  verbose(message: unknown, ...params: unknown[]) {
    this.print('verbose', message, params);
  }

  fatal(message: unknown, ...params: unknown[]) {
    this.print('fatal', message, params);
  }

  private print(level: Level, message: unknown, params: unknown[]) {
    const rest = [...params];
    // Convención de Nest: el último texto es el contexto (el nombre de la clase).
    const context =
      rest.length > 0 && typeof rest[rest.length - 1] === 'string'
        ? (rest.pop() as string)
        : undefined;
    // En error(), el stack llega como texto o dentro de un Error.
    let stack: string | undefined;
    for (const param of rest) {
      if (param instanceof Error) stack = param.stack;
      else if (typeof param === 'string' && param.includes('\n    at ')) stack = param;
    }
    if (message instanceof Error) {
      stack ??= message.stack;
      message = message.message;
    }

    const request = currentRequestContext();
    const entry: Record<string, unknown> = {
      time: new Date().toISOString(),
      level,
      ...(context ? { context } : {}),
      ...(request?.requestId ? { requestId: request.requestId } : {}),
      ...(request?.companyId ? { companyId: request.companyId } : {}),
      ...(request?.userId ? { userId: request.userId } : {}),
    };
    if (typeof message === 'object' && message !== null) entry.data = message;
    else entry.msg = String(message);
    if (stack) entry.stack = stack;

    // Red de seguridad: ningún email de un cliente sale entero a un servicio externo.
    this.write(
      redactPersonalData(safeStringify(entry)),
      level === 'error' || level === 'fatal' ? 'stderr' : 'stdout',
    );
  }
}

function defaultWrite(line: string, stream: 'stdout' | 'stderr') {
  (stream === 'stderr' ? process.stderr : process.stdout).write(`${line}\n`);
}

function safeStringify(entry: Record<string, unknown>): string {
  try {
    return JSON.stringify(entry);
  } catch {
    // Un objeto circular no debe tumbar el log.
    return JSON.stringify({ ...entry, data: '[no serializable]' });
  }
}

/** JSON en producción (o con LOG_FORMAT=json); el formato de Nest en desarrollo. */
export function useJsonLogs(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.LOG_FORMAT) return env.LOG_FORMAT === 'json';
  return env.NODE_ENV === 'production';
}
