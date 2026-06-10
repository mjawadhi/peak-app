import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "@shared/schema";
import path from "path";

// Use Railway persistent volume at /app/data if available, otherwise local
const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), "data.db");
const sqlite = new Database(DB_PATH);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");
export const db = drizzle(sqlite, { schema });

// Run migrations inline (create tables if not exist)
sqlite.exec(`
CREATE TABLE IF NOT EXISTS plans (
  id TEXT PRIMARY KEY, name TEXT NOT NULL,
  max_products INTEGER DEFAULT 100, max_orders_per_month INTEGER DEFAULT 1000,
  price_monthly REAL DEFAULT 0, is_active INTEGER DEFAULT 1, created_at TEXT DEFAULT ''
);
CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE,
  status TEXT DEFAULT 'pending', plan_id TEXT,
  commission_rate REAL DEFAULT 0, min_order_amount REAL DEFAULT 0,
  config TEXT DEFAULT '{}',
  created_at TEXT DEFAULT '', updated_at TEXT DEFAULT ''
);
CREATE TABLE IF NOT EXISTS super_admins (
  id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
  name TEXT, role TEXT DEFAULT 'admin', is_active INTEGER DEFAULT 1, created_at TEXT DEFAULT ''
);
CREATE TABLE IF NOT EXISTS tenant_users (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, email TEXT NOT NULL,
  password_hash TEXT NOT NULL, name TEXT, role TEXT DEFAULT 'staff',
  is_active INTEGER DEFAULT 1, created_at TEXT DEFAULT ''
);
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL,
  name_en TEXT NOT NULL, name_ar TEXT NOT NULL,
  slug TEXT, sort_order INTEGER DEFAULT 0, is_active INTEGER DEFAULT 1, created_at TEXT DEFAULT ''
);
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, category_id TEXT,
  name_en TEXT NOT NULL, name_ar TEXT NOT NULL,
  description_en TEXT DEFAULT '', description_ar TEXT DEFAULT '',
  slug TEXT, base_price REAL DEFAULT 0, image_url TEXT DEFAULT '',
  stock_quantity INTEGER DEFAULT 999,
  is_active INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0, created_at TEXT DEFAULT '', updated_at TEXT DEFAULT ''
);
CREATE TABLE IF NOT EXISTS product_variants (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, product_id TEXT NOT NULL,
  name_en TEXT NOT NULL, name_ar TEXT NOT NULL,
  price_delta REAL DEFAULT 0, stock_quantity INTEGER DEFAULT 999,
  is_active INTEGER DEFAULT 1, sort_order INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS shipping_zones (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL,
  name_en TEXT NOT NULL, name_ar TEXT NOT NULL, is_active INTEGER DEFAULT 1
);
CREATE TABLE IF NOT EXISTS shipping_rates (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, zone_id TEXT NOT NULL,
  name_en TEXT NOT NULL, name_ar TEXT NOT NULL,
  price REAL DEFAULT 0, min_days INTEGER DEFAULT 0, max_days INTEGER DEFAULT 1,
  is_active INTEGER DEFAULT 1
);
CREATE TABLE IF NOT EXISTS discount_codes (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, code TEXT NOT NULL,
  type TEXT NOT NULL, value REAL NOT NULL,
  min_order_amount REAL, max_uses INTEGER,
  used_count INTEGER DEFAULT 0, expires_at TEXT,
  is_active INTEGER DEFAULT 1, created_at TEXT DEFAULT ''
);
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, order_number TEXT NOT NULL,
  fulfillment_type TEXT NOT NULL, status TEXT DEFAULT 'pending',
  payment_method TEXT NOT NULL, payment_status TEXT DEFAULT 'pending',
  subtotal REAL DEFAULT 0, discount_amount REAL DEFAULT 0,
  shipping_amount REAL DEFAULT 0, total REAL DEFAULT 0,
  address_snapshot TEXT, shipping_rate_snapshot TEXT, discount_code_snapshot TEXT,
  branch_name TEXT, branch_address TEXT,
  special_instructions TEXT, estimated_time TEXT,
  myfatoorah_payment_id TEXT, confirmed_at TEXT,
  created_at TEXT DEFAULT '', updated_at TEXT DEFAULT ''
);
CREATE TABLE IF NOT EXISTS order_items (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, order_id TEXT NOT NULL,
  product_id TEXT, variant_id TEXT,
  product_name_en TEXT NOT NULL, product_name_ar TEXT NOT NULL,
  variant_name_en TEXT, variant_name_ar TEXT,
  quantity INTEGER DEFAULT 1, unit_price REAL DEFAULT 0, total_price REAL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL,
  name TEXT, phone TEXT, email TEXT,
  order_count INTEGER DEFAULT 0, total_spend REAL DEFAULT 0,
  created_at TEXT DEFAULT '', updated_at TEXT DEFAULT ''
);
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  actor_type TEXT NOT NULL, actor_id TEXT NOT NULL, actor_email TEXT NOT NULL,
  action TEXT NOT NULL, target_type TEXT, target_id TEXT,
  details TEXT, ip TEXT,
  created_at TEXT DEFAULT ''
);
CREATE TABLE IF NOT EXISTS platform_settings (
  id TEXT PRIMARY KEY DEFAULT 'singleton',
  platform_name TEXT DEFAULT 'Peak Multi Tenant System',
  logo_url TEXT DEFAULT '',
  default_currency TEXT DEFAULT 'KWD',
  default_commission_rate REAL DEFAULT 0,
  default_tax_rate REAL DEFAULT 0,
  payment_gateway TEXT DEFAULT 'myfatoorah',
  payment_gateway_key TEXT DEFAULT '',
  support_email TEXT DEFAULT '',
  updated_at TEXT DEFAULT ''
);
`);

// ─── Safe column migrations (add if not exist) ─────────────────
function addColumnIfMissing(table: string, column: string, definition: string) {
  try {
    const cols = sqlite.prepare(`PRAGMA table_info(${table})`).all() as any[];
    if (!cols.find(c => c.name === column)) {
      sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
  } catch {}
}

addColumnIfMissing("tenants", "commission_rate", "REAL DEFAULT 0");
addColumnIfMissing("tenants", "min_order_amount", "REAL DEFAULT 0");
addColumnIfMissing("products", "stock_quantity", "INTEGER DEFAULT 999");
addColumnIfMissing("orders", "branch_name", "TEXT");
addColumnIfMissing("orders", "branch_address", "TEXT");
addColumnIfMissing("super_admins", "role", "TEXT DEFAULT 'admin'");
addColumnIfMissing("tenant_users", "permissions", "TEXT DEFAULT '{}'");
