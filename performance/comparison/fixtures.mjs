// Frozen shared-subset v1: every engine consumes these exact serializable rules.
export const fixtureVersion = 'shared-subset-v1';
const applicants = Array.from({ length: 32 }, (_, i) => ({ age: 16 + i, income: 18000 + i * 3500, debt: i % 5 * 2000, active: i % 4 !== 0, region: i % 3 === 0 ? 'west' : 'east' }));
const eligibilityRules = [
  'eligible = false',
  { if: '(age >= 21) AND (income >= 30000) AND (active == true)', then: [
    { if: '(income - debt > 25000) OR (region == "west")', then: 'eligible = true', else: 'eligible = false' },
  ], else: 'eligible = false' },
  { return: 'eligible' },
];
function pricing(payloadBytes) {
 const rules = ['subtotal = order.price * order.quantity', 'tax = subtotal * 2 / 10', 'shipping = 5',
 { if: 'subtotal >= 100', then: 'discount = 10', else: 'discount = 0' },
 { if: 'member == true', then: 'shipping = 0', else: 'shipping = 5' },
 'total = subtotal + tax + shipping - discount', 'order.final = total', { return: 'total' }];
 const inputs = Array.from({ length: 32 }, (_, i) => ({ order: { price: 10 + i, quantity: 1 + i % 5 }, member: i % 3 === 0, payload: 'x'.repeat(payloadBytes) }));
 return { name: `pricing-${payloadBytes}`, shared: true, rules, inputs,
 oracle(input) { const s = input.order.price * input.order.quantity; input.subtotal=s;input.tax=s*2/10;input.shipping=input.member?0:5;input.discount=s>=100?10:0;input.total=s+input.tax+input.shipping-input.discount;input.order.final=input.total;return {result:input.total,input}; } };
}
export const fixtures = [
 { name: 'eligibility', shared: true, rules: eligibilityRules, inputs: applicants,
 oracle(input) { input.eligible = input.age >= 21 && input.income >= 30000 && input.active === true && (input.income-input.debt>25000 || input.region==='west');return {result:input.eligible,input}; } },
 ...[0,1024,32768].map(pricing),
 ...[16,256,4096].map(n=>({ name:`array-map-${n}`,shared:false,rules:[{map:'items',run:'$item * 2 + 1',set:'mapped'},{return:'mapped'}], inputs:[{items:Array.from({length:n},(_,i)=>i)}],
 oracle(input){ input.mapped=input.items.map(x=>x*2+1);input.$item=n-1;input.$index=n-1;input.$array=input.items;return {result:input.mapped,input}; } })),
];
export function expected(fixture) {return fixture.inputs.map(input=>fixture.oracle(structuredClone(input)));}
