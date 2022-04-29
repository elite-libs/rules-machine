export function toBoolean(value: any) {
  value = value.toString().toLowerCase();
  return value === 'true' || value === 'yes' || value === 'on';
}
