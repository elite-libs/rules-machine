// Measured work consumption. Supported benchmark outputs: booleans, finite
// numbers, strings, and recursive arrays. Quantization is 0.001 for these fixtures.
export function digest(value) {
 if (typeof value === 'boolean') return value ? 7 : 11;
 if (typeof value === 'number' && Number.isFinite(value)) return Math.floor(value * 1000 + 0.5) >>> 0;
 if (typeof value === 'string') { let sum=13; for(let i=0;i<value.length;i++)sum=(sum+Math.imul(value.charCodeAt(i),i+1))>>>0; return sum; }
 if(Array.isArray(value)){let sum=17;for(let i=0;i<value.length;i++)sum=(sum+Math.imul(digest(value[i]),i+1))>>>0;return sum;}
 throw new Error('Unsupported benchmark result type');
}
export function batchDigest(outputs) { let sum=0;for(let i=0;i<outputs.length;i++)sum=(sum+Math.imul(digest(outputs[i].result),i+1))>>>0;return sum; }
