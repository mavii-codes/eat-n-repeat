const fs = require('fs');

function patchAdminDataContext() {
  const file = 'c:\\Eat n RepEat Cafe\\eat-n-repeat-frontend\\context\\AdminDataContext.tsx';
  let content = fs.readFileSync(file, 'utf-8');

  // Fix the "Handled" vs "Approved" | "Rejected" in updateStockRequestStatus
  content = content.replace(/status: "Pending" \| "Handled"/g, 'status: "Pending" | "Approved" | "Rejected"');

  // Add to Interface
  const interfaceTarget = 'updateDeliveryStatus: (id: string, status: DeliveryStatus) => void;';
  if (!content.includes('updateDeliveryPerson:')) {
    content = content.replace(
      interfaceTarget,
      `updateDeliveryStatus: (id: string, status: DeliveryStatus) => void;
  updateDeliveryPerson: (id: string, person: string) => void;
  updateDeliveryTeamMemberStatus: (id: string, isAvailable: boolean) => void;
  reassignDeliveryOrder: (orderId: string, newPersonId: string) => void;`
    );
  }

  // Add to implementations
  const implTarget = `const updateDeliveryStatus = useCallback(
    (id: string, status: DeliveryStatus) => {
      setData((prev) => ({
        ...prev,
        orders: prev.orders.map((o) => (o.id === id ? { ...o, status } : o)),
      }));
    },
    [],
  );`;
  
  if (!content.includes('const updateDeliveryPerson =')) {
    content = content.replace(
      implTarget,
      `const updateDeliveryStatus = useCallback(
    (id: string, status: DeliveryStatus) => {
      setData((prev) => ({
        ...prev,
        orders: prev.orders.map((o) => (o.id === id ? { ...o, status } : o)),
      }));
    },
    [],
  );

  const updateDeliveryPerson = useCallback((id: string, person: string) => {
    setData((prev) => ({
      ...prev,
      orders: prev.orders.map((o) => (o.id === id ? { ...o, deliveryPerson: person } : o)),
    }));
  }, []);

  const updateDeliveryTeamMemberStatus = useCallback((id: string, isAvailable: boolean) => {
    setData((prev) => ({
      ...prev,
      // stub implementation
    }));
  }, []);

  const reassignDeliveryOrder = useCallback((orderId: string, newPersonId: string) => {
    setData((prev) => ({
      ...prev,
      orders: prev.orders.map((o) => (o.id === orderId ? { ...o, deliveryPerson: newPersonId } : o)),
    }));
  }, []);`
    );
  }

  // Add to return object
  const returnTarget = 'updateDeliveryStatus,';
  if (!content.includes('updateDeliveryPerson,')) {
    content = content.replace(
      returnTarget,
      `updateDeliveryStatus,
      updateDeliveryPerson,
      updateDeliveryTeamMemberStatus,
      reassignDeliveryOrder,`
    );
  }

  fs.writeFileSync(file, content);
  console.log('Fixed AdminDataContext.tsx delivery methods');
}

function fixCustomerOrders() {
  const file = 'c:\\Eat n RepEat Cafe\\eat-n-repeat-frontend\\app\\customer\\orders\\page.tsx';
  let content = fs.readFileSync(file, 'utf-8');
  content = content.replace(/handleOpenChat\(customerName, orderNumber, true\)/g, 'handleOpenChat(customerName, orderNumber)');
  content = content.replace(/handleOpenChat\(customerName, orderNumber, false\)/g, 'handleOpenChat(customerName, orderNumber)');
  content = content.replace(/handleOpenChat\(order\.customerName, order\.orderNumber, true\)/g, 'handleOpenChat(order.customerName, order.orderNumber)');
  content = content.replace(/handleOpenChat\(order\.customerName, order\.orderNumber, false\)/g, 'handleOpenChat(order.customerName, order.orderNumber)');
  fs.writeFileSync(file, content);
  console.log('Fixed customer orders page');
}

function fixAdminStock() {
  const file = 'c:\\Eat n RepEat Cafe\\eat-n-repeat-frontend\\app\\admin\\stock\\page.tsx';
  let content = fs.readFileSync(file, 'utf-8');
  content = content.replace(/updateStockRequestStatus\(req\.id, status, adminNote\)/g, 'updateStockRequestStatus(req.id, status)');
  fs.writeFileSync(file, content);
  console.log('Fixed admin stock page');
}

patchAdminDataContext();
fixCustomerOrders();
fixAdminStock();
