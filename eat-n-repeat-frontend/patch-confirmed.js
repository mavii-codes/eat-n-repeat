const fs = require('fs');

function replaceAll(file, search, replace) {
  let c = fs.readFileSync(file, 'utf8');
  c = c.split(search).join(replace);
  fs.writeFileSync(file, c, 'utf8');
}

replaceAll('c:/Eat n RepEat Cafe/eat-n-repeat-frontend/app/customer/orders/page.tsx', '"confirmed"', '"assigned"');
replaceAll('c:/Eat n RepEat Cafe/eat-n-repeat-frontend/context/CustomerNotificationContext.tsx', 'case "confirmed":', 'case "assigned":');
replaceAll('c:/Eat n RepEat Cafe/eat-n-repeat-frontend/lib/admin/mock-data.ts', 'status: "confirmed"', 'status: "assigned"');

console.log("Replaced");
