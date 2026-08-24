const fs = require('fs');

function fixArchive() {
  const file = 'c:\\Eat n RepEat Cafe\\eat-n-repeat-frontend\\context\\AdminDataContext.tsx';
  let content = fs.readFileSync(file, 'utf-8');

  // We need to add archiveStockCategory to the AdminDataContextValue type interface
  const target = 'deleteStockCategory: (id: string) => boolean;';
  
  if (content.includes(target) && !content.includes('archiveStockCategory: (id: string) => void;')) {
    content = content.replace(target, target + '\n  archiveStockCategory: (id: string) => void;');
    fs.writeFileSync(file, content);
    console.log('Fixed archiveStockCategory interface in AdminDataContext.tsx');
  } else {
    console.log('Could not find target or already added');
    // Maybe the target was `deleteStockCategory: (id: string) => void;`?
    const target2 = 'deleteStockCategory: (id: string) => void;';
    if (content.includes(target2) && !content.includes('archiveStockCategory: (id: string) => void;')) {
      content = content.replace(target2, target2 + '\n  archiveStockCategory: (id: string) => void;');
      fs.writeFileSync(file, content);
      console.log('Fixed archiveStockCategory (void variant) in AdminDataContext.tsx');
    }
  }
}

fixArchive();
