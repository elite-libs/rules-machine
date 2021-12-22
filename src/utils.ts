export function isBoolean(value: string): boolean {
  return ["true", "false", "yes", "no", "on", "off"].includes(
    `${value}`.toLowerCase()
  );
}
export function toBoolean(value: any) {
  value = value.toString().toLowerCase();
  return value === "true" || value === "yes" || value === "on";
}

export function isNumber(value: string): boolean {
  return /^[0-9.]+$/.test(`${value}`);
}

export function toNumber(value: string): number {
  return /^[0-9]+$/.test(value) ? parseInt(value) : parseFloat(value);
}

export function autoDetectType(value: any): string | boolean | number | null {
  if (value == null) return null;
  if (isBoolean(value)) return toBoolean(value);
  if (isNumber(value)) return toNumber(value);
  return `${value}`;
}