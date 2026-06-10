import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from "node:http";
import jwt from "jsonwebtoken";
import {
  seedIfEmpty, signToken, verifyToken, checkPassword, hashPassword,
  getTenantBySlug, getTenantById, getAllTenantsWithOwners,
  getProducts, getCategories, getShippingRates, validateDiscount,
  createOrder, getOrders, updateOrderStatus, confirmPayment,
  getDashboardProducts, createProduct, updateTenantConfig,
  createTenant, updateTenantStatus, deleteTenant,
  JWT_SA_SECRET, JWT_TU_SECRET, ISSUER_SA, ISSUER_TU,
} from "./storage";
import { db } from "./db";
import { eq, and, desc } from "drizzle-orm";
import * as schema from "@shared/schema";
import { v4 as uuidv4 } from "uuid";

const now = () => new Date().toISOString();

// ─── JWT middleware ────────────────────────────────────────────
interface SAPayload { sub: string; email: string; role: "super_admin"; iss: string }
interface TUPayload { sub: string; email: string; role: string; tenantId: string; iss: string }

function getBearer(req: Request): string | null {
  const h = req.headers.authorization;
  return h?.startsWith("Bearer ") ? h.slice(7) : null;
}

function requireSA(req: Request, res: Response, next: NextFunction) {
  const token = getBearer(req);
  if (!token) return res.status(401).json({ message: "Unauthorized" });
  const payload = verifyToken<SAPayload>(token, JWT_SA_SECRET);
  if (!payload || payload.role !== "super_admin") return res.status(403).json({ message: "Super admin required" });
  (req as any).admin = payload;
  next();
}

function requireTU(req: Request, res: Response, next: NextFunction) {
  const token = getBearer(req);
  if (!token) return res.status(401).json({ message: "Unauthorized" });
  const payload = verifyToken<TUPayload>(token, JWT_TU_SECRET);
  if (!payload) return res.status(401).json({ message: "Invalid token" });
  const slug = req.params.slug;
  if (slug) {
    const tenant = getTenantBySlug(slug);
    if (!tenant || tenant.id !== payload.tenantId) {
      return res.status(403).json({ message: "Access denied to this store" });
    }
  }
  (req as any).tenantUser = payload;
  next();
}

// ─── Audit log helper ─────────────────────────────────────────
function auditLog(req: Request, actorType: "super_admin" | "tenant_user", action: string, targetType?: string, targetId?: string, details?: object) {
  try {
    const admin = (req as any).admin as SAPayload | undefined;
    const tenantUser = (req as any).tenantUser as TUPayload | undefined;
    const actor = admin || tenantUser;
    if (!actor) return;
    db.insert(schema.auditLogs).values({
      id: uuidv4(),
      actorType, actorId: actor.sub, actorEmail: actor.email,
      action, targetType: targetType || null, targetId: targetId || null,
      details: details ? JSON.stringify(details) : null,
      ip: req.ip || null,
      createdAt: now(),
    }).run();
  } catch {}
}

// ─── Permission presets ──────────────────────────────────────────
export interface TenantPermissions {
  orders: "none" | "view" | "manage";
  products: "none" | "view" | "manage";
  customers: "none" | "view";
  settings: boolean;
  team: boolean;
}

function getDefaultPermissions(role: string): TenantPermissions {
  switch (role) {
    case "owner":   return { orders: "manage", products: "manage", customers: "view", settings: true,  team: true  };
    case "manager": return { orders: "manage", products: "manage", customers: "view", settings: false, team: false };
    case "staff":   return { orders: "manage", products: "view",   customers: "none", settings: false, team: false };
    case "viewer":  return { orders: "view",   products: "view",   customers: "none", settings: false, team: false };
    default:        return { orders: "none",   products: "none",   customers: "none", settings: false, team: false };
  }
}

// ─── Validate checkout address ─────────────────────────────────
function validateAddress(addr: any, type: string): string | null {
  if (!addr.firstName?.trim()) return "First name is required";
  if (!addr.lastName?.trim()) return "Last name is required";
  if (!/^\d{8}$/.test(addr.phone || "")) return "Phone must be exactly 8 digits";
  if (!addr.area?.trim()) return "Area is required";
  if (!addr.block?.trim()) return "Block is required";
  if (!addr.street?.trim()) return "Street is required";
  if (!addr.jadda?.trim()) return "Jadda is required";
  if (type === "house" && !addr.houseNumber?.trim()) return "House number is required";
  if ((type === "apartment" || type === "office") && !addr.buildingNumber?.trim()) return "Building number is required";
  return null;
}

// ─── Email validation ──────────────────────────────────────────
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  await seedIfEmpty();

  // ─── Health ──────────────────────────────────────────────────
  app.get("/api/health", (_req, res) => res.json({ status: "ok", version: "1.0.0-phase1" }));

  // ─── SUPER ADMIN AUTH ─────────────────────────────────────────
  app.post("/api/super-admin/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      const admin = db.select().from(schema.superAdmins).where(eq(schema.superAdmins.email, email)).get();
      if (!admin || !checkPassword(password, admin.passwordHash))
        return res.status(401).json({ message: "Invalid credentials" });
      const token = signToken({ sub: admin.id, email: admin.email, role: "super_admin", iss: ISSUER_SA }, JWT_SA_SECRET);
      res.json({ token, user: { id: admin.id, email: admin.email, name: admin.name, role: "super_admin" } });
    } catch (e: any) { console.error(e); res.status(500).json({ message: "Internal server error" }); }
  });

  // ─── SUPER ADMIN: TENANTS ─────────────────────────────────────
  app.get("/api/super-admin/tenants", requireSA, (_req, res) => {
    try { res.json(getAllTenantsWithOwners()); }
    catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/super-admin/tenants", requireSA, (req, res) => {
    try {
      const { name, slug, ownerEmail, ownerPassword } = req.body;
      if (!name?.trim()) return res.status(400).json({ message: "Store name is required" });
      if (!slug?.trim() || !/^[a-z0-9-]+$/.test(slug)) return res.status(400).json({ message: "Slug must be lowercase letters, numbers, hyphens only" });
      if (ownerEmail && !isValidEmail(ownerEmail)) return res.status(400).json({ message: "Invalid owner email address" });
      const tenant = createTenant(req.body);
      auditLog(req, "super_admin", "tenant.create", "tenant", tenant?.id, { name, slug });
      res.status(201).json(tenant);
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });

  // Slug availability check
  app.get("/api/super-admin/slug-check", requireSA, (req, res) => {
    try {
      const slug = req.query.slug as string;
      const excludeId = req.query.excludeId as string | undefined;
      if (!slug) return res.status(400).json({ message: "slug required" });
      const existing = getTenantBySlug(slug);
      const taken = existing && existing.id !== excludeId;
      res.json({ available: !taken });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.patch("/api/super-admin/tenants/:id/status", requireSA, (req, res) => {
    try {
      const VALID = ["active","suspended","pending"];
      const { status } = req.body;
      if (!VALID.includes(status)) return res.status(400).json({ message: "Invalid status" });
      const tenant = getTenantById(req.params.id);
      updateTenantStatus(req.params.id, status);
      auditLog(req, "super_admin", "tenant.status_change", "tenant", req.params.id, { from: tenant?.status, to: status });
      res.json({ id: req.params.id, status });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // SA: update tenant full info (store identity + slug + owner email + plan + commission + min order)
  app.patch("/api/super-admin/tenants/:id/store-info", requireSA, (req, res) => {
    try {
      const { name, description, logoUrl, primaryColor, slug, ownerEmail, planId, commissionRate, minOrderAmount } = req.body;
      const tenant = getTenantById(req.params.id);
      if (!tenant) return res.status(404).json({ message: "Tenant not found" });

      // Slug change — check uniqueness
      if (slug && slug !== tenant.slug) {
        if (!/^[a-z0-9-]+$/.test(slug)) return res.status(400).json({ message: "Slug must be lowercase letters, numbers, hyphens only" });
        const existing = getTenantBySlug(slug);
        if (existing && existing.id !== req.params.id) return res.status(400).json({ message: "Slug already taken" });
        db.update(schema.tenants).set({ slug, updatedAt: now() }).where(eq(schema.tenants.id, req.params.id)).run();
      }

      // Owner email change
      if (ownerEmail !== undefined) {
        if (!isValidEmail(ownerEmail)) return res.status(400).json({ message: "Invalid email address" });
        const owner = db.select().from(schema.tenantUsers)
          .where(and(eq(schema.tenantUsers.tenantId, req.params.id), eq(schema.tenantUsers.role, "owner"))).get();
        if (owner) {
          db.update(schema.tenantUsers).set({ email: ownerEmail }).where(eq(schema.tenantUsers.id, owner.id)).run();
        }
      }

      // Plan / commission / min order
      const tenantUpdates: any = { updatedAt: now() };
      if (name) tenantUpdates.name = name;
      if (planId !== undefined) tenantUpdates.planId = planId || null;
      if (commissionRate !== undefined) tenantUpdates.commissionRate = parseFloat(commissionRate) || 0;
      if (minOrderAmount !== undefined) tenantUpdates.minOrderAmount = parseFloat(minOrderAmount) || 0;
      db.update(schema.tenants).set(tenantUpdates).where(eq(schema.tenants.id, req.params.id)).run();

      // Config JSON
      const cfg = JSON.parse(tenant.config || "{}");
      const merged = { ...cfg };
      if (name !== undefined) merged.name = name;
      if (description !== undefined) merged.description = description;
      if (logoUrl !== undefined) merged.logoUrl = logoUrl;
      if (primaryColor !== undefined) merged.primaryColor = primaryColor;
      db.update(schema.tenants).set({ config: JSON.stringify(merged), updatedAt: now() }).where(eq(schema.tenants.id, req.params.id)).run();

      auditLog(req, "super_admin", "tenant.update", "tenant", req.params.id, { name, slug, ownerEmail });
      res.json({ ok: true });
    } catch (e: any) { console.error(e); res.status(500).json({ message: "Internal server error" }); }
  });

  // SA: delete tenant
  app.delete("/api/super-admin/tenants/:id", requireSA, (req, res) => {
    try {
      const tenant = getTenantById(req.params.id);
      if (!tenant) return res.status(404).json({ message: "Tenant not found" });
      auditLog(req, "super_admin", "tenant.delete", "tenant", req.params.id, { name: tenant.name, slug: tenant.slug });
      deleteTenant(req.params.id);
      res.json({ message: "Tenant deleted" });
    } catch (e: any) { res.status(500).json({ message: e.message || "Failed" }); }
  });

  // ─── SUPER ADMIN: TENANT USERS ────────────────────────────────
  // List all users under a specific tenant
  app.get("/api/super-admin/tenants/:id/users", requireSA, (req, res) => {
    try {
      const users = db.select().from(schema.tenantUsers)
        .where(eq(schema.tenantUsers.tenantId, req.params.id)).all();
      res.json(users.map(u => ({
        id: u.id, email: u.email, name: u.name, role: u.role,
        permissions: (() => { try { return JSON.parse((u as any).permissions || "{}"); } catch { return {}; } })(),
        isActive: u.isActive, createdAt: u.createdAt,
      })));
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // SA create user under tenant
  app.post("/api/super-admin/tenants/:id/users", requireSA, (req, res) => {
    try {
      const { email, password, name, role, permissions } = req.body;
      if (!email || !password) return res.status(400).json({ message: "Email and password required" });
      const exists = db.select().from(schema.tenantUsers)
        .where(and(eq(schema.tenantUsers.tenantId, req.params.id), eq(schema.tenantUsers.email, email))).get();
      if (exists) return res.status(400).json({ message: "Email already in use" });
      const id = uuidv4();
      db.insert(schema.tenantUsers).values({
        id, tenantId: req.params.id, email,
        passwordHash: hashPassword(password),
        name: name || email,
        role: role || "staff",
        permissions: JSON.stringify(permissions || getDefaultPermissions(role || "staff")),
        isActive: 1, createdAt: now(),
      }).run();
      auditLog(req, "super_admin", "tenant_user.create", "tenant_user", id, { email, role, tenantId: req.params.id });
      res.status(201).json({ id, email, name, role });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // SA edit user under tenant
  app.patch("/api/super-admin/tenants/:id/users/:userId", requireSA, (req, res) => {
    try {
      const { name, email, password, role, permissions, isActive } = req.body;
      const updates: Record<string, any> = {};
      if (name !== undefined) updates.name = name;
      if (email !== undefined) updates.email = email;
      if (password) updates.passwordHash = hashPassword(password);
      if (role !== undefined) updates.role = role;
      if (permissions !== undefined) updates.permissions = JSON.stringify(permissions);
      if (isActive !== undefined) updates.isActive = isActive ? 1 : 0;
      db.update(schema.tenantUsers).set(updates)
        .where(and(eq(schema.tenantUsers.id, req.params.userId), eq(schema.tenantUsers.tenantId, req.params.id))).run();
      auditLog(req, "super_admin", "tenant_user.update", "tenant_user", req.params.userId, { role, isActive });
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // SA delete user under tenant (cannot delete owner)
  app.delete("/api/super-admin/tenants/:id/users/:userId", requireSA, (req, res) => {
    try {
      const user = db.select().from(schema.tenantUsers)
        .where(and(eq(schema.tenantUsers.id, req.params.userId), eq(schema.tenantUsers.tenantId, req.params.id))).get();
      if (!user) return res.status(404).json({ message: "User not found" });
      if (user.role === "owner") return res.status(400).json({ message: "Cannot delete the store owner" });
      auditLog(req, "super_admin", "tenant_user.delete", "tenant_user", req.params.userId, { email: user.email });
      db.delete(schema.tenantUsers).where(eq(schema.tenantUsers.id, req.params.userId)).run();
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // SA: impersonate
  app.post("/api/super-admin/impersonate/:tenantId", requireSA, (req, res) => {
    try {
      const tenant = getTenantById(req.params.tenantId);
      if (!tenant) return res.status(404).json({ message: "Tenant not found" });
      const owner = db.select().from(schema.tenantUsers)
        .where(and(eq(schema.tenantUsers.tenantId, tenant.id), eq(schema.tenantUsers.role, "owner"))).get();
      if (!owner) return res.status(404).json({ message: "No owner found for this tenant" });
      const token = signToken({ sub: owner.id, email: owner.email, role: owner.role, tenantId: tenant.id, iss: ISSUER_TU }, JWT_TU_SECRET);
      auditLog(req, "super_admin", "tenant.impersonate", "tenant", tenant.id, { slug: tenant.slug });
      res.json({ token, tenant: { id: tenant.id, slug: tenant.slug, name: tenant.name } });
    } catch (e: any) { console.error(e); res.status(500).json({ message: "Internal server error" }); }
  });

  // ─── SUPER ADMIN: STATS ───────────────────────────────────────
  app.get("/api/super-admin/stats", requireSA, (_req, res) => {
    try {
      const allTenants = getAllTenantsWithOwners();
      const allOrders = db.select().from(schema.orders).all();
      const totalRevenue = allOrders.reduce((s, o) => s + (parseFloat(String(o.total)) || 0), 0);
      const paidRevenue = allOrders.filter(o => o.paymentStatus === "paid").reduce((s, o) => s + (parseFloat(String(o.total)) || 0), 0);
      res.json({
        totalTenants: allTenants.length,
        activeTenants: allTenants.filter(t => t.status === "active").length,
        totalOrders: allOrders.length,
        totalRevenue: +totalRevenue.toFixed(3),
        paidRevenue: +paidRevenue.toFixed(3),
      });
    } catch (e: any) { console.error(e); res.status(500).json({ message: "Internal server error" }); }
  });

  // ─── SUPER ADMIN: ALL ORDERS ──────────────────────────────────
  app.get("/api/super-admin/orders", requireSA, (req, res) => {
    try {
      const { tenantId, status, paymentMethod, from, to } = req.query as Record<string, string>;
      let rows = db.select().from(schema.orders).all();
      if (tenantId) rows = rows.filter(o => o.tenantId === tenantId);
      if (status) rows = rows.filter(o => o.status === status);
      if (paymentMethod) rows = rows.filter(o => o.paymentMethod === paymentMethod);
      if (from) rows = rows.filter(o => o.createdAt >= from);
      if (to) rows = rows.filter(o => o.createdAt <= to + "T23:59:59");
      rows = rows.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
      const enriched = rows.map(o => {
        const t = getTenantById(o.tenantId);
        const items = db.select().from(schema.orderItems).where(eq(schema.orderItems.orderId, o.id)).all();
        return { ...o, tenantName: t?.name || o.tenantId, tenantSlug: t?.slug || "", items };
      });
      res.json(enriched);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ─── SUPER ADMIN: ANALYTICS ───────────────────────────────────
  app.get("/api/super-admin/analytics", requireSA, (_req, res) => {
    try {
      const allOrders = db.select().from(schema.orders).all();
      const allTenants = getAllTenantsWithOwners();

      // Revenue per day (last 30 days)
      const revenueByDay: Record<string, number> = {};
      const ordersCountByDay: Record<string, number> = {};
      allOrders.forEach(o => {
        const day = (o.createdAt || "").slice(0, 10);
        revenueByDay[day] = (revenueByDay[day] || 0) + (parseFloat(String(o.total)) || 0);
        ordersCountByDay[day] = (ordersCountByDay[day] || 0) + 1;
      });

      // Revenue per tenant (GMV)
      const revenueByTenant: Record<string, number> = {};
      const ordersByTenant: Record<string, number> = {};
      allOrders.forEach(o => {
        revenueByTenant[o.tenantId] = (revenueByTenant[o.tenantId] || 0) + (parseFloat(String(o.total)) || 0);
        ordersByTenant[o.tenantId] = (ordersByTenant[o.tenantId] || 0) + 1;
      });

      const topTenants = allTenants
        .map(t => ({ id: t.id, name: t.name, slug: t.slug, revenue: +(revenueByTenant[t.id] || 0).toFixed(3), orders: ordersByTenant[t.id] || 0 }))
        .sort((a, b) => b.revenue - a.revenue);

      // Status breakdown
      const statusBreakdown: Record<string, number> = {};
      allOrders.forEach(o => { statusBreakdown[o.status || "unknown"] = (statusBreakdown[o.status || "unknown"] || 0) + 1; });

      res.json({ revenueByDay, ordersCountByDay, topTenants, statusBreakdown });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ─── SUPER ADMIN: AUDIT LOG ───────────────────────────────────
  app.get("/api/super-admin/audit-logs", requireSA, (_req, res) => {
    try {
      const logs = db.select().from(schema.auditLogs).all()
        .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))
        .slice(0, 500);
      res.json(logs);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ─── SUPER ADMIN: PLATFORM SETTINGS ──────────────────────────
  app.get("/api/super-admin/settings", requireSA, (_req, res) => {
    try {
      let s = db.select().from(schema.platformSettings).where(eq(schema.platformSettings.id, "singleton")).get();
      if (!s) {
        db.insert(schema.platformSettings).values({ id: "singleton", updatedAt: now() }).run();
        s = db.select().from(schema.platformSettings).where(eq(schema.platformSettings.id, "singleton")).get();
      }
      res.json(s);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.patch("/api/super-admin/settings", requireSA, (req, res) => {
    try {
      const { platformName, logoUrl, defaultCurrency, defaultCommissionRate, defaultTaxRate, paymentGateway, paymentGatewayKey, supportEmail } = req.body;
      const updates: any = { updatedAt: now() };
      if (platformName !== undefined) updates.platformName = platformName;
      if (logoUrl !== undefined) updates.logoUrl = logoUrl;
      if (defaultCurrency !== undefined) updates.defaultCurrency = defaultCurrency;
      if (defaultCommissionRate !== undefined) updates.defaultCommissionRate = parseFloat(defaultCommissionRate) || 0;
      if (defaultTaxRate !== undefined) updates.defaultTaxRate = parseFloat(defaultTaxRate) || 0;
      if (paymentGateway !== undefined) updates.paymentGateway = paymentGateway;
      if (paymentGatewayKey !== undefined) updates.paymentGatewayKey = paymentGatewayKey;
      if (supportEmail !== undefined) updates.supportEmail = supportEmail;

      // Ensure singleton row exists
      const existing = db.select().from(schema.platformSettings).where(eq(schema.platformSettings.id, "singleton")).get();
      if (!existing) db.insert(schema.platformSettings).values({ id: "singleton" }).run();
      db.update(schema.platformSettings).set(updates).where(eq(schema.platformSettings.id, "singleton")).run();
      auditLog(req, "super_admin", "settings.update", "platform", "singleton");
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ─── SUPER ADMIN: USERS ───────────────────────────────────────
  app.get("/api/super-admin/users", requireSA, (_req, res) => {
    try {
      const admins = db.select().from(schema.superAdmins).all();
      res.json(admins.map(a => ({ id: a.id, email: a.email, name: a.name, role: a.role, isActive: a.isActive, createdAt: a.createdAt })));
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/super-admin/users", requireSA, (req, res) => {
    try {
      const { email, password, name, role } = req.body;
      if (!email || !isValidEmail(email)) return res.status(400).json({ message: "Valid email required" });
      if (!password || password.length < 6) return res.status(400).json({ message: "Password must be at least 6 characters" });
      const existing = db.select().from(schema.superAdmins).where(eq(schema.superAdmins.email, email)).get();
      if (existing) return res.status(400).json({ message: "Email already registered" });
      const id = uuidv4();
      db.insert(schema.superAdmins).values({ id, email, passwordHash: hashPassword(password), name: name || email, role: role || "admin", isActive: 1, createdAt: now() }).run();
      auditLog(req, "super_admin", "admin_user.create", "super_admin", id, { email, role });
      res.status(201).json({ id, email, name, role });
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });

  // ─── TENANT AUTH ──────────────────────────────────────────────
  app.post("/api/t/:slug/auth/login", (req, res) => {
    try {
      const tenant = getTenantBySlug(req.params.slug);
      if (!tenant || tenant.status !== "active")
        return res.status(404).json({ message: "Store not found or inactive" });
      const { email, password } = req.body;
      const user = db.select().from(schema.tenantUsers)
        .where(and(eq(schema.tenantUsers.email, email), eq(schema.tenantUsers.tenantId, tenant.id), eq(schema.tenantUsers.isActive, 1))).get();
      if (!user || !checkPassword(password, user.passwordHash))
        return res.status(401).json({ message: "Invalid credentials" });
      const token = signToken({ sub: user.id, email: user.email, role: user.role, tenantId: tenant.id, iss: ISSUER_TU }, JWT_TU_SECRET);
      res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role, tenantId: tenant.id } });
    } catch (e: any) { console.error(e); res.status(500).json({ message: "Internal server error" }); }
  });

  // ─── STOREFRONT (public) ──────────────────────────────────────
  app.get("/api/t/:slug/store-info", (req, res) => {
    try {
      const tenant = getTenantBySlug(req.params.slug);
      if (!tenant) return res.status(404).json({ message: "Store not found" });
      const cfg = JSON.parse(tenant.config || "{}");
      res.json({
        id: tenant.id,
        name: cfg.name || tenant.name,
        slug: tenant.slug,
        status: tenant.status,
        description: cfg.description || "",
        primaryColor: cfg.primaryColor || "#0ea5e9",
        logoUrl: cfg.logoUrl || "",
        currency: cfg.currency || "KWD",
        pickupEnabled: cfg.pickupEnabled !== false,
        deliveryEnabled: cfg.deliveryEnabled !== false,
        pickupAddress: cfg.pickupAddress || "",
        pickupLocations: cfg.pickupLocations || [],
      });
    } catch (e: any) { console.error(e); res.status(500).json({ message: "Internal server error" }); }
  });

  app.get("/api/t/:slug/categories", (req, res) => {
    try {
      const tenant = getTenantBySlug(req.params.slug);
      if (!tenant) return res.status(404).json({ message: "Store not found" });
      const cats = getCategories(tenant.id);
      res.json(cats.map(c => ({ id: c.id, name: c.nameEn, nameAr: c.nameAr, sortOrder: c.sortOrder })));
    } catch (e: any) { console.error(e); res.status(500).json({ message: "Internal server error" }); }
  });

  app.get("/api/t/:slug/products", (req, res) => {
    try {
      const tenant = getTenantBySlug(req.params.slug);
      if (!tenant) return res.status(404).json({ message: "Store not found" });
      const raw = getProducts(tenant.id, req.query.category as string | undefined);
      const normalized = raw.map((p: any) => ({
        id: p.id, name: p.nameEn, description: p.descriptionEn || "",
        basePrice: parseFloat(String(p.basePrice)) || 0,
        imageUrl: p.imageUrl || "",
        categoryId: p.categoryId || null,
        isAvailable: p.isActive === 1,
        stockQuantity: p.stockQuantity ?? 999,
        variants: (p.variants || []).map((v: any) => ({
          id: v.id, name: v.nameEn, priceModifier: parseFloat(String(v.priceDelta)) || 0,
        })),
      }));
      res.json(normalized);
    } catch (e: any) { console.error(e); res.status(500).json({ message: "Internal server error" }); }
  });

  app.get("/api/t/:slug/shipping-rates", (req, res) => {
    try {
      const tenant = getTenantBySlug(req.params.slug);
      if (!tenant) return res.status(404).json({ message: "Store not found" });
      res.json(getShippingRates(tenant.id));
    } catch (e: any) { console.error(e); res.status(500).json({ message: "Internal server error" }); }
  });

  app.post("/api/t/:slug/validate-discount", (req, res) => {
    try {
      const tenant = getTenantBySlug(req.params.slug);
      if (!tenant) return res.status(404).json({ message: "Store not found" });
      const dc = validateDiscount(tenant.id, req.body.code || "");
      if (!dc) return res.json({ valid: false, message: "Invalid or expired discount code" });
      const orderAmount = parseFloat(req.body.orderAmount) || 0;
      const amount = (dc.type === "percentage" || dc.type === "percent")
        ? parseFloat(((orderAmount * dc.value) / 100).toFixed(3))
        : dc.value;
      res.json({ valid: true, code: dc.code, type: dc.type, value: dc.value, amount });
    } catch (e: any) { console.error(e); res.status(500).json({ message: "Internal server error" }); }
  });

  // ─── CHECKOUT ─────────────────────────────────────────────────
  app.post("/api/t/:slug/checkout/place-order", (req, res) => {
    try {
      const tenant = getTenantBySlug(req.params.slug);
      if (!tenant || tenant.status !== "active") return res.status(404).json({ message: "Store not found or inactive" });
      const { fulfillmentType, paymentMethod, items, address, shippingRateId, discountCode, specialInstructions } = req.body;
      if (!items?.length) return res.status(400).json({ message: "No items in order" });
      if (!["pickup","delivery"].includes(fulfillmentType)) return res.status(400).json({ message: "Invalid fulfillment type" });
      if (!["myfatoorah","cash"].includes(paymentMethod)) return res.status(400).json({ message: "Invalid payment method" });
      if (fulfillmentType === "delivery") {
        if (!address) return res.status(400).json({ message: "Delivery address required" });
        const err = validateAddress(address, address.type || "house");
        if (err) return res.status(400).json({ message: err });
      }
      const result = createOrder({ tenantId: tenant.id, fulfillmentType, paymentMethod, items, address, shippingRateId, discountCode, specialInstructions });
      res.status(201).json(result);
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });

  // ─── MOCK PAYMENT ─────────────────────────────────────────────
  app.get("/api/payments/mock-confirm", (req, res) => {
    if (process.env.NODE_ENV === "production" && !process.env.ENABLE_MOCK_PAYMENT)
      return res.status(404).json({ message: "Not found" });
    try {
      const { orderId, orderNumber, tenantId, slug, sig } = req.query as Record<string, string>;
      const crypto = require("crypto");
      const expectedSig = crypto.createHmac("sha256", JWT_TU_SECRET).update(`${orderId}:${tenantId}`).digest("hex").slice(0, 16);
      if (!sig || sig !== expectedSig) return res.status(403).json({ message: "Invalid signature" });
      if (orderId && tenantId) confirmPayment(orderId, tenantId);
      res.redirect(`/#/t/${slug || ""}/confirm?orderId=${orderId}`);
    } catch (e: any) { res.status(500).json({ message: "Payment confirmation failed" }); }
  });

  // ─── TENANT DASHBOARD ─────────────────────────────────────────
  app.get("/api/t/:slug/dashboard/me", requireTU, (req, res) => {
    try {
      const payload = (req as any).tenantUser as TUPayload;
      const tenant = getTenantById(payload.tenantId);
      res.json({ user: { id: payload.sub, email: payload.email, role: payload.role }, tenant: { ...tenant, config: JSON.parse(tenant?.config || "{}") } });
    } catch (e: any) { console.error(e); res.status(500).json({ message: "Internal server error" }); }
  });

  // ─── TENANT: ORDERS ───────────────────────────────────────────
  app.get("/api/t/:slug/dashboard/orders", requireTU, (req, res) => {
    try {
      const { tenantId } = (req as any).tenantUser as TUPayload;
      res.json(getOrders(tenantId));
    } catch (e: any) { console.error(e); res.status(500).json({ message: "Internal server error" }); }
  });

  app.patch("/api/t/:slug/dashboard/orders/:orderId/status", requireTU, (req, res) => {
    try {
      const { tenantId } = (req as any).tenantUser as TUPayload;
      const VALID = ["pending","confirmed","preparing","ready_pickup","out_for_delivery","delivered","cancelled"];
      const { status } = req.body;
      if (!VALID.includes(status)) return res.status(400).json({ message: "Invalid status" });
      updateOrderStatus(tenantId, req.params.orderId, status);
      auditLog(req, "tenant_user", "order.status_change", "order", req.params.orderId, { status });
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ─── TENANT: PRODUCTS ─────────────────────────────────────────
  app.get("/api/t/:slug/dashboard/products", requireTU, (req, res) => {
    try {
      const { tenantId } = (req as any).tenantUser as TUPayload;
      const raw = getDashboardProducts(tenantId);
      res.json(raw.map((p: any) => ({
        id: p.id, name: p.nameEn, description: p.descriptionEn || "",
        basePrice: parseFloat(String(p.basePrice)) || 0,
        imageUrl: p.imageUrl || "",
        categoryId: p.categoryId || null,
        isAvailable: p.isActive === 1,
        stockQuantity: p.stockQuantity ?? 999,
      })));
    } catch (e: any) { console.error(e); res.status(500).json({ message: "Internal server error" }); }
  });

  app.post("/api/t/:slug/dashboard/products", requireTU, (req, res) => {
    try {
      const { tenantId } = (req as any).tenantUser as TUPayload;
      const { name, description, basePrice, imageUrl, categoryId, stockQuantity } = req.body;
      const p = createProduct(tenantId, {
        nameEn: name || "", nameAr: name || "",
        basePrice: parseFloat(basePrice) || 0,
        descriptionEn: description || "", descriptionAr: description || "",
        imageUrl: imageUrl || "",
        categoryId: categoryId || undefined,
      });
      // update stock
      if (stockQuantity !== undefined) {
        db.update(schema.products).set({ stockQuantity: parseInt(stockQuantity) || 999 }).where(eq(schema.products.id, (p as any).id)).run();
      }
      res.status(201).json(p);
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });

  app.patch("/api/t/:slug/dashboard/products/:productId", requireTU, (req, res) => {
    try {
      const { tenantId } = (req as any).tenantUser as TUPayload;
      const { productId } = req.params;
      const { name, description, basePrice, imageUrl, isAvailable, categoryId, stockQuantity } = req.body;
      const updates: Record<string, any> = {};
      if (name !== undefined) { updates.nameEn = name; updates.nameAr = name; }
      if (description !== undefined) { updates.descriptionEn = description; updates.descriptionAr = description; }
      if (basePrice !== undefined) updates.basePrice = parseFloat(basePrice);
      if (imageUrl !== undefined) updates.imageUrl = imageUrl;
      if (isAvailable !== undefined) updates.isActive = isAvailable ? 1 : 0;
      if (categoryId !== undefined) updates.categoryId = categoryId;
      if (stockQuantity !== undefined) updates.stockQuantity = parseInt(stockQuantity) || 999;
      updates.updatedAt = now();
      db.update(schema.products).set(updates).where(and(eq(schema.products.id, productId), eq(schema.products.tenantId, tenantId))).run();
      res.json({ ok: true });
    } catch (e: any) { console.error(e); res.status(500).json({ message: "Internal server error" }); }
  });

  app.delete("/api/t/:slug/dashboard/products/:productId", requireTU, (req, res) => {
    try {
      const { tenantId } = (req as any).tenantUser as TUPayload;
      db.delete(schema.products).where(and(eq(schema.products.id, req.params.productId), eq(schema.products.tenantId, tenantId))).run();
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Duplicate product
  app.post("/api/t/:slug/dashboard/products/:productId/duplicate", requireTU, (req, res) => {
    try {
      const { tenantId } = (req as any).tenantUser as TUPayload;
      const original = db.select().from(schema.products).where(and(eq(schema.products.id, req.params.productId), eq(schema.products.tenantId, tenantId))).get();
      if (!original) return res.status(404).json({ message: "Product not found" });
      const newId = uuidv4();
      db.insert(schema.products).values({ ...original, id: newId, nameEn: `${original.nameEn} (Copy)`, nameAr: `${original.nameAr} (نسخة)`, slug: `${original.slug}-copy-${Date.now()}`, createdAt: now(), updatedAt: now() }).run();
      // Duplicate variants
      const variants = db.select().from(schema.productVariants).where(eq(schema.productVariants.productId, original.id)).all();
      variants.forEach(v => db.insert(schema.productVariants).values({ ...v, id: uuidv4(), productId: newId }).run());
      res.status(201).json({ id: newId });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ─── TENANT: CATEGORIES ───────────────────────────────────────
  app.get("/api/t/:slug/dashboard/categories", requireTU, (req, res) => {
    try {
      const { tenantId } = (req as any).tenantUser as TUPayload;
      res.json(getCategories(tenantId));
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/t/:slug/dashboard/categories", requireTU, (req, res) => {
    try {
      const { tenantId } = (req as any).tenantUser as TUPayload;
      const { nameEn, nameAr } = req.body;
      if (!nameEn?.trim()) return res.status(400).json({ message: "Category name required" });
      const id = uuidv4();
      const slug = nameEn.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      db.insert(schema.categories).values({ id, tenantId, nameEn, nameAr: nameAr || nameEn, slug, sortOrder: 999, isActive: 1, createdAt: now() }).run();
      res.status(201).json(db.select().from(schema.categories).where(eq(schema.categories.id, id)).get());
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });

  app.patch("/api/t/:slug/dashboard/categories/:catId", requireTU, (req, res) => {
    try {
      const { tenantId } = (req as any).tenantUser as TUPayload;
      const { nameEn, nameAr, isActive } = req.body;
      const updates: any = {};
      if (nameEn !== undefined) updates.nameEn = nameEn;
      if (nameAr !== undefined) updates.nameAr = nameAr;
      if (isActive !== undefined) updates.isActive = isActive ? 1 : 0;
      db.update(schema.categories).set(updates).where(and(eq(schema.categories.id, req.params.catId), eq(schema.categories.tenantId, tenantId))).run();
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.delete("/api/t/:slug/dashboard/categories/:catId", requireTU, (req, res) => {
    try {
      const { tenantId } = (req as any).tenantUser as TUPayload;
      db.delete(schema.categories).where(and(eq(schema.categories.id, req.params.catId), eq(schema.categories.tenantId, tenantId))).run();
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ─── TENANT: CUSTOMERS ────────────────────────────────────────
  app.get("/api/t/:slug/dashboard/customers", requireTU, (req, res) => {
    try {
      const { tenantId } = (req as any).tenantUser as TUPayload;
      const cust = db.select().from(schema.customers).where(eq(schema.customers.tenantId, tenantId)).all()
        .sort((a, b) => (b.totalSpend || 0) - (a.totalSpend || 0));
      res.json(cust);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ─── TENANT: SETTINGS ─────────────────────────────────────────
  app.get("/api/t/:slug/dashboard/settings", requireTU, (req, res) => {
    try {
      const { tenantId } = (req as any).tenantUser as TUPayload;
      const tenant = getTenantById(tenantId);
      const cfg = JSON.parse(tenant?.config || "{}");
      let pickupLocations = cfg.pickupLocations || [];
      if (!pickupLocations.length && cfg.pickupAddress) {
        pickupLocations = [{ id: "legacy", name: "Main Location", address: cfg.pickupAddress, enabled: true }];
      }
      res.json({
        name: cfg.name || tenant?.name || "",
        description: cfg.description || "",
        primaryColor: cfg.primaryColor || "#0ea5e9",
        logoUrl: cfg.logoUrl || "",
        currency: cfg.currency || "KWD",
        pickupEnabled: cfg.pickupEnabled !== false,
        deliveryEnabled: cfg.deliveryEnabled !== false,
        pickupLocations,
        storeHours: cfg.storeHours || null,
      });
    } catch (e: any) { console.error(e); res.status(500).json({ message: "Internal server error" }); }
  });

  app.patch("/api/t/:slug/dashboard/settings", requireTU, (req, res) => {
    try {
      const { tenantId } = (req as any).tenantUser as TUPayload;
      // Strip identity fields — SA-only
      const { name: _n, description: _d, logoUrl: _l, primaryColor: _c, ...allowedFields } = req.body;
      const merged = updateTenantConfig(tenantId, allowedFields);
      res.json({ ok: true, config: merged });
    } catch (e: any) { console.error(e); res.status(500).json({ message: "Internal server error" }); }
  });

  // ─── TENANT: TEAM MANAGEMENT ────────────────────────────────
  function parsePerms(raw: any): TenantPermissions {
    try { return JSON.parse(raw || "{}"); } catch { return getDefaultPermissions("staff"); }
  }

  // Only owner (or manager with team:true) can manage team
  function requireTeamAccess(req: Request, res: Response): boolean {
    const user = (req as any).tenantUser as TUPayload;
    if (user.role === "owner") return true;
    const perms = parsePerms((user as any).permissions);
    if (perms.team) return true;
    res.status(403).json({ message: "Team management access required" });
    return false;
  }

  app.get("/api/t/:slug/dashboard/team", requireTU, (req, res) => {
    try {
      const { tenantId } = (req as any).tenantUser as TUPayload;
      const users = db.select().from(schema.tenantUsers)
        .where(eq(schema.tenantUsers.tenantId, tenantId)).all();
      res.json(users.map(u => ({
        id: u.id, email: u.email, name: u.name, role: u.role,
        permissions: parsePerms((u as any).permissions),
        isActive: u.isActive, createdAt: u.createdAt,
      })));
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/t/:slug/dashboard/team", requireTU, (req, res) => {
    try {
      if (!requireTeamAccess(req, res)) return;
      const { tenantId } = (req as any).tenantUser as TUPayload;
      const { email, password, name, role, permissions } = req.body;
      if (!email || !password) return res.status(400).json({ message: "Email and password required" });
      const exists = db.select().from(schema.tenantUsers)
        .where(and(eq(schema.tenantUsers.tenantId, tenantId), eq(schema.tenantUsers.email, email))).get();
      if (exists) return res.status(400).json({ message: "Email already in use" });
      // Nobody can create an owner-level user
      if (role === "owner") return res.status(400).json({ message: "Cannot assign owner role" });
      const id = uuidv4();
      const resolvedPerms = permissions || getDefaultPermissions(role || "staff");
      db.insert(schema.tenantUsers).values({
        id, tenantId, email,
        passwordHash: hashPassword(password),
        name: name || email,
        role: role || "staff",
        permissions: JSON.stringify(resolvedPerms),
        isActive: 1, createdAt: now(),
      }).run();
      auditLog(req, "tenant_user", "team_user.create", "tenant_user", id, { email, role });
      res.status(201).json({ id, email, name, role, permissions: resolvedPerms });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.patch("/api/t/:slug/dashboard/team/:userId", requireTU, (req, res) => {
    try {
      if (!requireTeamAccess(req, res)) return;
      const { tenantId } = (req as any).tenantUser as TUPayload;
      const { name, email, password, role, permissions, isActive } = req.body;
      const target = db.select().from(schema.tenantUsers)
        .where(and(eq(schema.tenantUsers.id, req.params.userId), eq(schema.tenantUsers.tenantId, tenantId))).get();
      if (!target) return res.status(404).json({ message: "User not found" });
      if (target.role === "owner") return res.status(400).json({ message: "Cannot edit the owner" });
      if (role === "owner") return res.status(400).json({ message: "Cannot assign owner role" });
      const updates: Record<string, any> = {};
      if (name !== undefined) updates.name = name;
      if (email !== undefined) updates.email = email;
      if (password) updates.passwordHash = hashPassword(password);
      if (role !== undefined) updates.role = role;
      if (permissions !== undefined) updates.permissions = JSON.stringify(permissions);
      if (isActive !== undefined) updates.isActive = isActive ? 1 : 0;
      db.update(schema.tenantUsers).set(updates)
        .where(and(eq(schema.tenantUsers.id, req.params.userId), eq(schema.tenantUsers.tenantId, tenantId))).run();
      auditLog(req, "tenant_user", "team_user.update", "tenant_user", req.params.userId, { role, isActive });
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.delete("/api/t/:slug/dashboard/team/:userId", requireTU, (req, res) => {
    try {
      if (!requireTeamAccess(req, res)) return;
      const { tenantId } = (req as any).tenantUser as TUPayload;
      const target = db.select().from(schema.tenantUsers)
        .where(and(eq(schema.tenantUsers.id, req.params.userId), eq(schema.tenantUsers.tenantId, tenantId))).get();
      if (!target) return res.status(404).json({ message: "User not found" });
      if (target.role === "owner") return res.status(400).json({ message: "Cannot delete the owner" });
      auditLog(req, "tenant_user", "team_user.delete", "tenant_user", req.params.userId, { email: target.email });
      db.delete(schema.tenantUsers).where(eq(schema.tenantUsers.id, req.params.userId)).run();
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  return httpServer;
}
