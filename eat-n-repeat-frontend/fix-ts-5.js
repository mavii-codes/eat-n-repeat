const fs = require('fs');

function fixAdminDataContext() {
  const file = 'c:\\Eat n RepEat Cafe\\eat-n-repeat-frontend\\context\\AdminDataContext.tsx';
  let content = fs.readFileSync(file, 'utf-8');

  // Fix reassignDeliveryOrder arguments
  content = content.replace(/reassignDeliveryOrder = useCallback\(\(orderId: string, newPersonId: string\) => {/g, 'reassignDeliveryOrder = useCallback((orderId: string, newPersonId: string, reassignNote?: string) => {');
  content = content.replace(/reassignDeliveryOrder: \(orderId: string, newPersonId: string\) => void;/g, 'reassignDeliveryOrder: (orderId: string, newPersonId: string, reassignNote?: string) => void;');

  fs.writeFileSync(file, content);
  console.log('Fixed AdminDataContext.tsx');
}

function fixDeliveryTable() {
  const file = 'c:\\Eat n RepEat Cafe\\eat-n-repeat-frontend\\components\\admin\\DeliveryOrdersTable.tsx';
  let content = fs.readFileSync(file, 'utf-8');
  
  // Fix the mangled updateDeliveryTeamMemberStatus
  const badRegex = /updateDeliveryTeamMemberStatus\([\s\S]*?=== true\)/g;
  content = content.replace(badRegex, 'updateDeliveryTeamMemberStatus(member.id, member.status === "Available" ? "Unavailable" : "Available")');

  // Fix onStatusChange(order.id) to include the value
  content = content.replace(/onChange=\{\(e\) =>\s*onStatusChange\(order\.id\)\s*\}/g, 'onChange={(e) => onStatusChange(order.id, e.target.value as DeliveryStatus)}');

  fs.writeFileSync(file, content);
  console.log('Fixed DeliveryOrdersTable.tsx');
}

function fixCustomerOrders() {
  const file = 'c:\\Eat n RepEat Cafe\\eat-n-repeat-frontend\\app\\customer\\orders\\page.tsx';
  let content = fs.readFileSync(file, 'utf-8');
  content = content.replace(/handleOpenChat\(customerName, orderNumber, true\)/g, 'handleOpenChat(customerName, orderNumber)');
  content = content.replace(/handleOpenChat\(customerName, orderNumber, false\)/g, 'handleOpenChat(customerName, orderNumber)');
  content = content.replace(/handleOpenChat\(order\.customerName, order\.orderNumber, true\)/g, 'handleOpenChat(order.customerName, order.orderNumber)');
  content = content.replace(/handleOpenChat\(order\.customerName, order\.orderNumber, false\)/g, 'handleOpenChat(order.customerName, order.orderNumber)');
  content = content.replace(/handleOpenChat\(customerName, orderNumber\)/g, 'handleOpenChat(customerName, orderNumber)'); // fallback if regex fails
  
  // I will just explicitly replace the specific line if needed.
  // Wait, the regex should match correctly now, but let's be careful.
  fs.writeFileSync(file, content);
  console.log('Fixed customer orders page');
}

function fixAdminStock() {
  const file = 'c:\\Eat n RepEat Cafe\\eat-n-repeat-frontend\\app\\admin\\stock\\page.tsx';
  let content = fs.readFileSync(file, 'utf-8');
  content = content.replace(/updateStockRequestStatus\(req\.id, status, adminNote\)/g, 'updateStockRequestStatus(req.id, status, adminNote)'); // AdminDataContext handles 3 args now
  fs.writeFileSync(file, content);
  console.log('Fixed admin stock page');
}

fixAdminDataContext();
fixDeliveryTable();
fixCustomerOrders();
fixAdminStock();
