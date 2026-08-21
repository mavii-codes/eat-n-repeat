const fs = require('fs');
const path = 'c:/Eat n RepEat Cafe/eat-n-repeat-frontend/context/AdminDataContext.tsx';
let lines = fs.readFileSync(path, 'utf8').split('\n');

// 1. Add imports
const importsIndex = lines.findIndex(l => l.includes('StockItemInput,'));
if (importsIndex !== -1 && !lines[importsIndex + 1].includes('StockRequest')) {
  lines.splice(importsIndex + 1, 0, '  StockRequest,', '  StockRequestInput,');
}

// 2. Add methods to interface
const interfaceIndex = lines.findIndex(l => l.includes('addStockCategory: (input: StockCategoryInput) => void;'));
if (interfaceIndex !== -1 && !lines[interfaceIndex - 1].includes('addStockRequest')) {
  lines.splice(interfaceIndex, 0, 
    '  addStockRequest: (input: StockRequestInput) => void;',
    '  updateStockRequestStatus: (id: string, status: "Pending" | "Handled") => void;'
  );
}

// 3. Add initialization to normalizeStoredData
const initIndex = lines.findIndex(l => l.includes('orderId: order.orderId ?? order.id,'));
if (initIndex !== -1 && !lines[initIndex + 2].includes('stockRequests')) {
  lines.splice(initIndex + 2, 0, '    stockRequests: data.stockRequests ?? [],');
}

// 4. Add implementations
const implIndex = lines.findIndex(l => l.includes('const addStockCategory = useCallback((input: StockCategoryInput) => {'));
if (implIndex !== -1 && !lines[implIndex - 2].includes('updateStockRequestStatus')) {
  const impl = [
    '  const addStockRequest = useCallback((input: StockRequestInput) => {',
    '    setData((prev) => ({',
    '      ...prev,',
    '      stockRequests: [...prev.stockRequests, { ...input, id: createId("sr"), status: "Pending", createdAt: new Date().toISOString() }]',
    '    }));',
    '  }, []);',
    '',
    '  const updateStockRequestStatus = useCallback((id: string, status: "Pending" | "Handled") => {',
    '    setData((prev) => ({',
    '      ...prev,',
    '      stockRequests: prev.stockRequests.map(req => req.id === id ? { ...req, status } : req)',
    '    }));',
    '  }, []);',
    ''
  ];
  lines.splice(implIndex, 0, ...impl);
}

// 5. Export methods
const exportIndex = lines.findIndex(l => l.includes('addStockCategory,'));
if (exportIndex !== -1 && !lines[exportIndex - 1].includes('updateStockRequestStatus')) {
  lines.splice(exportIndex, 0, '      addStockRequest,', '      updateStockRequestStatus,');
}

fs.writeFileSync(path, lines.join('\n'), 'utf8');
console.log('Successfully patched AdminDataContext.tsx');
