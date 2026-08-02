#!/usr/bin/env node
/* ============================================================================
 * EVERDAO build — concatenates src/*.js (filename order) into ONE
 * self-contained everdao.html with no external requests of any kind.
 * ==========================================================================*/
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SRC = path.join(ROOT, 'src');
const OUT = path.join(ROOT, 'everdao.html');

const files = fs.readdirSync(SRC).filter(f => f.endsWith('.js')).sort();
if (!files.length) { console.error('no source files in src/'); process.exit(1); }

let banner = '';
const parts = [];
let total = 0;

for (const f of files) {
  const body = fs.readFileSync(path.join(SRC, f), 'utf8');
  const lines = body.split('\n').length;
  total += lines;
  parts.push(
    '\n/* ===== ' + f + ' ' + '='.repeat(Math.max(0, 66 - f.length)) + ' */\n' + body
  );
  banner += `  ${f.padEnd(34)} ${String(lines).padStart(6)} lines\n`;
}

const script = parts.join('\n');

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,maximum-scale=1">
<meta name="color-scheme" content="dark">
<meta name="theme-color" content="#0d0f14">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="description" content="EVERDAO - a single-player idle cultivation RPG.">
<title>EVERDAO</title>
</head>
<body>
<noscript>EVERDAO needs JavaScript enabled.</noscript>
<script>
(function(){
'use strict';
${script}
})();
</script>
</body>
</html>
`;

fs.writeFileSync(OUT, html, 'utf8');
const kb = (Buffer.byteLength(html, 'utf8') / 1024).toFixed(1);
console.log('EVERDAO build\n' + banner);
console.log(`  ${files.length} files, ${total} source lines -> everdao.html (${kb} KB)`);
