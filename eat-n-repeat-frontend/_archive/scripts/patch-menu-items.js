const fs = require('fs');
const path = require('path');

const filePath = 'c:/Eat n RepEat Cafe/eat-n-repeat-frontend/app/staff/page.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add state variables for Menu Tab
const menuStateVars = `
  // Menu Tab State
  const [menuSearch, setMenuSearch] = useState("");
  const [menuCatFilter, setMenuCatFilter] = useState("all");
  const [menuAvailFilter, setMenuAvailFilter] = useState("all");
  const [menuSort, setMenuSort] = useState("name-asc");
  const [itemToArchive, setItemToArchive] = useState<any | null>(null);
`;
if (!content.includes('menuSearch, setMenuSearch')) {
    content = content.replace('// Orders Tab State', menuStateVars + '\n  // Orders Tab State');
}

// 2. Ensure icons are imported
const icons = ['Archive', 'Edit3', 'Plus', 'ArrowDownAZ', 'AlertTriangle'];
for (const icon of icons) {
    if (!content.includes(`import { ${icon}`)) {
        content = content.replace(/import \{(.*?)\} from "lucide-react";/, (match, p1) => {
            if (!p1.includes(icon)) {
                return `import {${p1}, ${icon}} from "lucide-react";`;
            }
            return match;
        });
    }
}

// 3. Replace the activeTab === "menu" block
const lines = content.split('\n');
let startIndex = -1;
let endIndex = -1;
let inMenuBlock = false;

for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('{activeTab === "menu" && (')) {
        startIndex = i;
        inMenuBlock = true;
    }
    
    if (inMenuBlock && lines[i].includes('{/* TAB 4: INVENTORY */}')) {
        endIndex = i;
        break;
    }
}

const newMenuBlock = `        {activeTab === "menu" && (() => {
          // Process data
          const activeMenuItems = menuItems.filter(m => !m.archived);
          
          // Summary counts
          const summary = {
            total: activeMenuItems.length,
            available: activeMenuItems.filter(m => m.available).length,
            unavailable: activeMenuItems.filter(m => !m.available).length,
            lowStock: activeMenuItems.filter(m => {
              // Basic check if a stock item name matches item name or is a substring
              // A real system would use a mapping/recipe
              const relatedStock = stockItems.find(s => m.name.toLowerCase().includes(s.name.toLowerCase()) || s.name.toLowerCase().includes(m.name.toLowerCase()));
              return relatedStock && relatedStock.quantity <= relatedStock.lowStockThreshold;
            }).length
          };

          // Filter & Sort
          let filteredMenu = activeMenuItems.filter(m => {
            const matchesSearch = m.name.toLowerCase().includes(menuSearch.toLowerCase()) || 
                                  m.description.toLowerCase().includes(menuSearch.toLowerCase());
            const matchesCat = menuCatFilter === "all" || m.categoryId === menuCatFilter;
            const matchesAvail = menuAvailFilter === "all" || (menuAvailFilter === "available" ? m.available : !m.available);
            return matchesSearch && matchesCat && matchesAvail;
          });

          filteredMenu.sort((a, b) => {
            if (menuSort === "name-asc") return a.name.localeCompare(b.name);
            if (menuSort === "name-desc") return b.name.localeCompare(a.name);
            if (menuSort === "price-asc") return a.price - b.price;
            if (menuSort === "price-desc") return b.price - a.price;
            return 0;
          });

          return (
            <div className="space-y-6">
              {/* HEADER */}
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
                <div>
                  <span className="inline-flex rounded-full bg-accent-light px-2.5 py-0.5 text-xs font-semibold capitalize text-accent border border-accent/10">Menu</span>
                  <h1 className="font-serif text-3xl font-bold tracking-tight text-[#800000] mt-1.5">Menu Items</h1>
                  <p className="text-sm text-muted">Manage your café menu, availability, pricing, and item details.</p>
                </div>
                <button 
                  onClick={openAddMenu}
                  className="inline-flex items-center justify-center gap-2 bg-[#800000] text-white px-5 py-2.5 rounded-xl font-bold hover:bg-[#600000] transition-colors shadow-sm"
                >
                  <Plus className="h-4 w-4" /> Add Menu Item
                </button>
              </div>

              {/* SUMMARY ROW */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "Total Items", value: summary.total, color: "text-[#800000]" },
                  { label: "Available", value: summary.available, color: "text-green-700" },
                  { label: "Unavailable", value: summary.unavailable, color: "text-amber-600" },
                  { label: "Low Stock", value: summary.lowStock, color: "text-red-600" },
                ].map(stat => (
                  <div key={stat.label} className="bg-white/80 backdrop-blur-md rounded-xl p-4 border border-white/40 shadow-sm flex flex-col">
                    <p className="text-xs font-bold text-muted uppercase tracking-wider">{stat.label}</p>
                    <p className={\`text-2xl font-bold font-serif mt-1 \${stat.color}\`}>{stat.value}</p>
                  </div>
                ))}
              </div>

              {/* MENU ITEMS PANEL */}
              <AdminPanel title="Menu Catalog" subtitle="Active menu items visible to customers">
                {/* FILTERS TOOLBAR */}
                <div className="p-4 border-b border-accent/10 bg-white/40 flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center">
                  <div className="relative w-full lg:w-72 shrink-0">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
                    <input 
                      type="text" 
                      placeholder="Search menu items..." 
                      className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-accent/20 bg-white focus:outline-none focus:ring-2 focus:ring-accent/50"
                      value={menuSearch}
                      onChange={(e) => setMenuSearch(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col sm:flex-row flex-wrap gap-3 w-full lg:w-auto">
                    <select 
                      className="py-2 px-3 text-sm rounded-lg border border-accent/20 bg-white focus:outline-none text-[#2B2523] font-medium grow sm:grow-0"
                      value={menuCatFilter}
                      onChange={(e) => setMenuCatFilter(e.target.value)}
                    >
                      <option value="all">All Categories</option>
                      {menuCategories.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    <select 
                      className="py-2 px-3 text-sm rounded-lg border border-accent/20 bg-white focus:outline-none text-[#2B2523] font-medium grow sm:grow-0"
                      value={menuAvailFilter}
                      onChange={(e) => setMenuAvailFilter(e.target.value)}
                    >
                      <option value="all">All Availability</option>
                      <option value="available">Available</option>
                      <option value="unavailable">Unavailable</option>
                    </select>
                    <select 
                      className="py-2 px-3 text-sm rounded-lg border border-accent/20 bg-white focus:outline-none text-[#2B2523] font-medium grow sm:grow-0"
                      value={menuSort}
                      onChange={(e) => setMenuSort(e.target.value)}
                    >
                      <option value="name-asc">Name A-Z</option>
                      <option value="name-desc">Name Z-A</option>
                      <option value="price-asc">Price Low-High</option>
                      <option value="price-desc">Price High-Low</option>
                    </select>
                  </div>
                </div>

                {/* CONTENT AREA */}
                <div className="p-2 bg-white/40 backdrop-blur-sm rounded-b-xl">
                  {activeMenuItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <div className="h-16 w-16 rounded-full bg-accent/5 flex items-center justify-center mb-4">
                        <Plus className="h-8 w-8 text-accent/40" />
                      </div>
                      <p className="text-lg font-bold text-[#800000]">No menu items found.</p>
                      <p className="text-sm text-muted mt-1 max-w-xs">Start building your menu by adding your first item.</p>
                      <button 
                        onClick={openAddMenu}
                        className="mt-4 px-4 py-2 bg-accent/10 text-accent font-bold text-sm rounded-lg hover:bg-accent/20 transition-colors"
                      >
                        Add Menu Item
                      </button>
                    </div>
                  ) : filteredMenu.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <Filter className="h-8 w-8 text-muted/30 mb-3" />
                      <p className="font-bold text-[#2B2523]">No matching menu items.</p>
                      <p className="text-sm text-muted mt-1">Try changing your search or filters.</p>
                    </div>
                  ) : (
                    <>
                      {/* DESKTOP TABLE */}
                      <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-left text-sm">
                          <thead>
                            <tr className="text-muted border-b border-accent/10">
                              <th className="px-4 py-3 font-medium">Item</th>
                              <th className="px-4 py-3 font-medium">Category</th>
                              <th className="px-4 py-3 font-medium">Price</th>
                              <th className="px-4 py-3 font-medium">Stock</th>
                              <th className="px-4 py-3 font-medium">Availability</th>
                              <th className="px-4 py-3 font-medium text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredMenu.map((item) => {
                              const relatedStock = stockItems.find(s => item.name.toLowerCase().includes(s.name.toLowerCase()) || s.name.toLowerCase().includes(item.name.toLowerCase()));
                              const isLowStock = relatedStock && relatedStock.quantity <= relatedStock.lowStockThreshold;

                              return (
                                <tr key={item.id} className="border-b border-accent/5 hover:bg-accent-light/20 transition-colors">
                                  <td className="px-4 py-3">
                                    <div className="flex items-center gap-3">
                                      {item.image ? (
                                        <img src={item.image} alt={item.name} className="h-10 w-10 shrink-0 rounded-lg object-cover border border-accent/10 shadow-sm" />
                                      ) : (
                                        <div className="h-10 w-10 shrink-0 rounded-lg bg-accent/5 text-accent flex items-center justify-center font-bold text-sm">
                                          {item.name.charAt(0)}
                                        </div>
                                      )}
                                      <div>
                                        <p className="font-bold text-[#2B2523]">{item.name}</p>
                                        <p className="text-[10px] text-muted font-normal mt-0.5 line-clamp-1 max-w-[200px]">{item.description}</p>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className="inline-flex rounded-full bg-gray-50 px-2 py-0.5 text-[10px] font-bold uppercase text-gray-600 border border-gray-200">
                                      {getMenuCategoryName(item.categoryId)}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 font-serif font-bold text-[#800000]">₱{item.price.toFixed(2)}</td>
                                  <td className="px-4 py-3">
                                    {isLowStock ? (
                                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-600"><AlertTriangle className="h-3 w-3" /> Low Stock</span>
                                    ) : relatedStock ? (
                                      <span className="text-[10px] text-muted">In Stock</span>
                                    ) : (
                                      <span className="text-[10px] text-gray-400">-</span>
                                    )}
                                  </td>
                                  <td className="px-4 py-3">
                                    {item.available ? (
                                      <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase bg-green-50 text-green-700 border border-green-200">
                                        <div className="h-1.5 w-1.5 rounded-full bg-green-500"></div> Available
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase bg-gray-100 text-gray-600 border border-gray-200">
                                        <div className="h-1.5 w-1.5 rounded-full bg-gray-400"></div> Unavailable
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="flex justify-end items-center gap-2">
                                      <button
                                        onClick={() => handleToggleAvailability(item)}
                                        className="p-1.5 text-muted hover:text-[#2B2523] hover:bg-white rounded-md transition-colors"
                                        title={item.available ? "Mark Unavailable" : "Mark Available"}
                                      >
                                        <Eye className={\`h-4 w-4 \${!item.available ? "opacity-40" : ""}\`} />
                                      </button>
                                      <button
                                        onClick={() => openEditMenu(item)}
                                        className="p-1.5 text-accent hover:bg-accent-light rounded-md transition-colors"
                                        title="Edit Item"
                                      >
                                        <Edit3 className="h-4 w-4" />
                                      </button>
                                      <button
                                        onClick={() => setItemToArchive(item)}
                                        className="p-1.5 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                        title="Archive Item"
                                      >
                                        <Archive className="h-4 w-4" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* MOBILE CARDS */}
                      <div className="md:hidden flex flex-col gap-3 p-2">
                        {filteredMenu.map((item) => {
                          const relatedStock = stockItems.find(s => item.name.toLowerCase().includes(s.name.toLowerCase()) || s.name.toLowerCase().includes(item.name.toLowerCase()));
                          const isLowStock = relatedStock && relatedStock.quantity <= relatedStock.lowStockThreshold;
                          
                          return (
                            <div key={item.id} className="bg-white rounded-xl border border-accent/10 p-4 shadow-sm flex flex-col gap-3 relative overflow-hidden">
                              {!item.available && <div className="absolute top-0 left-0 w-1 h-full bg-gray-300"></div>}
                              <div className="flex gap-3">
                                {item.image ? (
                                  <img src={item.image} alt={item.name} className="h-16 w-16 shrink-0 rounded-lg object-cover border border-accent/10 shadow-sm" />
                                ) : (
                                  <div className="h-16 w-16 shrink-0 rounded-lg bg-accent/5 text-accent flex items-center justify-center font-bold text-xl">
                                    {item.name.charAt(0)}
                                  </div>
                                )}
                                <div className="flex-1">
                                  <div className="flex justify-between items-start">
                                    <h3 className={\`font-bold \${item.available ? 'text-[#800000]' : 'text-gray-500'}\`}>{item.name}</h3>
                                  </div>
                                  <span className="inline-flex rounded-full bg-gray-50 px-2 py-0.5 text-[10px] font-bold uppercase text-gray-500 border border-gray-100 mt-1">
                                    {getMenuCategoryName(item.categoryId)}
                                  </span>
                                  <p className="text-xs text-muted font-normal mt-1 line-clamp-2">{item.description}</p>
                                </div>
                              </div>
                              
                              <div className="flex justify-between items-center text-sm border-t border-accent/5 pt-3 mt-1">
                                <div className="flex flex-col">
                                  {isLowStock && <span className="text-[10px] font-bold text-red-600 mb-0.5">Low Stock</span>}
                                  {item.available ? (
                                    <span className="text-[10px] font-bold uppercase text-green-600">Available</span>
                                  ) : (
                                    <span className="text-[10px] font-bold uppercase text-gray-500">Unavailable</span>
                                  )}
                                </div>
                                <span className="font-serif font-bold text-lg text-[#2B2523]">₱{item.price.toFixed(2)}</span>
                              </div>

                              <div className="flex gap-2 mt-1">
                                <button
                                  onClick={() => handleToggleAvailability(item)}
                                  className="flex-1 py-2 bg-gray-50 text-[#2B2523] font-bold text-xs rounded-lg border border-gray-200 shadow-sm"
                                >
                                  {item.available ? "Mark Unavailable" : "Mark Available"}
                                </button>
                                <button
                                  onClick={() => openEditMenu(item)}
                                  className="flex-1 py-2 bg-accent/5 text-accent font-bold text-xs rounded-lg border border-accent/10 shadow-sm"
                                >
                                  Edit Item
                                </button>
                                <button
                                  onClick={() => setItemToArchive(item)}
                                  className="px-3 py-2 bg-red-50 text-red-600 rounded-lg border border-red-100 shadow-sm"
                                >
                                  <Archive className="h-4 w-4 mx-auto" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              </AdminPanel>

              {/* ARCHIVE CONFIRMATION MODAL */}
              {itemToArchive && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in">
                  <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl p-6 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 mb-4">
                      <AlertTriangle className="h-6 w-6 text-red-600" />
                    </div>
                    <h3 className="text-lg font-bold text-[#2B2523] mb-2">Archive Menu Item?</h3>
                    <p className="text-sm text-muted mb-6">
                      Are you sure you want to archive <strong>{itemToArchive.name}</strong>? This item will no longer appear in the active menu.
                    </p>
                    <div className="flex gap-3">
                      <button
                        onClick={() => setItemToArchive(null)}
                        className="flex-1 py-2.5 bg-gray-100 text-[#2B2523] font-bold text-sm rounded-xl hover:bg-gray-200 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => {
                          archiveMenuItem(itemToArchive.id);
                          setItemToArchive(null);
                        }}
                        className="flex-1 py-2.5 bg-red-600 text-white font-bold text-sm rounded-xl hover:bg-red-700 transition-colors shadow-sm"
                      >
                        Archive Item
                      </button>
                    </div>
                  </div>
                </div>
              )}

            </div>
          );
        })()}
`;

if (startIndex !== -1 && endIndex !== -1) {
    const newContent = [
        ...lines.slice(0, startIndex),
        newMenuBlock,
        ...lines.slice(endIndex)
    ].join('\n');
    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log("Successfully replaced Menu tab!");
} else {
    console.log("Failed to find Menu block boundaries. startIndex:", startIndex, "endIndex:", endIndex);
}
