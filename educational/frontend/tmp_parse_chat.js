const fs = require('fs');
const path = require('path');
const srcPath = path.join(__dirname, 'src', 'components', 'ChatInterface.tsx');
const content = fs.readFileSync(srcPath, 'utf8');
const lines = content.split(/\r?\n/);
lines.forEach((line, index) => {
  console.log(`${String(index + 1).padStart(4, '0')}: ${line}`);
});
