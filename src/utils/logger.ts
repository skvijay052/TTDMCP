export function log(message: string, data?: unknown): void {
  const suffix = data === undefined ? "" : ` ${JSON.stringify(data)}`;
  process.stderr.write(`[ttd-mcp] ${message}${suffix}\n`);
}
