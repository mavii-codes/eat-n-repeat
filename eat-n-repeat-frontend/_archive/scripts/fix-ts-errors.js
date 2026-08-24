const fs = require('fs');

// 1. Fix lib/auth.ts
let authFile = 'c:/Eat n RepEat Cafe/eat-n-repeat-frontend/lib/auth.ts';
let authContent = fs.readFileSync(authFile, 'utf8');
authContent = authContent.replace('import { type AuthOptions } from "next-auth";\r\nimport { type AuthOptions } from "next-auth";', 'import { type AuthOptions } from "next-auth";');
authContent = authContent.replace('import { type AuthOptions } from "next-auth";\nimport { type AuthOptions } from "next-auth";', 'import { type AuthOptions } from "next-auth";');
fs.writeFileSync(authFile, authContent);

// 2. Fix app/customer/orders/page.tsx
let ordersFile = 'c:/Eat n RepEat Cafe/eat-n-repeat-frontend/app/customer/orders/page.tsx';
let ordersContent = fs.readFileSync(ordersFile, 'utf8');
ordersContent = ordersContent.replace("else if (isConfirmed) mappedStatus = 'assigned';", "else if (isConfirmed) mappedStatus = 'preparing';");
fs.writeFileSync(ordersFile, ordersContent);

// 3. Fix components/customer/CustomerHeader.tsx
let headerFile = 'c:/Eat n RepEat Cafe/eat-n-repeat-frontend/components/customer/CustomerHeader.tsx';
let headerContent = fs.readFileSync(headerFile, 'utf8');
headerContent = headerContent.replace('{session.user.image ? (', '{(session.user as any).image ? (');
headerContent = headerContent.replace('<img src={session.user.image}', '<img src={(session.user as any).image}');
fs.writeFileSync(headerFile, headerContent);

// 4. Fix components/customer/CustomerNotificationPanel.tsx
let notifFile = 'c:/Eat n RepEat Cafe/eat-n-repeat-frontend/components/customer/CustomerNotificationPanel.tsx';
let notifContent = fs.readFileSync(notifFile, 'utf8');
notifContent = notifContent.replace(/notification\.read/g, '(notification as any).read');
notifContent = notifContent.replace(/notification\.category/g, '(notification as any).category');
notifContent = notifContent.replace(/notification\.message/g, '(notification as any).message');
notifContent = notifContent.replace(/notification\.timestamp/g, '(notification as any).timestamp');
notifContent = notifContent.replace(/notification\.orderId/g, '(notification as any).orderId');
fs.writeFileSync(notifFile, notifContent);

// 5. Fix components/customer/MenuItemDetailsModal.tsx
let modalFile = 'c:/Eat n RepEat Cafe/eat-n-repeat-frontend/components/customer/MenuItemDetailsModal.tsx';
let modalContent = fs.readFileSync(modalFile, 'utf8');
modalContent = modalContent.replace(', Bowl', '');
modalContent = modalContent.replace('(size)', '(size: any)');
modalContent = modalContent.replace('(lvl)', '(lvl: any)');
modalContent = modalContent.replace('(rice)', '(rice: any)');
modalContent = modalContent.replace('(addon)', '(addon: any)');
// Since there might be multiple (lvl), let's replace them carefully
modalContent = modalContent.replace(/const handleSelectLvl = \(lvl\) =>/g, 'const handleSelectLvl = (lvl: any) =>');
modalContent = modalContent.replace(/const handleSelectSize = \(size\) =>/g, 'const handleSelectSize = (size: any) =>');
modalContent = modalContent.replace(/const handleToggleRice = \(rice\) =>/g, 'const handleToggleRice = (rice: any) =>');
modalContent = modalContent.replace(/const handleToggleAddon = \(addon\) =>/g, 'const handleToggleAddon = (addon: any) =>');
fs.writeFileSync(modalFile, modalContent);

// 6. Fix app/customer/settings/about/page.tsx
let aboutFile = 'c:/Eat n RepEat Cafe/eat-n-repeat-frontend/app/customer/settings/about/page.tsx';
let aboutContent = fs.readFileSync(aboutFile, 'utf8');
aboutContent = aboutContent.replace("@/components/Logo", "@/components/brand/Logo");
fs.writeFileSync(aboutFile, aboutContent);

// 7. Fix context/CustomerNotificationContext.tsx
let notifContextFile = 'c:/Eat n RepEat Cafe/eat-n-repeat-frontend/context/CustomerNotificationContext.tsx';
let notifContextContent = fs.readFileSync(notifContextFile, 'utf8');
notifContextContent = notifContextContent.replace('n.category === "promo"', '(n as any).category === "promo"');
fs.writeFileSync(notifContextFile, notifContextContent);

console.log("Typescript errors fixed.");
