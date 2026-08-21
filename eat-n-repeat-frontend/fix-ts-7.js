const fs = require('fs');

function finalizeAdminDataContext() {
  const file = 'c:\\Eat n RepEat Cafe\\eat-n-repeat-frontend\\context\\AdminDataContext.tsx';
  let content = fs.readFileSync(file, 'utf-8');

  // Let's just fix the entire useMemo array block
  const useMemoStart = '    [\n      data,\n      addMenuItem,';
  const useMemoEnd = '    ],\n  );\n\n  return (';
  
  const correctArray = `    [
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
      addStockCategory,
      updateStockCategory,
      deleteStockCategory,
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

  return (`;

  const startIndex = content.indexOf('    [\n      data,');
  const endIndex = content.indexOf('    ],\n  );\n\n  return (');
  
  if (startIndex !== -1 && endIndex !== -1) {
    content = content.substring(0, startIndex) + correctArray + content.substring(endIndex + useMemoEnd.length - 12);
  } else {
    // If we can't find it, just regex replace the whole thing starting from `const value = useMemo<AdminDataContextValue>(`
    const valStart = content.indexOf('const value = useMemo<AdminDataContextValue>(');
    const returnStart = content.indexOf('  return (\n    <AdminDataContext.Provider');
    if (valStart !== -1 && returnStart !== -1) {
      const correctValue = `const value = useMemo<AdminDataContextValue>(
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
      addStockCategory,
      updateStockCategory,
      deleteStockCategory,
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
${correctArray}`;
      content = content.substring(0, valStart) + correctValue + content.substring(returnStart);
    }
  }

  fs.writeFileSync(file, content);
  console.log('Fixed useMemo array in AdminDataContext.tsx');
}

finalizeAdminDataContext();
