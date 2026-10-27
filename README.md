# 🥬 Fresh Vegetables — E-Commerce Platform (Phases 1–20)

A high-performance, full-stack, hyper-local farm-to-doorstep e-commerce platform built with **React 18 + TypeScript + Vite**, **Node.js + Express + TypeScript**, and **PostgreSQL** (with automated high-availability in-memory fallback for resilient local development).

---

## 🏗️ Architecture Overview

The system transitions seamlessly from a single-store grocery model to a **multi-location, multi-supplier, scalable local-commerce platform** without breaking existing Phase 1–12 systems.

```text
                                  CUSTOMER
                                     │
                                     ▼
                    CUSTOMER PROGRESSIVE WEB APP (PWA)
                      - Dynamic Homepage CMS Renderer
                      - Service Worker & Offline Fallback
                      - Mobile Bottom Navigation
                      - Location & Delivery Zone Selector
                      - Schema.org JSON-LD Structured Data
                      - Marketing & E-Commerce Telemetry
                                     │
           ┌─────────────────────────┼─────────────────────────┐
           ▼                         ▼                         ▼
   Product Discovery           Active Cart & Checkout       Customer Account
   (SEO & Google Feeds)        - Online (Razorpay)          - Order History
   (Dynamic CMS Sections)      - Cash on Delivery (COD)     - Fresh Wallet (₹)
                               - Fresh Wallet Balance       - Loyalty Points & Tiers
                               - Zone Delivery Fee Calc     - Farm Subscriptions
                                     │
                                     ▼
                                ORDER PLACED
                                     │
           ┌─────────────────────────┼─────────────────────────┐
           ▼                         ▼                         ▼
    Store Inventory         Multi-Zone Delivery       Customer Notifications
    Allocation & Stock      Tracking & Fleet Mgmt     & Transaction Audit
           │                         │                         │
           └─────────────────────────┼─────────────────────────┘
                                     ▼
                              ADMIN PLATFORM
    - Homepage CMS Section Builder    - Multi-Supplier & Farmer Payouts
    - Delivery Zone & Fee Configurator - Batch Recurring Order Generation
    - Customer Loyalty & Wallet Ledger - Observability & Audit Log Trail
```

---

## 📦 Master Feature Matrix (Phases 13–20)

| Phase | Module | Key Features & Architecture |
|---|---|---|
| **Phase 13** | **Advanced Homepage CMS** | Database-driven sections (`homepage_sections`, `homepage_banners`, `homepage_section_items`). Drag-order, schedule window, enable/disable, dynamic hero slider, category pills, curated product rails. Fully controllable from Admin Panel without code deployments. |
| **Phase 14** | **Customer PWA & Mobile Experience** | Web App Manifest (`manifest.json`), Service Worker (`sw.js`) with static asset caching, floating Install App banner, 5-tab Mobile Bottom Navigation (`Home`, `Categories`, `Search`, `Orders`, `Account`), and responsive layout. |
| **Phase 15** | **Loyalty, Wallet & Referrals** | Customer Wallet ledger (`wallets`, `wallet_transactions`), Loyalty Points with tiers (Bronze, Silver, Gold, Platinum), unique referral code sharing (`referral_codes`, `referrals`), backend validation against self-referral, and 1-tap Wallet payment at checkout. |
| **Phase 16** | **Subscriptions & Recurring Orders** | Scheduled recurring vegetable baskets (`subscriptions`, `subscription_items`, `subscription_deliveries`), frequencies (`DAILY`, `WEEKLY`, `BIWEEKLY`, `MONTHLY`), lifecycle (`ACTIVE`, `PAUSED`, `SKIPPED`, `CANCELLED`), and automated background batch processor (`/api/subscriptions/admin/process-due`). |
| **Phase 17** | **Seller / Supplier Management** | Multi-vendor onboarding (`sellers`, `seller_payouts`), commission percentage rates, verification verification badges, multi-seller fulfillment splitting (`order_seller_fulfillments`), and admin payout disbursement. |
| **Phase 18** | **Advanced SEO & Google Shopping** | Dynamic `sitemap.xml` with automatic URL generation, `robots.txt`, Google Merchant Center RSS 2.0 XML feed (`/api/feeds/google-shopping.xml`), OpenGraph/Twitter card headers, and Schema.org JSON-LD structured data. |
| **Phase 19** | **Multi-Location & Delivery Zones** | Geographic zone management (`delivery_zones`, `stores`, `store_delivery_zones`), pincode serviceability lookup, dynamic delivery fee and free delivery thresholds, and persistent customer location picker. |
| **Phase 20** | **Production Scale, Security & Observability** | In-memory TTL caching service (`cache.service.ts`), structured administrative audit trail (`audit_logs`), system telemetry health endpoint (`/api/audit-logs/health`), role-based access control, and strict input validation. |

---

## 🗄️ Database Migrations

Migrations are located in `database/migrations/`:
1. `001_initial_schema.sql` (Phases 1–6): Users, categories, products, variants, cart, addresses, orders, order items.
2. `002_phases_7_to_12.sql` (Phases 7–12): Payments, delivery fleet & assignments, coupons, notifications, analytics.
3. `003_phases_13_to_20.sql` (Phases 13–20):
   - `homepage_sections`, `homepage_banners`, `homepage_section_items`
   - `loyalty_accounts`, `loyalty_transactions`
   - `wallets`, `wallet_transactions`
   - `referral_codes`, `referrals`, `referral_rewards`
   - `subscriptions`, `subscription_items`, `subscription_deliveries`
   - `sellers`, `seller_payouts`, `order_seller_fulfillments`
   - `delivery_zones`, `stores`, `store_delivery_zones`, `store_inventory`
   - `audit_logs`
   - Optimized B-Tree composite indexes for high-concurrency queries.

---

## 🚀 Getting Started

### 1. Prerequisites
- Node.js (v18+)
- PostgreSQL (v14+; optional for development as resilient memory store fallback is active)

### 2. Environment Setup
Create `.env` inside `backend/`:
```env
PORT=3000
NODE_ENV=development
CLIENT_URL=http://localhost:5173
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/fresh_vegetables
JWT_SECRET=super_secret_jwt_key_fresh_veg_2026
JWT_REFRESH_SECRET=super_secret_refresh_key_fresh_veg_2026
ADMIN_JWT_SECRET=super_secret_admin_jwt_key_fresh_veg_2026
```

### 3. Backend Setup
```bash
cd backend
npm install
npm run db:migrate  # Runs all migrations up to Phase 20
npm run dev         # Starts Express API at http://localhost:3000
```

### 4. Frontend Setup
```bash
cd frontend
npm install
npm run dev         # Starts Vite dev server at http://localhost:5173
```

---

## 📡 API Endpoint Index (New in Phases 13–20)

### Advanced CMS (`/api/cms`)
- `GET /api/cms/homepage` — Public dynamic homepage configuration
- `GET /api/cms/sections` — Admin section list with items and banners
- `POST /api/cms/sections` — Create section
- `PUT /api/cms/sections/:id` — Update section details
- `PATCH /api/cms/sections/:id/status` — Toggle section visibility
- `POST /api/cms/sections/reorder` — Update display sequence

### Loyalty, Wallet & Referrals (`/api/loyalty`)
- `GET /api/loyalty/me` — Customer points, tier & referral stats
- `GET /api/loyalty/wallet` — Customer wallet balance & transaction ledger
- `POST /api/loyalty/wallet/add-funds` — Top-up wallet balance
- `POST /api/loyalty/wallet/debit-order` — 1-tap checkout wallet payment
- `POST /api/loyalty/referral/validate` — Validate referral code
- `GET /api/loyalty/admin/overview` — Admin liability & points overview
- `POST /api/loyalty/admin/adjust` — Admin manual ledger adjustment

### Subscriptions & Recurring Orders (`/api/subscriptions`)
- `GET /api/subscriptions/my` — Customer active & paused recurring orders
- `POST /api/subscriptions` — Create new recurring basket
- `PATCH /api/subscriptions/:id/status` — Pause, resume, or cancel subscription
- `POST /api/subscriptions/:id/skip` — Skip next scheduled delivery
- `GET /api/subscriptions/admin/all` — Admin recurring metrics & subscriptions
- `POST /api/subscriptions/admin/process-due` — Scheduled engine for order generation

### Seller & Supplier Marketplace (`/api/sellers`)
- `GET /api/sellers` — Admin seller & farmer directory
- `POST /api/sellers` — Onboard new supplier
- `PATCH /api/sellers/:id/verification` — Verify seller & set commission
- `POST /api/sellers/:id/payout` — Disburse supplier payout

### Feeds, SEO & Marketing (`/api/feeds`)
- `GET /robots.txt` — Search engine crawler directives
- `GET /sitemap.xml` — Dynamic XML sitemap with all active products
- `GET /api/feeds/google-shopping.xml` — Google Merchant Center RSS 2.0 XML Feed

### Delivery Zones & Multi-Location (`/api/zones`)
- `GET /api/zones` — Active customer delivery zones
- `POST /api/zones/check-pincode` — Check pincode coverage & ETA
- `GET /api/zones/stores` — Active fulfillment store locations
- `GET /api/zones/admin` — Admin zone management
- `POST /api/zones/admin` — Create delivery zone
- `PUT /api/zones/admin/:id` — Update fees, threshold & radius
- `DELETE /api/zones/admin/:id` — Remove delivery zone

### Audit & Observability (`/api/audit-logs`)
- `GET /api/audit-logs` — Administrative audit trail
- `GET /api/audit-logs/health` — System telemetry & memory health

---

## 🛡️ Production Scale, Security & DevOps Checklist
- ✅ **Strict Layer Separation**: Routes ➔ Controllers ➔ Services ➔ Database / Cache.
- ✅ **SQL Injection Safeguards**: Parameterized queries across all database drivers.
- ✅ **Zero Secrets in Frontend**: JWT secrets, database connection strings, and payment credentials are kept strictly server-side.
- ✅ **Administrative Audit Trail**: Every sensitive action (price changes, status overrides, payouts, wallet credits) is persistently audited with actor ID, IP address, and old/new snapshots.
- ✅ **PWA Compliance**: Offline caching service worker, web manifest, and install prompts for mobile-first customer acquisition.
