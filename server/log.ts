/**
 * One-line JSON logs that Cloud Logging parses into structured entries
 * (`severity`, `message`, `httpRequest`). Never log request bodies or keys.
 */

type Severity = 'INFO' | 'WARNING' | 'ERROR';

type LogFields = Record<
  string,
  string | number | boolean | null | undefined | Record<string, string | number>
>;

export type Logger = (severity: Severity, message: string, fields?: LogFields) => void;

/** Writes structured log lines to stdout/stderr. */
export const jsonLogger: Logger = (severity, message, fields = {}) => {
  const line = JSON.stringify({ severity, message, time: new Date().toISOString(), ...fields });
  if (severity === 'ERROR') process.stderr.write(`${line}\n`);
  else process.stdout.write(`${line}\n`);
};

/** A logger that drops everything, for tests. */
export const silentLogger: Logger = () => undefined;
