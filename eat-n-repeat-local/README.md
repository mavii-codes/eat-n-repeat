# Eat n RepEat - Local System

Desktop Electron application that manages the local Eat n RepEat system. It starts and monitors the backend (Express/Prisma) and frontend (Next.js) servers, displays system status, and provides quick-access portals for staff and admin users.

## Prerequisites

- **Windows 10** or later
- **Node.js 20+** (check with `node --version`)
- **XAMPP** with MySQL running on port 3306
  - MySQL must accept root user with an empty password (matching `eat-n-repeat-backend/.env`)
  - Start MySQL via the XAMPP Control Panel before launching the system
- Both `eat-n-repeat-backend/` and `eat-n-repeat-frontend/` must be present at the same level as this folder

## First-Time Setup

1. Ensure all prerequisites are met
2. Open a terminal in this directory (`eat-n-repeat-local/`)
3. Run `npm install`
4. Run `npm start` to launch the Electron app
5. On first run, the system will automatically:
   - Install backend and frontend dependencies if missing
   - Run Prisma generate, db push, and db seed
   - Create an `.initialized` stamp file to skip bootstrap on future runs

## Usage

### Starting the System

1. Click the **START** button
2. Wait for the status pills to turn green (Internet, Database, Local System)
3. The system will start the backend on port 4000 and frontend on port 3000

### Accessing Portals

- **STAFF** - Opens the staff dashboard in your default browser (`/staff`)
- **ADMIN** - Opens the admin dashboard in your default browser (`/admin`)
- **QR** - Displays a QR code that customers can scan to access the ordering menu

### Stopping the System

Click the **STOP** button to gracefully shut down all services.

## Building for Distribution

To build a Windows installer:

```bash
npm run dist
```

This creates a portable installer in the `dist/` folder using electron-builder.

**Note:** The build uses `logo.png` as the icon. For production, convert it to `.ico` format before building. You can use an online converter or a tool like ImageMagick:

```bash
# Example with ImageMagick (if installed)
magick ../eat-n-repeat-frontend/public/logo.png -define icon:auto-resize=256,128,64,48,32,16 app-icon.ico
```

Then update the icon path in `electron-builder.yml`.

## Troubleshooting

### Port Busy

If port 3000 or 4000 is already in use:
1. Check if another instance of the system is running
2. Open Task Manager and end any lingering Node.js processes
3. Restart the system

### MySQL Not Detected

If the Database status pill shows red:
1. Open XAMPP Control Panel
2. Start the MySQL service
3. Ensure MySQL is running on port 3306 with root and empty password
4. Click START again

### IP Address Changed

If network status changes (e.g., connected to a different Wi-Fi):
1. Stop the system
2. Start it again to re-detect the LAN IP
3. Update any bookmarks or shared links with the new IP

### System Fails to Start

1. Check the System Log for error messages
2. Ensure both `eat-n-repeat-backend/` and `eat-n-repeat-frontend/` exist
3. Try deleting the `.initialized` stamp file and restarting to re-run bootstrap

### Foreign-Key Error on `prisma db push` (orphaned guest orders)

Guest checkout writes orders with generated customer IDs that have no
matching `customers` row. If `prisma db push` fails adding the
`orders.customer_id` foreign key, the bootstrap automatically repairs this
first via `eat-n-repeat-backend/prisma/repair-orphans.cjs`: it sets ONLY
orphaned `customer_id` values to NULL (matching the relation's
`ON DELETE SET NULL` semantics) and never deletes orders. Manual equivalent:

```text
cd eat-n-repeat-backend
node prisma/repair-orphans.cjs            (repair)
node prisma/repair-orphans.cjs --dry-run  (report only, writes nothing)
```

### Foreign-Key/index Error on `prisma db push` (legacy index names)

Very old local databases (raw-SQL era) may carry a leftover plain index
named `cash_tx_shift_fk` on `cash_transactions(shift_id)` — a name that never
existed in any Prisma schema. `prisma db push` then fails trying to
DROP/REDEFINE it (`Can't DROP INDEX cash_tx_shift_fk`). The bootstrap runs
`eat-n-repeat-backend/prisma/repair-schema.cjs` before push: it ensures that
exact index exists (creating it is non-destructive; the worst case is a
redundant index that push itself replaces), logs existing indexes, and aborts
loudly on anything unexpected. Manual equivalent:

```text
cd eat-n-repeat-backend
node prisma/repair-schema.cjs            (repair)
node prisma/repair-schema.cjs --dry-run  (report only, writes nothing)
```

## Uninstall

1. Stop the system if running
2. Uninstall "Eat n RepEat Local" from Windows Settings > Apps
3. Optionally delete the `eat-n-repeat-local/` folder and its `dist/` subfolder
