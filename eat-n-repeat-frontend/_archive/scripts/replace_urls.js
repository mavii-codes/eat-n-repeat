const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Find all files containing http://localhost:4000 in frontend
const filesStr = execSync('findstr /s /m "http://localhost:4000" *.tsx *.ts', { encoding: 'utf-8' });
const files = filesStr.split('\r\n').filter(Boolean);

for (const file of files) {
  if (file.includes('node_modules') || file.includes('.next') || file.includes('replace_urls.js')) continue;

  let content = fs.readFileSync(file, 'utf-8');
  
  // Need to insert import for getApiUrl if we replace localhost
  if (content.includes('http://localhost:4000')) {
    // Determine relative path to lib/config.ts
    const depth = file.split('\\').length - 1;
    const prefix = depth === 0 ? './' : '../'.repeat(depth);
    const importStatement = `import { getApiUrl } from "@/lib/config";\n`;

    // Only add if not already there
    if (!content.includes('getApiUrl')) {
      // Find last import
      const importMatches = [...content.matchAll(/^import.*$/gm)];
      if (importMatches.length > 0) {
        const lastImport = importMatches[importMatches.length - 1];
        const lastImportEnd = lastImport.index + lastImport[0].length;
        content = content.slice(0, lastImportEnd) + '\n' + importStatement + content.slice(lastImportEnd);
      } else {
        content = importStatement + '\n' + content;
      }
    }

    // Replace literal "http://localhost:4000/..." with `${getApiUrl()}/...`
    content = content.replace(/'http:\/\/localhost:4000([^']*)'/g, '`${getApiUrl()}$1`');
    content = content.replace(/"http:\/\/localhost:4000([^"]*)"/g, '`${getApiUrl()}$1`');
    content = content.replace(/`http:\/\/localhost:4000([^`]*)`/g, '`${getApiUrl()}$1`');

    fs.writeFileSync(file, content);
    console.log(`Updated ${file}`);
  }
}
