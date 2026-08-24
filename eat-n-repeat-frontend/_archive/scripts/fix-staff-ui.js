const fs = require('fs');
const path = require('path');

// 1. Fix page.tsx (Icon and Peso)
const pagePath = 'c:/Eat n RepEat Cafe/eat-n-repeat-frontend/app/staff/page.tsx';
let pageContent = fs.readFileSync(pagePath, 'utf8');

// Replace ( ! ) with Bell
pageContent = pageContent.replace(/\(\s*!\s*\)/g, '<Bell className="h-5 w-5 text-[#5A1824]" />');

// Replace â‚± with ₱
pageContent = pageContent.replace(/â‚±/g, '₱');

// Replace cafÃ© with café
pageContent = pageContent.replace(/cafÃ©/g, 'café');

// Import Bell
if (!pageContent.includes('import { Bell }')) {
    pageContent = pageContent.replace('import { Logo }', 'import { Bell } from "lucide-react";\nimport { Logo }');
}
fs.writeFileSync(pagePath, pageContent, 'utf8');
console.log('Fixed page.tsx');

// 2. Fix globals.css (Background blur and darken)
const cssPath = 'c:/Eat n RepEat Cafe/eat-n-repeat-frontend/app/globals.css';
let cssContent = fs.readFileSync(cssPath, 'utf8');

cssContent = cssContent.replace(
    /linear-gradient\(\s*115deg,\s*rgba\(26, 10, 13, 0\.45\) 0%,\s*rgba\(45, 10, 18, 0\.35\) 50%,\s*rgba\(10, 5, 8, 0\.55\) 100%\s*\);/g,
    'linear-gradient(\n        115deg,\n        rgba(26, 10, 13, 0.65) 0%,\n        rgba(45, 10, 18, 0.55) 50%,\n        rgba(10, 5, 8, 0.75) 100%\n      );'
);

cssContent = cssContent.replace(
    /backdrop-filter: blur\([2-3]px\);/g,
    'backdrop-filter: blur(5px);'
);

fs.writeFileSync(cssPath, cssContent, 'utf8');
console.log('Fixed globals.css');
