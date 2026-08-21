const fs = require('fs');

function fixAdminDataContext() {
  const file = 'c:\\Eat n RepEat Cafe\\eat-n-repeat-frontend\\context\\AdminDataContext.tsx';
  let content = fs.readFileSync(file, 'utf-8');

  // Add delivery methods inside AdminDataProvider
  const marker = 'const updateDeliveryStatus = useCallback(';
  if (!content.includes('const updateDeliveryPerson = useCallback(')) {
    const impls = `
  const updateDeliveryPerson = useCallback((id: string, person: string) => {
    setData((prev) => ({
      ...prev,
      orders: prev.orders.map((o) => (o.id === id ? { ...o, deliveryPerson: person } : o)),
    }));
  }, []);

  const updateDeliveryTeamMemberStatus = useCallback((id: string, isAvailable: boolean) => {
    setData((prev) => ({
      ...prev,
      deliverySettings: {
        ...prev.deliverySettings,
        team: prev.deliverySettings.team.map((m) => (m.id === id ? { ...m, isAvailable } : m)),
      }
    }));
  }, []);

  const reassignDeliveryOrder = useCallback((orderId: string, newPersonId: string) => {
    setData((prev) => ({
      ...prev,
      orders: prev.orders.map((o) => (o.id === orderId ? { ...o, deliveryPerson: newPersonId } : o)),
    }));
  }, []);
`;
    content = content.replace(marker, impls + '\n  ' + marker);
  }
  
  // Fix stock request args in implementation
  content = content.replace(/updateStockRequestStatus = useCallback\(\(id: string, status: "Pending" \| "Approved" \| "Rejected"\) => {/g, 'updateStockRequestStatus = useCallback((id: string, status: "Pending" | "Approved" | "Rejected", adminNote?: string) => {');
  content = content.replace(/stockRequests: prev\.stockRequests\.map\(req => req\.id === id \? \{ \.\.\.req, status \} : req\)/g, 'stockRequests: prev.stockRequests.map(req => req.id === id ? { ...req, status, adminNote: adminNote !== undefined ? adminNote : req.adminNote } : req)');
  
  // Fix stock request args in Interface
  content = content.replace(/updateStockRequestStatus: \(id: string, status: "Pending" \| "Handled"\) => void;/g, 'updateStockRequestStatus: (id: string, status: "Pending" | "Approved" | "Rejected", adminNote?: string) => void;');
  content = content.replace(/updateStockRequestStatus: \(id: string, status: "Pending" \| "Approved" \| "Rejected"\) => void;/g, 'updateStockRequestStatus: (id: string, status: "Pending" | "Approved" | "Rejected", adminNote?: string) => void;');

  fs.writeFileSync(file, content);
  console.log('Fixed AdminDataContext.tsx');
}

function fixCustomerOrders() {
  const file = 'c:\\Eat n RepEat Cafe\\eat-n-repeat-frontend\\app\\customer\\orders\\page.tsx';
  let content = fs.readFileSync(file, 'utf-8');
  content = content.replace(/handleOpenChat\(customerName, orderNumber, [a-zA-Z]+\)/g, 'handleOpenChat(customerName, orderNumber)');
  content = content.replace(/handleOpenChat\(order\.customerName, order\.orderNumber, [a-zA-Z]+\)/g, 'handleOpenChat(order.customerName, order.orderNumber)');
  content = content.replace(/handleOpenChat\(order\.customerName, order\.orderNumber, true\)/g, 'handleOpenChat(order.customerName, order.orderNumber)');
  content = content.replace(/handleOpenChat\(order\.customerName, order\.orderNumber, false\)/g, 'handleOpenChat(order.customerName, order.orderNumber)');
  fs.writeFileSync(file, content);
  console.log('Fixed customer orders page');
}

function fixDeliveryTable() {
  const file = 'c:\\Eat n RepEat Cafe\\eat-n-repeat-frontend\\components\\admin\\DeliveryOrdersTable.tsx';
  let content = fs.readFileSync(file, 'utf-8');
  
  // (170,66): error TS2554: Expected 2 arguments, but got 3.
  content = content.replace(/onStatusChange\(([^,]+),\s*([^,]+),\s*([^)]+)\)/g, 'onStatusChange($1, $2)');
  
  // (247,27): Argument of type 'string' is not assignable to parameter of type 'boolean'
  content = content.replace(/updateDeliveryTeamMemberStatus\(([^,]+),\s*([^)]+)\)/g, 'updateDeliveryTeamMemberStatus($1, $2 === "true" || $2 === true)');

  fs.writeFileSync(file, content);
  console.log('Fixed delivery table');
}

fixAdminDataContext();
fixCustomerOrders();
fixDeliveryTable();
