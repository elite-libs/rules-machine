export function isArray(input: unknown) { 
  return Array.isArray(input) && typeof input !== 'string';
}