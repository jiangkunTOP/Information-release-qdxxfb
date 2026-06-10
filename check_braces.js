const fs = require('fs');
const src = fs.readFileSync('src/views/screen/editor.vue', 'utf-8');
const m = src.match(/<script setup>([\s\S]*?)<\/script>/);
const content = m[1];
const lines = content.split('\n');
let parens = 0, braces = 0;
for (let i = 0; i < lines.length; i++) {
  const l = lines[i];
  parens += (l.match(/\(/g)||[]).length - (l.match(/\)/g)||[]).length;
  braces += (l.match(/\{/g)||[]).length - (l.match(/\}/g)||[]).length;
  if (i < 5 || i > 620 || Math.abs(parens) > 0 || Math.abs(braces) > 1) {
    if (i > 5 && i < 620 && parens === 0 && braces <= 1) continue;
    console.log((i+1) + ': p=' + parens + ' b=' + braces + ' ' + l.substring(0, 120));
  }
}
console.log('Final: p=' + parens + ' b=' + braces);
