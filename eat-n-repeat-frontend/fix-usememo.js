const fs = require('fs');

function finalizeAdminDataContext() {
  const file = 'c:\\Eat n RepEat Cafe\\eat-n-repeat-frontend\\context\\AdminDataContext.tsx';
  let content = fs.readFileSync(file, 'utf-8');

  const startIndex = content.indexOf('const value = useMemo<AdminDataContextValue>(');
  const endIndex = content.indexOf('return (\n    <AdminDataContext.Provider');
  const endIndexFallback = content.indexOf('return (\r\n    <AdminDataContext.Provider');
  
  const actualEndIndex = endIndex > -1 ? endIndex : (endIndexFallback > -1 ? endIndexFallback : content.indexOf('return ('));

  if (startIndex > -1 && actualEndIndex > -1) {
    const perfectUseMemo = `const value = useMemo<AdminDataContextValue>(
    () => ({
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
      updateDeliverySettings,
      getServiceAreaName,
      getActiveDeliveryOrders,
      getDeliveryHistory,
      getActiveMenuItems,
      getActiveMenuCategories,
      getActiveStaffAccounts,
      getActiveStoreOrders,
    ],
  );

  `;
    
    content = content.substring(0, startIndex) + perfectUseMemo + content.substring(actualEndIndex);
    fs.writeFileSync(file, content);
    console.log('Fixed useMemo strictly.');
  } else {
    console.log('Indexes not found!');
  }
}

finalizeAdminDataContext();
