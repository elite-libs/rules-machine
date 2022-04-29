export function isBoolean(value: string): boolean {
  return ['true', 'false', 'yes', 'no', 'on', 'off'].includes(
    `${value}`.toLowerCase()
  );
}
