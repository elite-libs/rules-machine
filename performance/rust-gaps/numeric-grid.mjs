import{readFileSync,writeFileSync,mkdirSync}from'node:fs';import{pathToFileURL}from'node:url';import{resolve}from'node:path';import{deepStrictEqual}from'node:assert';import{RustBridge}from'../../experiments/rusty-rules/bridge.mjs';import{encode}from'../../experiments/rusty-rules/wire.mjs';
const[modulePath,binary,output]=process.argv.slice(2);mkdirSync(output,{recursive:true});const{ruleFactory}=await import(pathToFileURL(resolve(modulePath)));const bridge=new RustBridge({binary:resolve(binary),timeoutMs:10000});const results=[];let index=0;
async function check(feature,rules,input,reject=false){let js,rs,je,re;try{const i=structuredClone(input);js={result:ruleFactory(rules)(i),input:i};}catch(e){je=e.message;}try{rs=await bridge.execute(rules,input);}catch(e){re=e.message;}
 let pass;if(reject)pass=!!re;else if(!!je!==!!re)pass=false;else if(je)pass=true;else{try{deepStrictEqual(rs,js);pass=true;}catch{pass=false;}}
 const row={index:index++,feature,rules,input:encode(input),expectation:reject?'explicit-Rust-domain-rejection':'TS-equivalence',pass,...(!pass?{jsError:je,rustError:re,js:js?encode(js):undefined,rust:rs?encode(rs):undefined}:{})};results.push(row);if(!pass)process.stderr.write(`FAIL ${feature} ${JSON.stringify(rules)} case${row.index}\n`);
}
const nums=[-Infinity,-Number.MAX_VALUE,-2,-1.5,-1,-0.5,-0.1,-Number.MIN_VALUE,-0,0,Number.MIN_VALUE,0.1,0.5,1,1.5,2,Number.MAX_SAFE_INTEGER,Infinity,NaN];
const numberBits=new DataView(new ArrayBuffer(8));
const exactPowerOfTwo=a=>{numberBits.setFloat64(0,Math.abs(a));const bits=numberBits.getBigUint64(0),exp=bits>>52n,frac=bits&0xfffffffffffffn;return exp===0n?frac!==0n&&(frac&(frac-1n))===0n:exp!==0x7ffn&&frac===0n;};
const fromBits=bits=>{numberBits.setBigUint64(0,bits);return numberBits.getFloat64(0);};
const powerReject=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)&&a!==0&&Math.abs(a)!==1&&(!Number.isInteger(b)||!exactPowerOfTwo(a));
try{
for(const f of ['ABS','NEG','NOT','FLOOR','CEIL','ROUND','SQRT','ISNAN'])for(const a of [...nums,undefined,null,true,false,'bad',[],[1],{}])await check(f,`${f}(a)`,{a});
for(const f of ['ADD','SUB','MUL','DIV','MOD'])for(const a of nums)for(const b of nums)await check(f,`${f}(a,b)`,{a,b});
for(const a of [-Infinity,-2,-1,-0,0,.5,1,2,Infinity,NaN])for(const b of [-Infinity,-3,-2,-.5,-0,0,.5,1,2,3,Infinity,NaN])await check('power','a ^ b',{a,b},powerReject(a,b));
let seed=78234;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};for(let i=0;i<300;i++){const a=random()*10,b=random()*10-5;await check('power-random','a ^ b',{a,b},powerReject(a,b));};
for(const bits of [1n,2n,3n,(1n<<51n),(1n<<52n)-1n,1n<<52n,(1n<<52n)+1n,0x3fe0000000000000n,0x3ff0000000000001n,0x3fffffffffffffffn,0x4000000000000000n,0x4000000000000001n,0x4310000000000000n,0x4310000000000001n,0x7fe0000000000000n])for(const sign of [1,-1])for(const b of [-3,-1,0,.5,1,2,3,Infinity]){const a=sign*fromBits(bits);await check('power-binary-boundaries','a ^ b',{a,b},powerReject(a,b));}
let roundSeed=0x84729;const roundBits=()=>{roundSeed=(Math.imul(roundSeed,1664525)+1013904223)>>>0;return BigInt(roundSeed);};for(let i=0;i<300;i++){const a=fromBits((roundBits()<<32n)|roundBits());await check('numeric-wire-roundtrip-bits','a',{a});}
for(const e of [-1074,-1023,-1022,-537,-1,0,1,511,512,1023])for(const sign of [1,-1])for(const b of [-3,-2,-1,0,1,2,3]){const a=sign*2**e;await check('power-underflow-overflow','a ^ b',{a,b},powerReject(a,b));}
const primitives=[undefined,null,true,false,'','0','1',' 2 ','0x10','0b10','0o10','-0x10','+0x10','0x20000000000001','0b100000000000000000000000000000000000000000000000000001','0o200000000000000001','inf','infinity','\ufeff','\u0085','Infinity','-Infinity','bad',-0,0,1,NaN,Infinity];for(const op of ['<','>','<=','>=','==','!=','<>','AND','OR'])for(const a of primitives)for(const b of primitives)await check(`operator-${op}`,`a ${op} b`,{a,b});
const arrays=[[],[0,-0],[-0,0],[NaN],[NaN,'bad'],['bad',NaN],[Infinity,-Infinity,0],[-0,NaN,0],[3,1,2],[undefined],[null],[false],[1,'2'],[{},1]];
for(const f of ['MIN','MAX','SORT','REVERSE','HEAD','TAIL','LAST'])for(const a of [...arrays,undefined,null,1,'abc',{}])await check(f,`${f}(a)`,{a},f==='SORT'&&Array.isArray(a)&&a.some(v=>typeof v!=='number'||Number.isNaN(v)));
for(const f of ['LENGTH','COUNT_KEYS'])for(const a of [...arrays,undefined,null,1,'abc','é😀',{}, {x:1}])await check(f,`${f}(a)`,{a},f==='COUNT_KEYS'&&(!a||typeof a!=='object'||Array.isArray(a)));
for(const n of [...nums,undefined,null,'2'])for(const f of ['TAKE','DROP','INDEX'])await check(f,`${f}(n,a)`,{n,a:[1,2,3]});
// INDEX argument order is iterable,index, unlike TAKE/DROP.
for(const n of nums)for(const a of [[1,2,3],'abc',42,null,undefined,{}])await check('INDEX','INDEX(a,n)',{a,n});
for(const start of [-Infinity,-3,-1.5,-0.5,-0,0,0.5,1,3,Infinity,NaN])for(const end of [-Infinity,-1,-0.5,0,1.5,3,Infinity,NaN])await check('SLICE','SLICE(start,end,a)',{start,end,a:[1,2,3]});
for(const f of ['TAKE','DROP'])for(const a of [undefined,null,2,'abc',{},[1,2]])await check(f,`${f}(1,a)`,{a});
for(const a of [-Infinity,-2,-.5,-0,0,.5,2,Infinity,NaN,9007199254740992])for(const b of [-2,0,2,3])await check('RANGE','RANGE(a,b)',{a,b});
for(const f of ['CONCAT','CONS','CONTAINS','INCLUDES','REMOVE_VALUES'])for(const a of [undefined,null,NaN,0,1,'x',[],[1,2],{}])for(const b of [undefined,null,NaN,0,'x',[],[1,2],{}])await check(f,`${f}(a,b)`,{a,b});
for(const f of ['STRING_CONTAINS','STRING_STARTS_WITH','STRING_ENDS_WITH'])for(const a of ['', 'a','é','😀',undefined,null,1])for(const b of ['', 'café😀','abc',undefined,null,1])await check(f,`${f}(a,b)`,{a,b});
}finally{await bridge.close();}
const report={at:new Date().toISOString(),node:process.version,classification:'Deterministic development numeric/domain grid, not timing evidence. Explicit rejection domains declared separately.',cases:results.length,passed:results.filter(r=>r.pass).length,failed:results.filter(r=>!r.pass).length,results};writeFileSync(resolve(output,'numeric-grid.json'),JSON.stringify(report,null,2));console.log(`${report.passed}/${report.cases};${report.failed} differences`);if(report.failed)process.exitCode=1;
