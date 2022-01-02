
export function isNumber(value: string): boolean {
  return /^[0-9.]+$/.test(`${value}`);
}
