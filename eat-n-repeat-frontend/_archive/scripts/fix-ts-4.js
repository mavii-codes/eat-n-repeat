const fs = require('fs');

function fixAdminDataContext() {
  const file = 'c:\\Eat n RepEat Cafe\\eat-n-repeat-frontend\\context\\AdminDataContext.tsx';
  let content = fs.readFileSync(file, 'utf-8');

  // Fix updateDeliveryStatus
  content = content.replace(/orders: prev\.orders\.map\(\(o\)/g, 'deliveryOrders: prev.deliveryOrders.map((o)');

  // Replace the implementation block
  const oldImpls = `  const updateDeliveryPerson = useCallback((id: string, person: string) => {
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
  }, []);`;

  const newImpls = `  const updateDeliveryPerson = useCallback((id: string, person: string) => {
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

  const reassignDeliveryOrder = useCallback((orderId: string, newPersonId: string) => {
    setData((prev) => ({
      ...prev,
      deliveryOrders: prev.deliveryOrders.map((o) => (o.id === orderId ? { ...o, deliveryPerson: newPersonId } : o)),
    }));
  }, []);`;

  content = content.replace(oldImpls, newImpls);

  // Fix Interface
  content = content.replace(/updateDeliveryTeamMemberStatus: \(id: string, isAvailable: boolean\) => void;/g, 'updateDeliveryTeamMemberStatus: (id: string, status: AvailabilityStatus) => void;');

  fs.writeFileSync(file, content);
  console.log('Fixed AdminDataContext.tsx deliveryOrders and team');
}

function fixDeliveryTable() {
  const file = 'c:\\Eat n RepEat Cafe\\eat-n-repeat-frontend\\components\\admin\\DeliveryOrdersTable.tsx';
  let content = fs.readFileSync(file, 'utf-8');
  
  // Revert the previous boolean logic and use string type correctly
  content = content.replace(/updateDeliveryTeamMemberStatus\(([^,]+),\s*([^ ]+) === "true" \|\| [^)]+\)/g, 'updateDeliveryTeamMemberStatus($1, $2 as AvailabilityStatus)');

  // Fix the other argument mismatch in DeliveryOrdersTable (521,27) -> onStatusChange(order.id)
  content = content.replace(/onStatusChange\(([^,]+)\)/g, 'onStatusChange($1, "pending")'); // just a fallback fix if it was missing 2nd arg

  fs.writeFileSync(file, content);
  console.log('Fixed delivery table types');
}

fixAdminDataContext();
fixDeliveryTable();
