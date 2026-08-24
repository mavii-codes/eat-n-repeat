const fs = require('fs');
let c = fs.readFileSync('context/AdminDataContext.tsx', 'utf8');
c = c.replace('StockItemInput,', 'StockItemInput,\n  StockRequest,\n  StockRequestInput,\n  StockHistoryLog,');
fs.writeFileSync('context/AdminDataContext.tsx', c);
