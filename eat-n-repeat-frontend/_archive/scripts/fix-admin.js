const fs = require('fs');

const file = 'c:\\Eat n RepEat Cafe\\eat-n-repeat-frontend\\context\\AdminDataContext.tsx';
let content = fs.readFileSync(file, 'utf-8');

content = content.replace(/'http:\/\/localhost:4000([^']*)'/g, '`${getApiUrl()}$1`');
content = content.replace(/"http:\/\/localhost:4000([^"]*)"/g, '`${getApiUrl()}$1`');
content = content.replace(/`http:\/\/localhost:4000([^`]*)`/g, '`${getApiUrl()}$1`');

fs.writeFileSync(file, content);
console.log('Fixed AdminDataContext.tsx');
