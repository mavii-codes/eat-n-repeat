const fs = require('fs');

function finalizeAdminDataContext() {
  const file = 'c:\\Eat n RepEat Cafe\\eat-n-repeat-frontend\\context\\AdminDataContext.tsx';
  let content = fs.readFileSync(file, 'utf-8');

  // 1. Ensure imports
  if (!content.includes('AvailabilityStatus')) {
    content = content.replace('DeliveryOrderInput,', 'DeliveryOrderInput,\n  AvailabilityStatus,\n  DeliveryTeamMember,\n  AssignmentLogEntry,');
  }

  // 2. We need to inject the methods just before the `return {` at the end of `AdminDataProvider`
  const returnTarget = '  return (\n    <AdminDataContext.Provider';
  
  if (!content.includes('const updateDeliveryPerson = useCallback(')) {
    const methods = `
  const updateDeliveryPerson = useCallback((id: string, person: string) => {
    setData((prev) => ({
      ...prev,
      deliveryOrders: prev.deliveryOrders.map((o) => (o.id === id ? { ...o, deliveryPerson: person } : o)),
    }));
  }, []);

  const updateDeliveryTeamMemberStatus = useCallback((id: string, status: AvailabilityStatus) => {
    setData((prev) => ({
      ...prev,
      deliveryTeam: prev.deliveryTeam.map((m) => (m.id === id ? { ...m, status } : m)),
    }));
  }, []);

  const reassignDeliveryOrder = useCallback((orderId: string, newPersonId: string, reassignNote?: string) => {
    setData((prev) => ({
      ...prev,
      deliveryOrders: prev.deliveryOrders.map((o) => (o.id === orderId ? { ...o, deliveryPerson: newPersonId } : o)),
    }));
  }, []);

  const addStockRequest = useCallback((input: StockRequestInput) => {
    setData((prev) => ({
      ...prev,
      stockRequests: [...prev.stockRequests, { ...input, id: createId("sr"), status: "Pending", createdAt: new Date().toISOString() }]
    }));
  }, []);

  const updateStockRequestStatus = useCallback((id: string, status: "Pending" | "Approved" | "Rejected", adminNote?: string) => {
    setData((prev) => ({
      ...prev,
      stockRequests: prev.stockRequests.map(req => req.id === id ? { ...req, status, adminNote: adminNote !== undefined ? adminNote : req.adminNote } : req)
    }));
  }, []);
`;
    content = content.replace(returnTarget, methods + '\n' + returnTarget);
  }

  // 3. Make sure they are exported in the value object
  const valueTarget = 'const contextValue = useMemo(';
  if (!content.includes('updateDeliveryPerson,')) {
    // We'll inject them into the return object of the useMemo
    const valueReturnTarget = 'updateDeliveryStatus,';
    content = content.replace(valueReturnTarget, 
      `updateDeliveryStatus,
      updateDeliveryPerson,
      updateDeliveryTeamMemberStatus,
      reassignDeliveryOrder,
      addStockRequest,
      updateStockRequestStatus,`);
  }
  
  // 4. Ensure Interface has them
  const interfaceTarget = 'updateDeliveryStatus: (id: string, status: DeliveryStatus) => void;';
  if (!content.includes('updateDeliveryPerson: (id: string, person: string) => void;')) {
    content = content.replace(interfaceTarget, 
      `updateDeliveryStatus: (id: string, status: DeliveryStatus) => void;
  updateDeliveryPerson: (id: string, person: string) => void;
  updateDeliveryTeamMemberStatus: (id: string, status: AvailabilityStatus) => void;
  reassignDeliveryOrder: (orderId: string, newPersonId: string, reassignNote?: string) => void;
  addStockRequest: (input: StockRequestInput) => void;
  updateStockRequestStatus: (id: string, status: "Pending" | "Approved" | "Rejected", adminNote?: string) => void;`);
  }

  fs.writeFileSync(file, content);
  console.log('Finalized AdminDataContext.tsx');
}

finalizeAdminDataContext();
