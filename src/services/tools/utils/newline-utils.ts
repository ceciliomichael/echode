export function normalizeToLf(value: string): string {
  if (!value) {
    return value;
  }

  if (!value.includes('\r')) {
    return value;
  }

  return value.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}
