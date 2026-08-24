const fs = require('fs');
const path = 'c:/Eat n RepEat Cafe/eat-n-repeat-frontend/context/AdminDataContext.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Add methods to interface
content = content.replace(
  '  addStockCategory: (input: StockCategoryInput) => void;',
  '  addStockRequest: (input: StockRequestInput) => void;\n  updateStockRequestStatus: (id: string, status: "Pending" | "Handled") => void;\n  addStockCategory: (input: StockCategoryInput) => void;'
);

// 2. Add implementation
const implStr = `
  const addStockRequest = useCallback((input: StockRequestInput) => {
    setData((prev) => ({
      ...prev,
      stockRequests: [...prev.stockRequests, { ...input, id: createId('sr'), status: 'Pending', createdAt: new Date().toISOString() }]
    }));
  }, []);

  const updateStockRequestStatus = useCallback((id: string, status: "Pending" | "Handled") => {
    setData((prev) => ({
      ...prev,
      stockRequests: prev.stockRequests.map(req => req.id === id ? { ...req, status } : req)
    }));
  }, []);

  const addStockCategory = useCallback((input: StockCategoryInput) => {
`;

content = content.replace('  const addStockCategory = useCallback((input: StockCategoryInput) => {', implStr);

// 3. Export methods
content = content.replace(
  '      addStockCategory,',
  '      addStockRequest,\n      updateStockRequestStatus,\n      addStockCategory,'
);

// 4. Add Imports
content = content.replace(
  '  StockItemInput,\n  SystemSettings,',
  '  StockItemInput,\n  StockRequest,\n  StockRequestInput,\n  SystemSettings,'
);

fs.writeFileSync(path, content, 'utf8');
console.log('Successfully added stock request logic to AdminDataContext.tsx');
