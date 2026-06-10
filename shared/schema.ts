import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ─── Plans ────────────────────────────────────────────────────
export const plans = sqliteTable("plans", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  maxProducts: integer("max_products").default(100),
  maxOrdersPerMonth: integer("max_orders_per_month").default(1000),
  priceMonthly: real("price_monthly").default(0),
  isActive: integer("is_active").default(1),
  createdAt: text("created_at").default(""),
});

// ─── Tenants ──────────────────────────────────────────────────
export const tenants = sqliteTable("tenants", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  status: text("status").default("pending"), // active | suspended | pending
  planId: text("plan_id"),                   // free | pro | enterprise
  commissionRate: real("commission_rate").default(0), // platform commission %
  minOrderAmount: real("min_order_amount").default(0),
  config: text("config").default("{}"), // JSON: storefront settings
  createdAt: text("created_at").default(""),
  updatedAt: text("updated_at").default(""),
});

// ─── Super Admins ─────────────────────────────────────────────
export const superAdmins = sqliteTable("super_admins", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name"),
  role: text("role").default("admin"), // admin | auditor
  isActive: integer("is_active").default(1),
  createdAt: text("created_at").default(""),
});

// ─── Tenant Users (owners / staff) ───────────────────────────
export const tenantUsers = sqliteTable("tenant_users", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  email: text("email").notNull(),
  passwordHash: text("password_hash").notNull(),
  name: text("name"),
  role: text("role").default("staff"), // owner | manager | staff | viewer | custom
  permissions: text("permissions").default("{}"), // JSON: { orders, products, customers, settings, team }
  isActive: integer("is_active").default(1),
  createdAt: text("created_at").default(""),
});

// ─── Categories ───────────────────────────────────────────────
export const categories = sqliteTable("categories", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  nameEn: text("name_en").notNull(),
  nameAr: text("name_ar").notNull(),
  slug: text("slug"),
  sortOrder: integer("sort_order").default(0),
  isActive: integer("is_active").default(1),
  createdAt: text("created_at").default(""),
});

// ─── Products ─────────────────────────────────────────────────
export const products = sqliteTable("products", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  categoryId: text("category_id"),
  nameEn: text("name_en").notNull(),
  nameAr: text("name_ar").notNull(),
  descriptionEn: text("description_en").default(""),
  descriptionAr: text("description_ar").default(""),
  slug: text("slug"),
  basePrice: real("base_price").default(0),
  imageUrl: text("image_url").default(""),
  imagePosition: text("image_position").default("50% 50%"), // CSS object-position e.g. "50% 30%"
  stockQuantity: integer("stock_quantity").default(999),
  isActive: integer("is_active").default(1),
  sortOrder: integer("sort_order").default(0),
  createdAt: text("created_at").default(""),
  updatedAt: text("updated_at").default(""),
});

// ─── Product Variants ─────────────────────────────────────────
export const productVariants = sqliteTable("product_variants", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  productId: text("product_id").notNull(),
  nameEn: text("name_en").notNull(),
  nameAr: text("name_ar").notNull(),
  priceDelta: real("price_delta").default(0),
  stockQuantity: integer("stock_quantity").default(999),
  isActive: integer("is_active").default(1),
  sortOrder: integer("sort_order").default(0),
});

// ─── Shipping Zones + Rates ───────────────────────────────────
export const shippingZones = sqliteTable("shipping_zones", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  nameEn: text("name_en").notNull(),
  nameAr: text("name_ar").notNull(),
  isActive: integer("is_active").default(1),
});

export const shippingRates = sqliteTable("shipping_rates", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  zoneId: text("zone_id").notNull(),
  nameEn: text("name_en").notNull(),
  nameAr: text("name_ar").notNull(),
  price: real("price").default(0),
  minDays: integer("min_days").default(0),
  maxDays: integer("max_days").default(1),
  isActive: integer("is_active").default(1),
});

// ─── Discount Codes ───────────────────────────────────────────
export const discountCodes = sqliteTable("discount_codes", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  code: text("code").notNull(),
  type: text("type").notNull(), // percent | fixed
  value: real("value").notNull(),
  minOrderAmount: real("min_order_amount"),
  maxUses: integer("max_uses"),
  usedCount: integer("used_count").default(0),
  expiresAt: text("expires_at"),
  isActive: integer("is_active").default(1),
  createdAt: text("created_at").default(""),
});

// ─── Orders ───────────────────────────────────────────────────
export const orders = sqliteTable("orders", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  orderNumber: text("order_number").notNull(),
  fulfillmentType: text("fulfillment_type").notNull(), // pickup | delivery
  status: text("status").default("pending"),
  paymentMethod: text("payment_method").notNull(),     // myfatoorah | cash
  paymentStatus: text("payment_status").default("pending"),
  subtotal: real("subtotal").default(0),
  discountAmount: real("discount_amount").default(0),
  shippingAmount: real("shipping_amount").default(0),
  total: real("total").default(0),
  addressSnapshot: text("address_snapshot"),
  shippingRateSnapshot: text("shipping_rate_snapshot"),
  discountCodeSnapshot: text("discount_code_snapshot"),
  branchName: text("branch_name"),
  branchAddress: text("branch_address"),
  specialInstructions: text("special_instructions"),
  estimatedTime: text("estimated_time"),
  myFatoorahPaymentId: text("myfatoorah_payment_id"),
  confirmedAt: text("confirmed_at"),
  createdAt: text("created_at").default(""),
  updatedAt: text("updated_at").default(""),
});

// ─── Order Items ──────────────────────────────────────────────
export const orderItems = sqliteTable("order_items", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  orderId: text("order_id").notNull(),
  productId: text("product_id"),
  variantId: text("variant_id"),
  productNameEn: text("product_name_en").notNull(),
  productNameAr: text("product_name_ar").notNull(),
  variantNameEn: text("variant_name_en"),
  variantNameAr: text("variant_name_ar"),
  quantity: integer("quantity").default(1),
  unitPrice: real("unit_price").default(0),
  totalPrice: real("total_price").default(0),
});

// ─── Customers ────────────────────────────────────────────────
export const customers = sqliteTable("customers", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  name: text("name"),
  phone: text("phone"),
  email: text("email"),
  orderCount: integer("order_count").default(0),
  totalSpend: real("total_spend").default(0),
  createdAt: text("created_at").default(""),
  updatedAt: text("updated_at").default(""),
});

// ─── Audit Log ────────────────────────────────────────────────
export const auditLogs = sqliteTable("audit_logs", {
  id: text("id").primaryKey(),
  actorType: text("actor_type").notNull(), // super_admin | tenant_user
  actorId: text("actor_id").notNull(),
  actorEmail: text("actor_email").notNull(),
  action: text("action").notNull(),        // e.g. tenant.delete, order.status_change
  targetType: text("target_type"),         // tenant | order | product | user
  targetId: text("target_id"),
  details: text("details"),               // JSON
  ip: text("ip"),
  createdAt: text("created_at").default(""),
});

// ─── Platform Settings ────────────────────────────────────────
export const platformSettings = sqliteTable("platform_settings", {
  id: text("id").primaryKey().default("singleton"),
  platformName: text("platform_name").default("Peak Multi Tenant System"),
  logoUrl: text("logo_url").default(""),
  defaultCurrency: text("default_currency").default("KWD"),
  defaultCommissionRate: real("default_commission_rate").default(0),
  defaultTaxRate: real("default_tax_rate").default(0),
  paymentGateway: text("payment_gateway").default("myfatoorah"),
  paymentGatewayKey: text("payment_gateway_key").default(""),
  supportEmail: text("support_email").default(""),
  updatedAt: text("updated_at").default(""),
});

// ─── Insert Schemas ───────────────────────────────────────────
export const insertProductSchema = createInsertSchema(products).omit({ id: true, createdAt: true, updatedAt: true });
export const insertOrderSchema = createInsertSchema(orders).omit({ id: true, createdAt: true, updatedAt: true });
export const insertTenantSchema = createInsertSchema(tenants).omit({ id: true, createdAt: true, updatedAt: true });

// ─── Types ────────────────────────────────────────────────────
export type Plan = typeof plans.$inferSelect;
export type Tenant = typeof tenants.$inferSelect;
export type TenantUser = typeof tenantUsers.$inferSelect;
export type SuperAdmin = typeof superAdmins.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Product = typeof products.$inferSelect;
export type ProductVariant = typeof productVariants.$inferSelect;
export type ShippingRate = typeof shippingRates.$inferSelect;
export type DiscountCode = typeof discountCodes.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
export type Customer = typeof customers.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type PlatformSettings = typeof platformSettings.$inferSelect;

export type InsertProduct = z.infer<typeof insertProductSchema>;
export type InsertTenant = z.infer<typeof insertTenantSchema>;

// Extended types with joins
export type ProductWithVariants = Product & { variants: ProductVariant[] };
export type OrderWithItems = Order & { items: OrderItem[] };
