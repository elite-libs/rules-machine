import {readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {gzipSync, brotliCompressSync} from 'node:zlib';
const [directory, output] = process.argv.slice(2);
if (!directory || !output) throw Error('Usage: sizes.mjs DIST OUTPUT');
const files = readdirSync(directory).sort().filter(name => /\.(?:mjs|cjs|js|map|ts|cts)$/.test(name)).map(name => {
 const bytes = readFileSync(resolve(directory,name));
 return {name,raw:bytes.length,gzip:gzipSync(bytes,{level:9,mtime:0}).length,brotli:brotliCompressSync(bytes).length,sha256:createHash('sha256').update(bytes).digest('hex')};
});
writeFileSync(output,JSON.stringify({at:new Date().toISOString(),node:process.version,directory:resolve(directory),scope:'All emitted JS, source maps and declarations; compression sizes measured independently per file, not npm tarball size',files},null,2));
