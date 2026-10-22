# Loaf & Leaf — Modern Restaurant POS System

A production-quality Restaurant Point of Sale (POS) system built with React, TypeScript, Tailwind CSS, Express, and SQLite.

## Design Philosophy & System

Designed specifically for restaurant cashiers and operations managers, following modern enterprise software standards:
- **Sophisticated Neutral Palette**:
  - Background: `#F8F9FA`
  - Surface: `#FFFFFF`
  - Text: Primary `#171717`, Secondary `#737373`
  - Borders: `#E5E7EB`
  - Primary Accent: `#2563EB`
  - Status Indicators: `#16A34A` (Success / Available), `#F59E0B` (Preparing / Occupied), `#DC2626` (Danger / Cancelled)
- **Zero AI-Gimmicks**: No glowing buttons, glassmorphism, gratuitous animations, gradient cards, or emoji icons.
- **Typography**: Clean hierarchy with Inter font, tabular numbers, and consistent Pakistani Rupee (`PKR` / `Rs.`) formatting.
- **Timezone**: Karachi, Pakistan (`Asia/Karachi`).

---

## Key Modules & Features

### 1. POS Terminal (Core Workspace)
- **Two-Column Layout**: Left side product catalog, right side persistent order panel.
- **Fast Product Navigation**: Instant search filter (press `/` to focus), horizontal category pills (All, Burgers, Pizza, BBQ & Grills, Drinks, Desserts).
- **1-Click Cart Addition**: Snappy adding of items without confirmation dialogs.
- **Current Order Panel**:
  - Dine In / Takeaway toggle.
  - Live table selector with real-time status.
  - Item quantities adjusters `[-] [qty] [+]`, unit prices, item totals, and remove buttons.
  - Subtotal, flexible discount (flat PKR or percentage), configurable sales tax, and Grand Total.
  - "Charge / Checkout" button.
  - "Hold / Kitchen" order parking.
  - "Clear Order" with safety verification.

### 2. Transactional Checkout & 80mm Thermal Receipts
- **Checkout Modal**:
  - Prominent total display in PKR.
  - Payment methods: Cash, Card (POS), Other (Mobile Wallets / JazzCash / EasyPaisa).
  - Cash Change Calculator: Received amount input, quick denomination presets (`Exact`, `Rs. 500`, `Rs. 1,000`, `Rs. 2,000`, `Rs. 5,000`), and live change calculation.
  - Duplicate submission prevention.
  - ACID SQL Transaction: commits order completion, payment recording, and table release atomically.
- **80mm Thermal Receipt**:
  - Standard monospaced restaurant receipt formatting.
  - Restaurant metadata, order number, table, cashier, itemized breakdown, tax details, tendered and change.
  - Native print stylesheet integration (`window.print()`).

### 3. Orders Management
- Tabular orders list with Order #, Date/Time, Order Type, Table, Amount, Status Badge, and Actions.
- Status filters: `All`, `Pending`, `Preparing`, `Ready`, `Completed`, `Cancelled`.
- Order details inspection modal.
- Receipt reprinting.
- Fast status transitions.

### 4. Menu Management
- Product catalog table with real-time search and category filtering.
- 1-click In Stock / Out of Stock availability toggle.
- Simple single-step Add/Edit Product modal.
- Price and cost tracking in PKR.

### 5. Table Management
- Compact restaurant table grid (T-01 to T-12 + custom tables).
- Visual status badges: `Available`, `Occupied`, `Reserved`.
- Occupied tables display active order number, current total, and elapsed time.
- Clicking any table directly opens or resumes its order in the POS terminal.
- Add and delete table support.

### 6. Sales Reports
- Filter by date range: `Today's Sales`, `Yesterday`, `Last 7 Days`, `This Month (30 Days)`.
- Key metrics: Gross Sales (PKR), Total Orders, Average Order Value (AOV), Cash Sales, Card & Digital Sales.
- Minimal SVG sales volume trend chart.
- Top selling menu items leaderboard.
- Transaction history table with one-click CSV export.

### 7. Settings
- Restaurant profile: Name, Tagline, Address, Landline, NTN Tax Registration Number.
- Tax configuration: Tax Authority name (e.g. Sindh Sales Tax - SRB), tax rate %, currency symbol.
- Receipt customization: Header and footer thank you notes.
- Shift & Cashier management.
- One-click SQLite demo data reset.

---

## Technology Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS, Lucide Icons, Vite
- **Backend**: Node.js, Express.js, CORS
- **Database**: SQLite 3 with SQL transactions, stored in `server/data/pos.sqlite`

---

## Running the Application

### 1. Development Mode
Run both the Express backend and the Vite frontend with hot reload:
```bash
npm run dev
```

### 2. Production Mode
Build the client and start the server:
```bash
npm run build
npm start
```
The application will be accessible at:
```
http://localhost:5000
```
