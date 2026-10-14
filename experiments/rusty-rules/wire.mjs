/** Collision-free tagged-v1 tree wire. Dense arrays, own enumerable data only. */
export function encode(value, active = new Set(), depth = 0) {
  if (depth > 40) throw new TypeError('Wire value nesting exceeds 40');
  if (value === undefined) return ['undefined'];
  if (value === null) return ['null'];
  if (typeof value === 'boolean') return ['boolean', value];
  if (typeof value === 'number') return ['number', Number.isNaN(value) ? 'NaN' : value === Infinity ? 'Infinity' : value === -Infinity ? '-Infinity' : Object.is(value, -0) ? '-0' : value];
  if (typeof value === 'string') {if(!value.isWellFormed())throw new TypeError('Lone UTF-16 surrogates are unsupported');return ['string', value];}
  if (typeof value !== 'object') throw new TypeError('Wire accepts data values only');
  if (active.has(value)) throw new TypeError('Cyclic values cannot cross the wire');
  if (Object.getOwnPropertySymbols(value).length) throw new TypeError('Symbol properties are unsupported');
  active.add(value);
  try {
    if (Array.isArray(value)) {
      const out=[];
      for(let i=0;i<value.length;i++) {
        const descriptor=Object.getOwnPropertyDescriptor(value,String(i));
        if(!descriptor||!('value' in descriptor))throw new TypeError('Sparse/accessor arrays are unsupported');
        out.push(encode(descriptor.value,active,depth+1));
      }
      if(Object.getOwnPropertyNames(value).some(key=>key!=='length'&&!/^\d+$/.test(key)))throw new TypeError('Named array properties are unsupported');
      return ['array',out];
    }
    if(![null,Object.prototype].includes(Object.getPrototypeOf(value)))throw new TypeError('Host object prototypes are unsupported');
    const out=[];
    if(Object.getOwnPropertyNames(value).length!==Object.keys(value).length)throw new TypeError('Non-enumerable object properties are unsupported');
    for(const key of Object.keys(value)) {
      const descriptor=Object.getOwnPropertyDescriptor(value,key);
      if(!('value' in descriptor))throw new TypeError('Accessor properties are unsupported');
      out.push([key,encode(descriptor.value,active,depth+1)]);
    }
    return ['object',out];
  } finally { active.delete(value); }
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
