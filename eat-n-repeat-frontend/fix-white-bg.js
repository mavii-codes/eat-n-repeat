const fs = require('fs');

const cssPath = 'c:/Eat n RepEat Cafe/eat-n-repeat-frontend/app/globals.css';
let cssContent = fs.readFileSync(cssPath, 'utf8');

cssContent = cssContent.replace(
    /linear-gradient\(\s*115deg,\s*rgba\(26, 10, 13, 0\.45\) 0%,\s*rgba\(45, 10, 18, 0\.35\) 50%,\s*rgba\(10, 5, 8, 0\.55\) 100%\s*\);/g,
    'linear-gradient(115deg, rgba(255, 255, 255, 0.7) 0%, rgba(255, 255, 255, 0.8) 50%, rgba(240, 240, 240, 0.7) 100%);'
);

cssContent = cssContent.replace(
    /backdrop-filter: blur\(2px\);/g,
    'backdrop-filter: blur(5px);'
);

fs.writeFileSync(cssPath, cssContent, 'utf8');
console.log('Fixed globals.css to faded white');
