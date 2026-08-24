const { execSync } = require('child_process');
const fs = require('fs');

try {
  console.log('1. Running fix-staff-ui.js...');
  execSync('node fix-staff-ui.js', { stdio: 'inherit' });
  
  console.log('2. Running fix-white-bg.js...');
  execSync('node fix-white-bg.js', { stdio: 'inherit' });

  console.log('3. Running patch-customer-orders-v2.js...');
  execSync('node patch-customer-orders-v2.js', { stdio: 'inherit' });

  console.log('4. Running patch-menu-items.js...');
  execSync('node patch-menu-items.js', { stdio: 'inherit' });

  console.log('5. Running fix-ts.js...');
  execSync('node fix-ts.js', { stdio: 'inherit' });

  console.log('6. Adding archiveMenuItem...');
  const filePath = 'c:/Eat n RepEat Cafe/eat-n-repeat-frontend/app/staff/page.tsx';
  let content = fs.readFileSync(filePath, 'utf8');
  if (!content.includes('archiveMenuItem,')) {
    content = content.replace('staffAccounts,', 'staffAccounts,\n    archiveMenuItem,');
    fs.writeFileSync(filePath, content, 'utf8');
  }

  console.log('All patches restored successfully!');
} catch (error) {
  console.error('Error restoring patches:', error.message);
}
