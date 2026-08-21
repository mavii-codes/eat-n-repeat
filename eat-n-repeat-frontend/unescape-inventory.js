const fs = require('fs');
const p = 'c:/Eat n RepEat Cafe/eat-n-repeat-frontend/components/admin/InventoryTab.tsx';
let c = fs.readFileSync(p, 'utf8');
c = c.replace(/\\\`/g, '\`');
c = c.replace(/\\\$/g, '$');
fs.writeFileSync(p, c, 'utf8');
console.log('Done unescaping.');
