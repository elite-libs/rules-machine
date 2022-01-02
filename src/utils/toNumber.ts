export function toNumber(value: string | number): number {
  return typeof value === 'number'
    ? value
    : /^[0-9]+$/.test(value)
    ? parseInt(value, 10)
    : parseFloat(value);
}
