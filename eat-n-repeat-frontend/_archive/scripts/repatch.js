const fs = require('fs');

function repatchAdminDataContext() {
  const file = 'c:\\Eat n RepEat Cafe\\eat-n-repeat-frontend\\context\\AdminDataContext.tsx';
  let content = fs.readFileSync(file, 'utf-8');

  // 1. Replace localhost with getApiUrl
  if (!content.includes('import { getApiUrl } from "@/lib/config";')) {
    content = content.replace('import { initialAdminData } from "@/lib/admin/mock-data";', 'import { getApiUrl } from "@/lib/config";\nimport { initialAdminData } from "@/lib/admin/mock-data";');
    content = content.replace(/'http:\/\/localhost:4000([^']*)'/g, '`${getApiUrl()}$1`');
    content = content.replace(/"http:\/\/localhost:4000([^"]*)"/g, '`${getApiUrl()}$1`');
    content = content.replace(/`http:\/\/localhost:4000([^`]*)`/g, '`${getApiUrl()}$1`');
  }

  // 2. Add imports for Delivery and Stock
  if (!content.includes('AvailabilityStatus,')) {
    content = content.replace('DeliveryOrderInput,', 'DeliveryOrderInput,\n  AvailabilityStatus,\n  DeliveryTeamMember,\n  AssignmentLogEntry,');
  }
  if (!content.includes('StockRequest,')) {
    content = content.replace('StockItemInput,', 'StockItemInput,\n  StockRequest,\n  StockRequestInput,\n  StockHistoryLog,');
  }

  // 3. Add Interface definitions
  if (!content.includes('updateDeliveryPerson: (id: string, person: string) => void;')) {
    content = content.replace('updateDeliveryStatus: (id: string, status: DeliveryStatus) => void;', 
      `updateDeliveryStatus: (id: string, status: DeliveryStatus) => void;
  updateDeliveryPerson: (id: string, person: string) => void;
  updateDeliveryTeamMemberStatus: (id: string, status: AvailabilityStatus) => void;
  reassignDeliveryOrder: (orderId: string, newPersonId: string, reassignNote?: string) => void;
  addStockRequest: (input: StockRequestInput) => void;
  updateStockRequestStatus: (id: string, status: "Pending" | "Approved" | "Rejected", adminNote?: string) => void;`);
  }

  // 4. Add initialization
  if (!content.includes('stockRequests: data.stockRequests ?? [],')) {
    content = content.replace('storeOrders: data.storeOrders ?? [],', 'storeOrders: data.storeOrders ?? [],\n    stockRequests: data.stockRequests ?? [],');
  }

  // 5. Add Implementations
  const implTarget = `const updateDeliveryStatus = useCallback(
    (id: string, status: DeliveryStatus) => {
      setData((prev) => ({
        ...prev,
        orders: prev.orders.map((o) => (o.id === id ? { ...o, status } : o)),
      }));
    },
    [],
  );`;
  
  if (!content.includes('const updateDeliveryPerson = useCallback(')) {
    content = content.replace(
      implTarget,
      `const updateDeliveryStatus = useCallback(
    (id: string, status: DeliveryStatus) => {
      setData((prev) => ({
        ...prev,
        deliveryOrders: prev.deliveryOrders.map((o) => (o.id === id ? { ...o, status } : o)),
      }));
    },
    [],
  );

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
  }, []);`
    );
  }

  // 6. Fix existing deliveryOrders mapping in updateDeliveryStatus
  content = content.replace(/orders: prev\.orders\.map\(\(o\) => \(o\.id === id \? \{ \.\.\.o, status \} : o\)\),/g, 'deliveryOrders: prev.deliveryOrders.map((o) => (o.id === id ? { ...o, status } : o)),');

  // 7. Add to return object
  if (!content.includes('updateDeliveryPerson,')) {
    content = content.replace('updateDeliveryStatus,', 
      `updateDeliveryStatus,
      updateDeliveryPerson,
      updateDeliveryTeamMemberStatus,
      reassignDeliveryOrder,
      addStockRequest,
      updateStockRequestStatus,`);
  }

  fs.writeFileSync(file, content);
  console.log('Fully repatched AdminDataContext.tsx');
}

repatchAdminDataContext();
