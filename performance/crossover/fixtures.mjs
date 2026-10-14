// Independent expected mutations: never derive the oracle from either engine.
export function fixtures() {
  const sequential = (n, bytes = 0) => ({
    name: `rules-${n}-payload-${bytes}`, axis: bytes ? 'payload' : 'rules',
    rules: [...Array.from({ length: n }, () => 'x += 1'), { return: 'x' }],
    input: { x: 0, payload: 'p'.repeat(bytes) }, expected: { result: n, input: { x: n, payload: 'p'.repeat(bytes) } },
    expressionCount: n + 1, structuralDepth: 1, computeRules: n, payloadBytes: bytes,
  });
  const layers = (depth, shape = 'object') => {
    let rule = { return: '1' };
    for (let i = 0; i < depth; i++) rule = { if: 'true', then: shape === 'array' ? [rule] : rule };
    const rules = [rule];
    return { name: `layers-${depth}${shape === 'array' ? '-array' : ''}`, axis: 'layers', shape, rules,
      input: { x: 0, payload: '' }, expected: { result: 1, input: { x: 0, payload: '' } },
      expressionCount: depth + 1, structuralDepth: depth + 1, computeRules: 0, payloadBytes: 0 };
  };
  return [1, 4, 16, 64, 256, 1024].map(n => sequential(n))
    .concat([0, 4, 16, 32].map(depth => layers(depth)), [layers(32, 'array')], [0, 1024, 32768, 262144].map(bytes => ({ ...sequential(256, bytes), name: `payload-${bytes}`, axis: 'payload' })));
}
export function checksum(value) {
  // Complete JSON result + mutated input, including every payload character.
  const canonical = v => v && typeof v === 'object'
    ? Array.isArray(v) ? '[' + v.map(canonical).join(',') + ']'
      : '{' + Object.keys(v).sort().map(key => JSON.stringify(key) + ':' + canonical(v[key])).join(',') + '}'
    : JSON.stringify(v);
  const text = canonical(value);
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619) >>> 0;
  return hash;
}
export function expectedChecksum(value, count) { return Math.imul(checksum(value), count) >>> 0; }

// Container depth counts root array as 1; scalar leaves do not add a level.
export function ruleMetadata(rules) {
  const jsonDepth = value => value && typeof value === 'object'
    ? 1 + Math.max(0, ...Object.values(value).map(jsonDepth)) : 0;
  const nodeCount = value => Array.isArray(value) ? 1 + value.reduce((sum, child) => sum + nodeCount(child), 0)
    : value && typeof value === 'object' ? 1 + (value.then ? nodeCount(value.then) : 0) : 1;
  return { jsonDepth: jsonDepth(rules), ruleNodeCount: nodeCount(rules) };
}
