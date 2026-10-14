import { types } from 'node:util';

/** The worker's frame limit also bounds parent-side tree expansion.
 * Estimates intentionally exceed JSON bytes, so some values below the actual
 * 8 MiB serialized limit are rejected before serialization or tree expansion. */
export const MAX_WIRE_BYTES = 8 * 1024 * 1024;
const MAX_WIRE_DEPTH = 40;

function frameLimit() {
  const error = new RangeError('Wire value exceeds conservative 8 MiB frame budget');
  error.code = 'FRAME_LIMIT';
  throw error;
}
function bounded(bytes) {
  if (bytes > MAX_WIRE_BYTES) frameLimit();
  return bytes;
}
function stringBytes(value) {
  // JSON may escape each UTF-16 code unit as six ASCII bytes. Check size before
  // inspecting/serializing a large string, and never call a host conversion hook.
  const bytes = bounded(6 * value.length + 2);
  if (!String.prototype.isWellFormed.call(value)) throw new TypeError('Lone UTF-16 surrogates are unsupported');
  return bytes;
}

/** Collision-free tagged-v1 tree wire. Dense arrays, own enumerable data only.
 * Preflight memoizes graph sizes, including repeated aliases' expanded costs.
 * No wire arrays are allocated until the entire bounded graph has passed. */
export function encode(value) {
  const active = new Set();
  const memo = new WeakMap();
  function measure(value, depth) {
    if (depth > MAX_WIRE_DEPTH) throw new TypeError('Wire value nesting exceeds 40');
    if (value === undefined) return { tag: 'undefined', bytes: 32, height: 0 };
    if (value === null) return { tag: 'null', bytes: 32, height: 0 };
    if (typeof value === 'boolean') return { tag: 'boolean', value, bytes: 32, height: 0 };
    if (typeof value === 'number') return { tag: 'number', value: Number.isNaN(value) ? 'NaN' : value === Infinity ? 'Infinity' : value === -Infinity ? '-Infinity' : Object.is(value, -0) ? '-0' : value, bytes: 48, height: 0 };
    if (typeof value === 'string') return { tag: 'string', value, bytes: bounded(32 + stringBytes(value)), height: 0 };
    if (typeof value !== 'object') throw new TypeError('Wire accepts data values only');
    // Reflection on a Proxy can execute arbitrary traps; reject without touching it.
    if (types.isProxy(value)) throw new TypeError('Proxy values are unsupported');
    if (active.has(value)) throw new TypeError('Cyclic values cannot cross the wire');
    const cached = memo.get(value);
    if (cached) {
      if (depth + cached.height > MAX_WIRE_DEPTH) throw new TypeError('Wire value nesting exceeds 40');
      return cached;
    }
    const isArray = Array.isArray(value);
    if (!isArray && ![null, Object.prototype].includes(Object.getPrototypeOf(value))) throw new TypeError('Host object prototypes are unsupported');
    // Even the smallest child costs at least 32 bytes in the conservative bound.
    // This rejects huge sparse arrays before any per-index loop or allocation.
    const length = isArray ? Object.getOwnPropertyDescriptor(value, 'length').value : undefined;
    if (isArray) bounded(32 + length * 32);
    const keys = Reflect.ownKeys(value);
    if (keys.some(key => typeof key !== 'string')) throw new TypeError('Symbol properties are unsupported');
    if (isArray && keys.length !== length + 1) throw new TypeError('Sparse/named arrays are unsupported');
    if (!isArray) bounded(32 + keys.length * 40);
    active.add(value);
    try {
      const node = { tag: isArray ? 'array' : 'object', children: [], bytes: 32, height: 0 };
      const entries = isArray ? Array.from({ length }, (_, index) => String(index)) : keys;
      for (const key of entries) {
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (!descriptor || !('value' in descriptor) || !descriptor.enumerable) throw new TypeError('Sparse/accessor/non-enumerable properties are unsupported');
        const keyBytes = isArray ? 0 : bounded(8 + stringBytes(key));
        // Charge key/node cost before descending or allocating an entry tuple.
        bounded(node.bytes + keyBytes + 32);
        const child = measure(descriptor.value, depth + 1);
        node.bytes = bounded(node.bytes + keyBytes + child.bytes);
        node.height = Math.max(node.height, child.height + 1);
        node.children.push(isArray ? child : [key, child]);
      }
      memo.set(value, node);
      return node;
    } finally { active.delete(value); }
  }
  const root = measure(value, 0);
  function build(node) {
    if (node.tag === 'undefined' || node.tag === 'null') return [node.tag];
    if (node.tag === 'array') return ['array', node.children.map(build)];
    if (node.tag === 'object') return ['object', node.children.map(([key, child]) => [key, build(child)])];
    return [node.tag, node.value];
  }
  return build(root);
}
/** Validate ordinary JSON before JSON.stringify can invoke any host hooks.
 * A metadata-only DAG walk accounts for expanded aliases without constructing
 * another tree. Depth128 accommodates the wrapping of depth40 tagged values. */
export function preflightJSON(value) {
  const active = new Set();
  const memo = new WeakMap();
  function measure(value, depth) {
    if (depth > 128) throw new TypeError('JSON frame nesting exceeds 128');
    if (value === null || typeof value === 'boolean') return { bytes: 32, height: 0 };
    if (typeof value === 'number' && Number.isFinite(value)) return { bytes: 48, height: 0 };
    if (typeof value === 'string') return { bytes: bounded(32 + stringBytes(value)), height: 0 };
    if (typeof value !== 'object' || value === null) throw new TypeError('Frame payload requires ordinary JSON data');
    if (types.isProxy(value)) throw new TypeError('Proxy values are unsupported');
    if (active.has(value)) throw new TypeError('Cyclic values cannot cross the wire');
    const cached = memo.get(value);
    if (cached) {
      if (depth + cached.height > 128) throw new TypeError('JSON frame nesting exceeds 128');
      return cached;
    }
    const isArray = Array.isArray(value);
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== null && prototype !== (isArray ? Array.prototype : Object.prototype)) throw new TypeError('Host object prototypes are unsupported');
    const length = isArray ? Object.getOwnPropertyDescriptor(value, 'length').value : undefined;
    if (isArray) bounded(32 + length * 32);
    const keys = Reflect.ownKeys(value);
    if (keys.some(key => typeof key !== 'string')) throw new TypeError('Symbol properties are unsupported');
    if (isArray && keys.length !== length + 1) throw new TypeError('Sparse/named arrays are unsupported');
    if (!isArray) bounded(32 + keys.length * 40);
    active.add(value);
    try {
      let bytes = 32, height = 0;
      const entries = isArray ? Array.from({ length }, (_, index) => String(index)) : keys;
      for (const key of entries) {
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (!descriptor || !('value' in descriptor) || !descriptor.enumerable) throw new TypeError('Sparse/accessor/non-enumerable properties are unsupported');
        const keyBytes = isArray ? 0 : bounded(8 + stringBytes(key));
        bounded(bytes + keyBytes + 32);
        const child = measure(descriptor.value, depth + 1);
        bytes = bounded(bytes + keyBytes + child.bytes);
        height = Math.max(height, child.height + 1);
      }
      const result = { bytes, height };
      memo.set(value, result);
      return result;
    } finally { active.delete(value); }
  }
  return measure(value, 0);
}

export function decode(wire, depth=0) {
  if(depth>40||!Array.isArray(wire)||typeof wire[0]!=='string')throw new TypeError('Invalid tagged-v1 value');
  const [tag,value]=wire;
  if(tag==='undefined'&&wire.length===1)return undefined;
  if(tag==='null'&&wire.length===1)return null;
  if(wire.length!==2)throw new TypeError('Invalid tagged-v1 tuple length');
  if(tag==='boolean'&&typeof value==='boolean'||tag==='string'&&typeof value==='string')return value;
  if(tag==='number') {
    if(typeof value==='number'&&Number.isFinite(value))return value;
    if(value==='NaN')return NaN;if(value==='Infinity')return Infinity;if(value==='-Infinity')return -Infinity;if(value==='-0')return -0;
  }
  if(tag==='array'&&Array.isArray(value))return value.map(v=>decode(v,depth+1));
  if(tag==='object'&&Array.isArray(value)) {
    const out={};
    for(const pair of value) {
      if(!Array.isArray(pair)||pair.length!==2||typeof pair[0]!=='string'||Object.hasOwn(out,pair[0]))throw new TypeError('Invalid/duplicate object entry');
      Object.defineProperty(out,pair[0],{value:decode(pair[1],depth+1),writable:true,enumerable:true,configurable:true});
    }
    return out;
  }
  throw new TypeError('Invalid tagged-v1 payload');
}
