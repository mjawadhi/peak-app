import { db } from "./db";
import { eq, and, sql } from "drizzle-orm";
import * as schema from "@shared/schema";
import { v4 as uuidv4 } from "uuid";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const now = () => new Date().toISOString();

// ─── Secrets ──────────────────────────────────────────────────
// Require env vars in production; use ephemeral random dev defaults (never hardcoded)
if (process.env.NODE_ENV === "production" && !process.env.JWT_SA_SECRET) {
  throw new Error("JWT_SA_SECRET env var must be set in production");
}
if (process.env.NODE_ENV === "production" && !process.env.JWT_TU_SECRET) {
  throw new Error("JWT_TU_SECRET env var must be set in production");
}
export const JWT_SA_SECRET   = process.env.JWT_SA_SECRET   || ("dev-sa-" + Math.random().toString(36).slice(2));
export const JWT_TU_SECRET   = process.env.JWT_TU_SECRET   || ("dev-tu-" + Math.random().toString(36).slice(2));
export const ISSUER_SA       = "peak-super-admin";
export const ISSUER_TU       = "peak-tenant";

// ─── Seed (runs once on empty DB) ────────────────────────────
export async function seedIfEmpty() {
  const existing = db.select().from(schema.superAdmins).all();
  if (existing.length > 0) return;

  console.log("🌱 Seeding database...");

  // Plans
  const planIds = { starter: uuidv4(), growth: uuidv4(), enterprise: uuidv4() };
  db.insert(schema.plans).values([
    { id: planIds.starter, name: "starter", maxProducts: 50, maxOrdersPerMonth: 500, priceMonthly: 0, createdAt: now() },
    { id: planIds.growth, name: "growth", maxProducts: 200, maxOrdersPerMonth: 2000, priceMonthly: 49, createdAt: now() },
    { id: planIds.enterprise, name: "enterprise", maxProducts: 9999, maxOrdersPerMonth: 99999, priceMonthly: 199, createdAt: now() },
  ]).run();

  // Super Admin
  const saHash = bcrypt.hashSync("Peak@2024!", 10);
  db.insert(schema.superAdmins).values({
    id: uuidv4(), email: "admin@peak.local", passwordHash: saHash, name: "Peak Super Admin",
    isActive: 1, createdAt: now(),
  }).run();

  // Tenant 1: Burger Stack
  const T1 = uuidv4();
  db.insert(schema.tenants).values({
    id: T1, name: "Burger Stack", slug: "burgerstack", status: "active", planId: planIds.growth,
    config: JSON.stringify({
      storefront_name_en: "Burger Stack", storefront_name_ar: "برغر ستاك",
      tagline_en: "Smash. Stack. Devour.", tagline_ar: "اطحن. ارص. التهم.",
      pickup_address: "Burger Stack, Block 5, Street 12, Salmiya, Kuwait",
      pickup_instructions: "Enter from the main entrance, ask for your order at the counter.",
      pickup_estimated_time: "15–20 minutes", delivery_estimated_time: "30–45 minutes",
      contact_email: "hello@burgerstack.com", contact_phone: "22001122",
      currency: "KWD", primary_color: "#E63B2E",
    }),
    createdAt: now(), updatedAt: now(),
  }).run();

  const tuHash = bcrypt.hashSync("Peak@2024!", 10);
  db.insert(schema.tenantUsers).values({
    id: uuidv4(), tenantId: T1, email: "owner@burgerstack.local", passwordHash: tuHash,
    name: "Burger Stack Owner", role: "owner", isActive: 1, createdAt: now(),
  }).run();

  // Categories T1
  const cats1: Record<string, string> = {};
  for (const [slug, en, ar, ord] of [["burgers","Burgers","برغر",1],["sides","Sides","مقبلات",2],["drinks","Drinks","مشروبات",3]] as any[]) {
    const id = uuidv4(); cats1[slug] = id;
    db.insert(schema.categories).values({ id, tenantId: T1, nameEn: en, nameAr: ar, slug, sortOrder: ord, isActive: 1, createdAt: now() }).run();
  }

  // Products T1
  const prods1: Record<string, string> = {};
  const p1data = [
    ["classic-smash-burger","Classic Smash Burger","برغر سماش كلاسيك","Two smashed beef patties, American cheese, pickles, special sauce on a brioche bun.","باتيان من اللحم البقري المطحون، جبنة أمريكية، مخلل، صوص خاص على خبز بريوش.",cats1.burgers,3.500,true],
    ["double-stack","Double Stack","دابل ستاك","Four smashed patties with double cheese and caramelized onions.","أربع باتيات مع جبنة مزدوجة وبصل مكرمل.",cats1.burgers,5.250,false],
    ["crispy-fries","Crispy Fries","بطاطس مقرمشة","Hand-cut fries fried to golden perfection.","بطاطس مقطعة يدوياً مقلية بشكل مثالي.",cats1.sides,1.500,false],
    ["lemonade","Lemonade","ليموناضة","Fresh squeezed lemonade with mint.","ليموناضة طازجة مع نعناع.",cats1.drinks,0.750,false],
    ["onion-rings","Onion Rings","حلقات البصل","Golden crispy onion rings with ranch sauce.","حلقات بصل ذهبية مقرمشة مع صوص راينش.",cats1.sides,1.250,false],
  ] as any[];
  p1data.forEach(([slug, en, ar, den, dar, cat, price, hasVariants], i) => {
    const id = uuidv4(); prods1[slug] = id;
    db.insert(schema.products).values({ id, tenantId: T1, categoryId: cat, nameEn: en, nameAr: ar, descriptionEn: den, descriptionAr: dar, slug, basePrice: price, isActive: 1, sortOrder: i, createdAt: now(), updatedAt: now() }).run();
    if (hasVariants) {
      db.insert(schema.productVariants).values([
        { id: uuidv4(), tenantId: T1, productId: id, nameEn: "Single", nameAr: "واحد", priceDelta: 0, stockQuantity: 999, isActive: 1, sortOrder: 0 },
        { id: uuidv4(), tenantId: T1, productId: id, nameEn: "Double", nameAr: "مزدوج", priceDelta: 1.000, stockQuantity: 999, isActive: 1, sortOrder: 1 },
      ]).run();
    }
  });

  // Shipping T1
  const sz1 = uuidv4();
  db.insert(schema.shippingZones).values({ id: sz1, tenantId: T1, nameEn: "Kuwait City Area", nameAr: "منطقة مدينة الكويت", isActive: 1 }).run();
  db.insert(schema.shippingRates).values({ id: uuidv4(), tenantId: T1, zoneId: sz1, nameEn: "Standard Delivery", nameAr: "توصيل عادي", price: 0.750, minDays: 0, maxDays: 1, isActive: 1 }).run();
  db.insert(schema.discountCodes).values({ id: uuidv4(), tenantId: T1, code: "SMASH10", type: "percent", value: 10, isActive: 1, usedCount: 0, createdAt: now() }).run();

  // Tenant 2: Noor Sweets
  const T2 = uuidv4();
  db.insert(schema.tenants).values({
    id: T2, name: "Noor Sweets", slug: "noorsweets", status: "active", planId: planIds.starter,
    config: JSON.stringify({
      storefront_name_en: "Noor Sweets", storefront_name_ar: "حلويات نور",
      tagline_en: "Traditional sweets, modern taste.", tagline_ar: "حلويات تراثية، طعم عصري.",
      pickup_address: "Noor Sweets, Block 3, Street 7, Rumaithiya, Kuwait",
      pickup_instructions: "Collect from the front counter. Please bring your order number.",
      pickup_estimated_time: "10–15 minutes", delivery_estimated_time: "25–40 minutes",
      contact_email: "hello@noorsweets.com", contact_phone: "25003344",
      currency: "KWD", primary_color: "#C49A3C",
    }),
    createdAt: now(), updatedAt: now(),
  }).run();

  db.insert(schema.tenantUsers).values({
    id: uuidv4(), tenantId: T2, email: "owner@noorsweets.local", passwordHash: tuHash,
    name: "Noor Sweets Owner", role: "owner", isActive: 1, createdAt: now(),
  }).run();

  const cats2: Record<string, string> = {};
  for (const [slug, en, ar, ord] of [["kunafa","Kunafa","كنافة",1],["baklava","Baklava","بقلاوة",2],["dates","Dates","تمور",3]] as any[]) {
    const id = uuidv4(); cats2[slug] = id;
    db.insert(schema.categories).values({ id, tenantId: T2, nameEn: en, nameAr: ar, slug, sortOrder: ord, isActive: 1, createdAt: now() }).run();
  }

  [
    ["cheese-kunafa","Cheese Kunafa","كنافة جبن","Traditional cheese kunafa with sugar syrup.","كنافة جبن تقليدية مع قطر سكر.",cats2.kunafa,4.500],
    ["nutella-kunafa","Nutella Kunafa","كنافة نوتيلا","Crispy kunafa filled with creamy Nutella.","كنافة مقرمشة محشوة بالنوتيلا.",cats2.kunafa,5.000],
    ["mixed-baklava-box","Mixed Baklava Box","صندوق بقلاوة مشكل","Assorted baklava with honey and nuts. 12 pieces.","بقلاوة مشكلة بالعسل. 12 قطعة.",cats2.baklava,6.000],
    ["premium-medjool-dates","Premium Medjool Dates","تمور مجدول فاخرة","Hand-selected premium Medjool dates. 500g.","تمور مجدول فاخرة. 500 جم.",cats2.dates,8.500],
  ].forEach(([slug, en, ar, den, dar, cat, price]: any, i) => {
    db.insert(schema.products).values({ id: uuidv4(), tenantId: T2, categoryId: cat, nameEn: en, nameAr: ar, descriptionEn: den, descriptionAr: dar, slug, basePrice: price, isActive: 1, sortOrder: i, createdAt: now(), updatedAt: now() }).run();
  });

  const sz2 = uuidv4();
  db.insert(schema.shippingZones).values({ id: sz2, tenantId: T2, nameEn: "Kuwait City Area", nameAr: "منطقة مدينة الكويت", isActive: 1 }).run();
  db.insert(schema.shippingRates).values({ id: uuidv4(), tenantId: T2, zoneId: sz2, nameEn: "Standard Delivery", nameAr: "توصيل عادي", price: 1.000, minDays: 0, maxDays: 1, isActive: 1 }).run();
  db.insert(schema.discountCodes).values({ id: uuidv4(), tenantId: T2, code: "NOOR5", type: "fixed", value: 0.500, isActive: 1, usedCount: 0, createdAt: now() }).run();

  console.log("✅ Seed complete — 2 tenants, products, shipping, discounts");
}

// ─── Auth helpers ──────────────────────────────────────────────
export function signToken(payload: object, secret: string, expiresIn = "7d") {
  return jwt.sign(payload, secret, { expiresIn } as any);
}

export function verifyToken<T>(token: string, secret: string): T | null {
  try { return jwt.verify(token, secret) as T; }
  catch { return null; }
}

export function hashPassword(pw: string) { return bcrypt.hashSync(pw, 10); }
export function checkPassword(pw: string, hash: string) { return bcrypt.compareSync(pw, hash); }

// ─── Tenant lookup ─────────────────────────────────────────────
export function getTenantBySlug(slug: string) {
  return db.select().from(schema.tenants).where(eq(schema.tenants.slug, slug)).get();
}

export function getTenantById(id: string) {
  return db.select().from(schema.tenants).where(eq(schema.tenants.id, id)).get();
}

export function getAllTenants() {
  return db.select().from(schema.tenants).orderBy(schema.tenants.createdAt).all();
}

export function deleteTenant(tenantId: string) {
  // Cascade-delete all tenant data in dependency order
  db.delete(schema.orderItems).where(eq(schema.orderItems.tenantId, tenantId)).run();
  db.delete(schema.orders).where(eq(schema.orders.tenantId, tenantId)).run();
  db.delete(schema.discountCodes).where(eq(schema.discountCodes.tenantId, tenantId)).run();
  db.delete(schema.shippingRates).where(eq(schema.shippingRates.tenantId, tenantId)).run();
  db.delete(schema.shippingZones).where(eq(schema.shippingZones.tenantId, tenantId)).run();
  db.delete(schema.productVariants).where(eq(schema.productVariants.tenantId, tenantId)).run();
  db.delete(schema.products).where(eq(schema.products.tenantId, tenantId)).run();
  db.delete(schema.categories).where(eq(schema.categories.tenantId, tenantId)).run();
  db.delete(schema.tenantUsers).where(eq(schema.tenantUsers.tenantId, tenantId)).run();
  db.delete(schema.tenants).where(eq(schema.tenants.id, tenantId)).run();
}

// ─── Products ─────────────────────────────────────────────────
export function getProducts(tenantId: string, categoryId?: string) {
  const rows = categoryId
    ? db.select().from(schema.products).where(and(eq(schema.products.tenantId, tenantId), eq(schema.products.isActive, 1), eq(schema.products.categoryId, categoryId))).all()
    : db.select().from(schema.products).where(and(eq(schema.products.tenantId, tenantId), eq(schema.products.isActive, 1))).all();
  return rows.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)).map(p => ({
    ...p,
    variants: db.select().from(schema.productVariants).where(and(eq(schema.productVariants.productId, p.id), eq(schema.productVariants.isActive, 1))).all().sort((a,b) => (a.sortOrder||0)-(b.sortOrder||0)),
  }));
}

export function getCategories(tenantId: string) {
  return db.select().from(schema.categories).where(and(eq(schema.categories.tenantId, tenantId), eq(schema.categories.isActive, 1))).all().sort((a,b)=>(a.sortOrder||0)-(b.sortOrder||0));
}

export function getShippingRates(tenantId: string) {
  const zones = db.select().from(schema.shippingZones).where(and(eq(schema.shippingZones.tenantId, tenantId), eq(schema.shippingZones.isActive, 1))).all();
  const rates: any[] = [];
  zones.forEach(z => {
    db.select().from(schema.shippingRates).where(and(eq(schema.shippingRates.zoneId, z.id), eq(schema.shippingRates.isActive, 1))).all().forEach(r => rates.push(r));
  });
  return rates;
}

// ─── Discounts ────────────────────────────────────────────────
export function validateDiscount(tenantId: string, code: string) {
  return db.select().from(schema.discountCodes)
    .where(and(eq(schema.discountCodes.tenantId, tenantId), eq(schema.discountCodes.code, code.toUpperCase()), eq(schema.discountCodes.isActive, 1)))
    .get();
}

// ─── Orders ───────────────────────────────────────────────────
let orderSeq = 1000;

export function createOrder(data: {
  tenantId: string;
  fulfillmentType: string;
  paymentMethod: string;
  items: Array<{ productId: string; variantId?: string | null; quantity: number }>;
  address?: any;
  shippingRateId?: string;
  discountCode?: string;
  specialInstructions?: string;
}) {
  const { tenantId, fulfillmentType, paymentMethod, items, address, shippingRateId, discountCode, specialInstructions } = data;

  // Resolve items from DB and compute subtotal
  let subtotal = 0;
  const resolvedItems: any[] = [];
  for (const ri of items) {
    const product = db.select().from(schema.products).where(and(eq(schema.products.id, ri.productId), eq(schema.products.tenantId, tenantId))).get();
    if (!product) throw new Error(`Product not found: ${ri.productId}`);
    let unitPrice = parseFloat(String(product.basePrice));
    let variant = null;
    if (ri.variantId) {
      variant = db.select().from(schema.productVariants).where(eq(schema.productVariants.id, ri.variantId)).get();
      if (variant) unitPrice += parseFloat(String(variant.priceDelta || 0));
    }
    const qty = Math.max(1, ri.quantity || 1);
    subtotal += unitPrice * qty;
    resolvedItems.push({ product, variant, qty, unitPrice });
  }

  // Shipping
  let shippingAmount = 0;
  let shippingSnapshot: any = null;
  if (fulfillmentType === "delivery" && shippingRateId) {
    const rate = db.select().from(schema.shippingRates).where(eq(schema.shippingRates.id, shippingRateId)).get();
    if (rate) { shippingAmount = parseFloat(String(rate.price)); shippingSnapshot = rate; }
  }

  // Discount
  let discountAmount = 0;
  let discountSnapshot: any = null;
  if (discountCode) {
    const dc = validateDiscount(tenantId, discountCode);
    if (dc) {
      discountAmount = dc.type === "percent" ? subtotal * (dc.value / 100) : dc.value;
      discountAmount = Math.min(discountAmount, subtotal);
      discountSnapshot = dc;
      db.update(schema.discountCodes).set({ usedCount: (dc.usedCount || 0) + 1 }).where(eq(schema.discountCodes.id, dc.id)).run();
    }
  }

  const total = subtotal + shippingAmount - discountAmount;
  const tenant = getTenantById(tenantId);
  const cfg = JSON.parse(tenant?.config || "{}");
  const estimatedTime = fulfillmentType === "pickup"
    ? (cfg.pickup_estimated_time || "15–20 minutes")
    : (cfg.delivery_estimated_time || "30–45 minutes");

  const orderNumber = `ORD-${String(++orderSeq).padStart(6, "0")}`;
  const orderId = uuidv4();
  const initialStatus = "pending"; // all orders start as pending regardless of payment method

  db.insert(schema.orders).values({
    id: orderId, tenantId, orderNumber, fulfillmentType,
    status: initialStatus, paymentMethod,
    paymentStatus: "pending",
    subtotal: +subtotal.toFixed(3), discountAmount: +discountAmount.toFixed(3),
    shippingAmount: +shippingAmount.toFixed(3), total: +total.toFixed(3),
    addressSnapshot: address ? JSON.stringify(address) : null,
    shippingRateSnapshot: shippingSnapshot ? JSON.stringify(shippingSnapshot) : null,
    discountCodeSnapshot: discountSnapshot ? JSON.stringify(discountSnapshot) : null,
    specialInstructions: specialInstructions || null,
    estimatedTime,
    confirmedAt: null,
    createdAt: now(), updatedAt: now(),
  }).run();

  // Insert order items
  resolvedItems.forEach(({ product, variant, qty, unitPrice }) => {
    db.insert(schema.orderItems).values({
      id: uuidv4(), tenantId, orderId,
      productId: product.id, variantId: variant?.id || null,
      productNameEn: product.nameEn, productNameAr: product.nameAr,
      variantNameEn: variant?.nameEn || null, variantNameAr: variant?.nameAr || null,
      quantity: qty, unitPrice, totalPrice: unitPrice * qty,
    }).run();
  });

  // HMAC-sign the mock payment callback to prevent unauthenticated confirmation
  const crypto = require("crypto");
  const mockSig = crypto.createHmac("sha256", JWT_TU_SECRET)
    .update(`${orderId}:${tenantId}`)
    .digest("hex")
    .slice(0, 16);
  const paymentUrl = paymentMethod === "myfatoorah"
    ? `/api/payments/mock-confirm?orderId=${orderId}&orderNumber=${orderNumber}&tenantId=${tenantId}&slug=${tenant?.slug || ""}&sig=${mockSig}`
    : null;

  if (paymentUrl) {
    db.update(schema.orders).set({ myFatoorahPaymentId: `MOCK-${orderNumber}` }).where(eq(schema.orders.id, orderId)).run();
  }

  return { orderId, orderNumber, fulfillmentType, paymentMethod, total: +total.toFixed(3), estimatedTime, status: initialStatus, paymentUrl };
}

export function getOrders(tenantId: string) {
  const rows = db.select().from(schema.orders).where(eq(schema.orders.tenantId, tenantId)).all()
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  return rows.map(o => ({
    ...o,
    items: db.select().from(schema.orderItems).where(eq(schema.orderItems.orderId, o.id)).all(),
  }));
}

export function updateOrderStatus(tenantId: string, orderId: string, status: string) {
  db.update(schema.orders).set({ status, updatedAt: now() })
    .where(and(eq(schema.orders.id, orderId), eq(schema.orders.tenantId, tenantId))).run();
}

export function confirmPayment(orderId: string, tenantId: string) {
  db.update(schema.orders).set({ paymentStatus: "paid", status: "confirmed", confirmedAt: now(), updatedAt: now() })
    .where(and(eq(schema.orders.id, orderId), eq(schema.orders.tenantId, tenantId))).run();
}

// ─── Dashboard helpers ─────────────────────────────────────────
export function getDashboardProducts(tenantId: string) {
  return db.select().from(schema.products).where(eq(schema.products.tenantId, tenantId)).all()
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
}

export function createProduct(tenantId: string, data: { nameEn: string; nameAr: string; basePrice: number; descriptionEn?: string; descriptionAr?: string; categoryId?: string; imageUrl?: string }) {
  const id = uuidv4();
  const slug = data.nameEn.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  db.insert(schema.products).values({ id, tenantId, slug, isActive: 1, sortOrder: 999, createdAt: now(), updatedAt: now(), ...data }).run();
  return db.select().from(schema.products).where(eq(schema.products.id, id)).get();
}

export function updateTenantConfig(tenantId: string, config: Record<string, any>) {
  const tenant = getTenantById(tenantId);
  const merged = { ...JSON.parse(tenant?.config || "{}"), ...config };
  db.update(schema.tenants).set({ config: JSON.stringify(merged), updatedAt: now() }).where(eq(schema.tenants.id, tenantId)).run();
  return merged;
}

// ─── Super admin helpers ───────────────────────────────────────
export function createTenant(data: { name: string; slug: string; planName?: string; ownerEmail?: string; ownerPassword?: string; ownerName?: string }) {
  const { name, slug, planName, ownerEmail, ownerPassword, ownerName } = data;
  const existing = getTenantBySlug(slug);
  if (existing) throw new Error("Slug already taken");
  const plan = planName ? db.select().from(schema.plans).where(eq(schema.plans.name, planName)).get() : null;
  const id = uuidv4();
  db.insert(schema.tenants).values({
    id, name, slug, status: "active", planId: plan?.id || null,
    config: JSON.stringify({ storefront_name_en: name, primary_color: "#6c63ff" }),
    createdAt: now(), updatedAt: now(),
  }).run();
  if (ownerEmail && ownerPassword) {
    db.insert(schema.tenantUsers).values({
      id: uuidv4(), tenantId: id, email: ownerEmail,
      passwordHash: hashPassword(ownerPassword), name: ownerName || ownerEmail,
      role: "owner", isActive: 1, createdAt: now(),
    }).run();
  }
  // Auto shipping
  const szId = uuidv4();
  db.insert(schema.shippingZones).values({ id: szId, tenantId: id, nameEn: "Kuwait City Area", nameAr: "منطقة مدينة الكويت", isActive: 1 }).run();
  db.insert(schema.shippingRates).values({ id: uuidv4(), tenantId: id, zoneId: szId, nameEn: "Standard Delivery", nameAr: "توصيل عادي", price: 1.0, minDays: 0, maxDays: 1, isActive: 1 }).run();
  return getTenantById(id);
}

export function updateTenantStatus(id: string, status: string) {
  db.update(schema.tenants).set({ status, updatedAt: now() }).where(eq(schema.tenants.id, id)).run();
}

export function getAllTenantsWithOwners() {
  const allTenants = getAllTenants();
  return allTenants.map(t => {
    const owner = db.select().from(schema.tenantUsers)
      .where(and(eq(schema.tenantUsers.tenantId, t.id), eq(schema.tenantUsers.role, "owner"))).get();
    const plan = t.planId ? db.select().from(schema.plans).where(eq(schema.plans.id, t.planId)).get() : null;
    const orderCount = db.select().from(schema.orders).where(eq(schema.orders.tenantId, t.id)).all().length;
    return { ...t, config: JSON.parse(t.config || "{}"), ownerEmail: owner?.email || null, planName: plan?.name || null, orderCount };
  });
}
