const fs = require('fs');

const filePath = 'c:/Eat n RepEat Cafe/eat-n-repeat-frontend/app/staff/page.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const stateVars = `
  // Menu Tab State
  const [menuSearch, setMenuSearch] = useState("");
  const [menuCatFilter, setMenuCatFilter] = useState("all");
  const [menuAvailFilter, setMenuAvailFilter] = useState("all");
  const [menuSort, setMenuSort] = useState("name-asc");
  const [itemToArchive, setItemToArchive] = useState<any | null>(null);

  // Orders Tab State
  const [orderSearch, setOrderSearch] = useState("");
  const [orderStatusFilter, setOrderStatusFilter] = useState("all");
  const [orderTypeFilter, setOrderTypeFilter] = useState("all");
  const [orderHistorySearch, setOrderHistorySearch] = useState("");
  const [orderHistoryStatusFilter, setOrderHistoryStatusFilter] = useState("all");
  const [selectedOrderDetails, setSelectedOrderDetails] = useState<any | null>(null);
`;

if (!content.includes('menuSearch, setMenuSearch')) {
    content = content.replace('const [activeTab, setActiveTab] = useState<StaffTab>("dashboard");', 'const [activeTab, setActiveTab] = useState<StaffTab>("dashboard");\n' + stateVars);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log("Injected state variables.");
} else {
    console.log("State variables already present.");
}
