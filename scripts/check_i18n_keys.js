const fs = require('fs');
const path = require('path');

function walk(dir){
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fp = path.join(dir, file);
    const stat = fs.statSync(fp);
    if(stat && stat.isDirectory()){
      results = results.concat(walk(fp));
    } else if(/\.jsx?$/.test(fp) || /\.js$/.test(fp)){
      results.push(fp);
    }
  });
  return results;
}

const srcDir = path.resolve(__dirname, '../web/src');
const i18nFile = path.resolve(__dirname, '../web/src/i18n.js');

const files = walk(srcDir);
const keyRe = /(?:\bi18n\.t|\bt)\((?:'|")([^'"\)]+)(?:'|")\)/g;
const usedKeys = new Set();
files.forEach(f => {
  const content = fs.readFileSync(f,'utf8');
  let m;
  while((m = keyRe.exec(content))){
    usedKeys.add(m[1]);
  }
});

const i18nContent = fs.readFileSync(i18nFile,'utf8');
const presentKeys = new Set();
const keyInI18nRe = /['"]([^'"]+)['"]\s*:\s*/g;
let m;
while((m = keyInI18nRe.exec(i18nContent))){
  presentKeys.add(m[1]);
}

const missing = [];
for(const k of usedKeys){
  if(!presentKeys.has(k)) missing.push(k);
}

console.log('Used keys count:', usedKeys.size);
console.log('Present keys count in i18n.js:', presentKeys.size);
console.log('Missing keys ('+missing.length+'):\n');
missing.sort().forEach(k => console.log(k));

if(missing.length===0) process.exit(0);
else process.exit(2);
