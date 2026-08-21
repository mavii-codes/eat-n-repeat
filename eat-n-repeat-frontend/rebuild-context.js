const fs = require('fs');

function rebuildContext() {
  const file = 'c:\\Eat n RepEat Cafe\\eat-n-repeat-frontend\\context\\AdminDataContext.tsx';
  let content = fs.readFileSync(file, 'utf-16le'); // Read as utf-16le just in case? No, wait, fs.readFileSync(..., 'utf8') works if it's utf8. Let's try utf8.
  
  content = fs.readFileSync(file, 'utf-8');
  if (content.includes('\u0000')) {
     content = fs.readFileSync(file, 'utf-16le');
  }

  // 1. INTERFACE
  const interfaceStart = 'type AdminDataContextValue = AdminDataState & {';
  if (content.includes(interfaceStart)) {
    const interfaceMethods = `  addMenuItem: (input: MenuItemInput) => void;
  updateMenuItem: (id: string, input: MenuItemInput) => void;
  deleteMenuItem: (id: string) => void;
  archiveMenuItem: (id: string) => void;
  restoreMenuItem: (id: string) => void;
  addMenuCategory: (input: MenuCategoryInput) => void;
  updateMenuCategory: (id: string, input: MenuCategoryInput) => void;
  deleteMenuCategory: (id: string) => boolean;
  archiveMenuCategory: (id: string) => void;
  restoreMenuCategory: (id: string) => void;
  addStockItem: (input: StockItemInput) => void;
  updateStockItem: (id: string, input: StockItemInput) => void;
  deleteStockItem: (id: string) => void;
  archiveStockItem: (id: string) => void;
  addStockCategory: (input: StockCategoryInput) => void;
  updateStockCategory: (id: string, input: StockCategoryInput) => void;
  deleteStockCategory: (id: string) => boolean;
  archiveStockCategory: (id: string) => void;
  addStaffAccount: (input: StaffAccountInput) => void;
  updateStaffAccount: (id: string, input: StaffAccountInput) => void;
  deleteStaffAccount: (id: string) => void;
  archiveStaffAccount: (id: string) => void;
  restoreStaffAccount: (id: string) => void;
  updateSystemSettings: (settings: SystemSettings) => void;
  getMenuCategoryName: (categoryId: string) => string;
  getStockCategoryName: (categoryId: string) => string;
  getMenuItemsByCategory: (categoryId: string) => MenuItem[];
  getStockItemsByCategory: (categoryId: string) => StockItem[];
  updateDeliveryStatus: (id: string, status: DeliveryStatus) => void;
  updateDeliveryPerson: (id: string, person: string) => void;
  updateDeliveryTeamMemberStatus: (id: string, status: AvailabilityStatus) => void;
  reassignDeliveryOrder: (orderId: string, newPersonId: string, reassignNote?: string) => void;
  addStockRequest: (input: StockRequestInput) => void;
  updateStockRequestStatus: (id: string, status: "Pending" | "Approved" | "Rejected", adminNote?: string) => void;
  addDeliveryOrder: (input: DeliveryOrderInput) => void;
  deleteDeliveryOrder: (id: string) => void;
  archiveDeliveryOrder: (id: string) => void;
  restoreDeliveryOrder: (id: string) => void;
  archiveStoreOrder: (id: string) => void;
  restoreStoreOrder: (id: string) => void;
  updateStoreOrderStatus: (id: string, status: "completed" | "cancelled") => void;
  confirmStoreOrderPayment: (id: string) => void;
  addStoreOrder: (input: any) => void;
  addServiceArea: (input: ServiceAreaInput) => void;
  updateServiceArea: (id: string, input: ServiceAreaInput) => void;
  deleteServiceArea: (id: string) => void;
  archiveServiceArea: (id: string) => void;
  restoreServiceArea: (id: string) => void;
  updateDeliverySettings: (settings: DeliverySettings) => void;
  getServiceAreaName: (id: string) => string;
  getActiveDeliveryOrders: () => DeliveryOrder[];
  getDeliveryHistory: () => DeliveryOrder[];
  getActiveMenuItems: () => MenuItem[];
  getActiveMenuCategories: () => MenuCategory[];
  getActiveStaffAccounts: () => StaffAccount[];
  getActiveStoreOrders: () => RecentOrder[];`;

    const nextBrace = content.indexOf('};', content.indexOf(interfaceStart));
    if (nextBrace > -1) {
      content = content.substring(0, content.indexOf(interfaceStart) + interfaceStart.length + 1) + interfaceMethods + '\n' + content.substring(nextBrace);
    }
  }

  // 2. IMPLEMENTATIONS
  // Inject right before `const value = useMemo<AdminDataContextValue>(`
  const useMemoIndex = content.indexOf('const value = useMemo<AdminDataContextValue>(');
  if (useMemoIndex > -1) {
    const implementations = `
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
      stockRequests: [...(prev.stockRequests || []), { ...input, id: createId("sr"), status: "Pending", createdAt: new Date().toISOString() }]
    }));
  }, []);

  const updateStockRequestStatus = useCallback((id: string, status: "Pending" | "Approved" | "Rejected", adminNote?: string) => {
    setData((prev) => ({
      ...prev,
      stockRequests: (prev.stockRequests || []).map(req => req.id === id ? { ...req, status, adminNote: adminNote !== undefined ? adminNote : req.adminNote } : req)
    }));
  }, []);

  const archiveStockItem = useCallback((id: string) => {
    setData((prev) => ({
      ...prev,
      stockItems: prev.stockItems.map((item) =>
        item.id === id ? { ...item, archived: true, archivedAt: new Date().toISOString() } : item
      ),
    }));
  }, []);

  const archiveStockCategory = useCallback((id: string) => {
    setData((prev) => ({
      ...prev,
      stockCategories: prev.stockCategories.map((c) =>
        c.id === id ? { ...c, archived: true, archivedAt: new Date().toISOString() } : c
      ),
    }));
  }, []);
`;
    // Only inject if they don't exist yet!
    if (!content.includes('const updateDeliveryPerson = useCallback(')) {
      content = content.substring(0, useMemoIndex) + implementations + '\n  ' + content.substring(useMemoIndex);
    }
  }

  // 3. EXPORT LIST in useMemo Return object
  // Since we know the exact list, let's just replace the entire useMemo return object and dependency array!
  const useMemoReturnArrayString = `() => ({
      ...data,
      addMenuItem,
      updateMenuItem,
      deleteMenuItem,
      archiveMenuItem,
      restoreMenuItem,
      addMenuCategory,
      updateMenuCategory,
      deleteMenuCategory,
      archiveMenuCategory,
      restoreMenuCategory,
      addStockItem,
      updateStockItem,
      deleteStockItem,
      archiveStockItem,
      addStockCategory,
      updateStockCategory,
      deleteStockCategory,
      archiveStockCategory,
      addStaffAccount,
      updateStaffAccount,
      deleteStaffAccount,
      archiveStaffAccount,
      restoreStaffAccount,
      updateSystemSettings,
      getMenuCategoryName,
      getStockCategoryName,
      getMenuItemsByCategory,
      getStockItemsByCategory,
      updateDeliveryStatus,
      updateDeliveryPerson,
      updateDeliveryTeamMemberStatus,
      reassignDeliveryOrder,
      addStockRequest,
      updateStockRequestStatus,
      addDeliveryOrder,
      deleteDeliveryOrder,
      archiveDeliveryOrder,
      restoreDeliveryOrder,
      archiveStoreOrder,
      restoreStoreOrder,
      updateStoreOrderStatus,
      confirmStoreOrderPayment,
      addStoreOrder,
      addServiceArea,
      updateServiceArea,
      deleteServiceArea,
      archiveServiceArea,
      restoreServiceArea,
      updateDeliverySettings,
      getServiceAreaName,
      getActiveDeliveryOrders,
      getDeliveryHistory,
      getActiveMenuItems,
      getActiveMenuCategories,
      getActiveStaffAccounts,
      getActiveStoreOrders,
    }),
    [
      data,
      addMenuItem,
      updateMenuItem,
      deleteMenuItem,
      archiveMenuItem,
      restoreMenuItem,
      addMenuCategory,
      updateMenuCategory,
      deleteMenuCategory,
      archiveMenuCategory,
      restoreMenuCategory,
      addStockItem,
      updateStockItem,
      deleteStockItem,
      archiveStockItem,
      addStockCategory,
      updateStockCategory,
      deleteStockCategory,
      archiveStockCategory,
      addStaffAccount,
      updateStaffAccount,
      deleteStaffAccount,
      archiveStaffAccount,
      restoreStaffAccount,
      updateSystemSettings,
      getMenuCategoryName,
      getStockCategoryName,
      getMenuItemsByCategory,
      getStockItemsByCategory,
      updateDeliveryStatus,
      updateDeliveryPerson,
      updateDeliveryTeamMemberStatus,
      reassignDeliveryOrder,
      addStockRequest,
      updateStockRequestStatus,
      addDeliveryOrder,
      deleteDeliveryOrder,
      archiveDeliveryOrder,
      restoreDeliveryOrder,
      archiveStoreOrder,
      restoreStoreOrder,
      updateStoreOrderStatus,
      confirmStoreOrderPayment,
      addStoreOrder,
      addServiceArea,
      updateServiceArea,
      deleteServiceArea,
      archiveServiceArea,
      restoreServiceArea,
      updateDeliverySettings,
      getServiceAreaName,
      getActiveDeliveryOrders,
      getDeliveryHistory,
      getActiveMenuItems,
      getActiveMenuCategories,
      getActiveStaffAccounts,
      getActiveStoreOrders,
    ],
  );`;

  const afterUseMemoIndex = content.indexOf('() => ({', useMemoIndex);
  const match = content.substring(afterUseMemoIndex).match(/  \);\r?\n\r?\n  return \(/);
  
  if (afterUseMemoIndex > -1 && match) {
    const endOfUseMemoIndex = afterUseMemoIndex + match.index;
    content = content.substring(0, afterUseMemoIndex) + useMemoReturnArrayString + '\n\n  return (' + content.substring(endOfUseMemoIndex + match[0].length);
  } else {
    console.log("Could not find end of useMemo block!");
  }

  // 4. Imports
  if (!content.includes('AvailabilityStatus,')) {
    content = content.replace('DeliveryOrderInput,', 'DeliveryOrderInput,\n  AvailabilityStatus,\n  DeliveryTeamMember,\n  AssignmentLogEntry,');
  }
  if (!content.includes('StockRequest,')) {
    content = content.replace('StockItemInput,', 'StockItemInput,\n  StockRequest,\n  StockRequestInput,\n  StockHistoryLog,');
  }

  fs.writeFileSync(file, content, 'utf8');
  console.log('Rebuilt AdminDataContext.tsx');
}

rebuildContext();
