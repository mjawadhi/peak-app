import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiFetch, apiRequest, queryClient } from "@/lib/queryClient";
import { getSAToken, setTUToken } from "@/lib/auth";
import { useLocation } from "wouter";
import AdminLayout from "./layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { Plus, Pencil, Trash2, LayoutDashboard, ExternalLink, Loader2, Search, CheckCircle, XCircle, Users, ShieldCheck, Eye, Crown, UserCog } from "lucide-react";

interface Tenant { id: string; name: string; slug: string; status: string; ownerEmail: string; planName: string | null; commissionRate: number; minOrderAmount: number; orderCount: number; createdAt: string; config: any; }

interface TenantUser { id: string; email: string; name: string | null; role: string; permissions: any; isActive: number; createdAt: string; }

const ROLE_COLORS: Record<string, string> = {
  owner:   "bg-amber-100 text-amber-800",
  manager: "bg-blue-100 text-blue-700",
  staff:   "bg-green-100 text-green-700",
  viewer:  "bg-gray-100 text-gray-600",
  custom:  "bg-purple-100 text-purple-700",
};

const PERM_DEFAULTS: Record<string, any> = {
  manager: { orders: "manage", products: "manage", customers: "view",  settings: false, team: false },
  staff:   { orders: "manage", products: "view",   customers: "none",  settings: false, team: false },
  viewer:  { orders: "view",   products: "view",   customers: "none",  settings: false, team: false },
  custom:  { orders: "none",   products: "none",   customers: "none",  settings: false, team: false },
};

const STATUS_COLOR: Record<string, string> = {
  active: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  suspended: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  pending: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
};
const PLANS = ["", "starter", "growth", "enterprise"];

export default function AdminTenants() {
  const token = getSAToken();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const authH = { Authorization: `Bearer ${token}` };

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  // Dialogs
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [tenantToDelete, setTenantToDelete] = useState<Tenant | null>(null);
  const [tenantToSuspend, setTenantToSuspend] = useState<{ tenant: Tenant; newStatus: string } | null>(null);

  // Users management
  const [usersDialogTenant, setUsersDialogTenant] = useState<Tenant | null>(null);
  const [userForm, setUserForm] = useState({ email: "", password: "", name: "", role: "staff", permissions: { ...PERM_DEFAULTS.staff } });
  const [userFormOpen, setUserFormOpen] = useState(false);
  const [editUserTarget, setEditUserTarget] = useState<TenantUser | null>(null);
  const [deleteUserTarget, setDeleteUserTarget] = useState<TenantUser | null>(null);

  const { data: tenantUsers = [], refetch: refetchUsers } = useQuery<TenantUser[]>({
    queryKey: ["/api/super-admin/tenants", usersDialogTenant?.id, "users"],
    queryFn: () => apiFetch(`/api/super-admin/tenants/${usersDialogTenant!.id}/users`, { headers: authH }),
    enabled: !!usersDialogTenant,
  });

  function openAddUser() {
    setEditUserTarget(null);
    setUserForm({ email: "", password: "", name: "", role: "staff", permissions: { ...PERM_DEFAULTS.staff } });
    setUserFormOpen(true);
  }

  function openEditUser(u: TenantUser) {
    setEditUserTarget(u);
    setUserForm({ email: u.email, password: "", name: u.name || "", role: u.role, permissions: { ...u.permissions } });
    setUserFormOpen(true);
  }

  function handleUserRoleChange(role: string) {
    setUserForm(f => ({
      ...f, role,
      permissions: role !== "custom" ? { ...(PERM_DEFAULTS[role] ?? PERM_DEFAULTS.staff) } : f.permissions,
    }));
  }

  const saveUserMutation = useMutation({
    mutationFn: async () => {
      if (!userForm.email.trim()) throw new Error("Email required");
      if (!editUserTarget && !userForm.password.trim()) throw new Error("Password required");
      const payload: any = { email: userForm.email.trim(), name: userForm.name.trim() || userForm.email.trim(), role: userForm.role, permissions: userForm.permissions };
      if (userForm.password.trim()) payload.password = userForm.password;
      if (editUserTarget) {
        await apiRequest("PATCH", `/api/super-admin/tenants/${usersDialogTenant!.id}/users/${editUserTarget.id}`, payload, authH);
      } else {
        await apiRequest("POST", `/api/super-admin/tenants/${usersDialogTenant!.id}/users`, payload, authH);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/tenants", usersDialogTenant?.id, "users"] });
      setUserFormOpen(false);
      toast({ title: editUserTarget ? "User updated" : "User created" });
    },
    onError: async (err: any) => {
      const msg = await err.response?.json?.().then((d: any) => d.message).catch(() => err.message);
      toast({ title: "Error", description: msg || err.message, variant: "destructive" });
    },
  });

  const toggleUserMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      await apiRequest("PATCH", `/api/super-admin/tenants/${usersDialogTenant!.id}/users/${id}`, { isActive }, authH);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/super-admin/tenants", usersDialogTenant?.id, "users"] }),
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/super-admin/tenants/${usersDialogTenant!.id}/users/${id}`, undefined, authH);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/tenants", usersDialogTenant?.id, "users"] });
      setDeleteUserTarget(null);
      toast({ title: "User removed" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  // Create form
  const [createForm, setCreateForm] = useState({ name: "", slug: "", ownerEmail: "", ownerPassword: "" });
  const [slugAvail, setSlugAvail] = useState<boolean | null>(null);
  const slugTimer = useRef<any>(null);

  // Edit form
  const [editForm, setEditForm] = useState({ name: "", description: "", logoUrl: "", primaryColor: "#0ea5e9", slug: "", ownerEmail: "", planId: "", commissionRate: "0", minOrderAmount: "0" });
  const [editSlugAvail, setEditSlugAvail] = useState<boolean | null>(null);
  const editSlugTimer = useRef<any>(null);

  const { data: tenants = [], isLoading } = useQuery<Tenant[]>({
    queryKey: ["/api/super-admin/tenants"],
    queryFn: () => apiFetch("/api/super-admin/tenants", { headers: authH }),
    enabled: !!token,
    refetchInterval: 15000,
  });

  // Slug availability check (create)
  function checkSlug(slug: string, excludeId?: string) {
    if (!slug) { setSlugAvail(null); return; }
    clearTimeout(slugTimer.current);
    setSlugAvail(null);
    slugTimer.current = setTimeout(async () => {
      try {
        const r = await apiFetch<{ available: boolean }>(`/api/super-admin/slug-check?slug=${slug}${excludeId ? `&excludeId=${excludeId}` : ""}`, { headers: authH });
        setSlugAvail(r.available);
      } catch {}
    }, 400);
  }

  function checkEditSlug(slug: string, excludeId: string) {
    if (!slug) { setEditSlugAvail(null); return; }
    clearTimeout(editSlugTimer.current);
    setEditSlugAvail(null);
    editSlugTimer.current = setTimeout(async () => {
      try {
        const r = await apiFetch<{ available: boolean }>(`/api/super-admin/slug-check?slug=${slug}&excludeId=${excludeId}`, { headers: authH });
        setEditSlugAvail(r.available);
      } catch {}
    }, 400);
  }

  const createMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/super-admin/tenants", createForm, authH),
    onSuccess: () => {
      setCreateOpen(false);
      setCreateForm({ name: "", slug: "", ownerEmail: "", ownerPassword: "" });
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/tenants"] });
      toast({ title: "Tenant created" });
    },
    onError: async (err: any) => {
      const msg = await err.response?.json?.().then((d: any) => d.message).catch(() => err.message);
      toast({ title: "Error", description: msg || err.message, variant: "destructive" });
    },
  });

  const editMutation = useMutation({
    mutationFn: () => apiRequest("PATCH", `/api/super-admin/tenants/${selectedTenant?.id}/store-info`, editForm, authH),
    onSuccess: () => {
      setEditOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/tenants"] });
      toast({ title: "Tenant updated" });
    },
    onError: async (err: any) => {
      const msg = await err.response?.json?.().then((d: any) => d.message).catch(() => err.message);
      toast({ title: "Error", description: msg || err.message, variant: "destructive" });
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => apiRequest("PATCH", `/api/super-admin/tenants/${id}/status`, { status }, authH),
    onSuccess: () => {
      setTenantToSuspend(null);
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/tenants"] });
      toast({ title: "Status updated" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/super-admin/tenants/${id}`, undefined, authH),
    onSuccess: () => {
      setTenantToDelete(null);
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/tenants"] });
      toast({ title: "Tenant deleted" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const impersonateMutation = useMutation({
    mutationFn: (tenantId: string) => apiFetch<{ token: string; tenant: { slug: string } }>(`/api/super-admin/impersonate/${tenantId}`, { method: "POST", headers: authH }),
    onSuccess: (data) => { setTUToken(data.token); navigate(`/t/${data.tenant.slug}/dashboard`); },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  function openEdit(t: Tenant) {
    setSelectedTenant(t);
    setEditForm({
      name: t.config?.name || t.name || "",
      description: t.config?.description || "",
      logoUrl: t.config?.logoUrl || "",
      primaryColor: t.config?.primaryColor || "#0ea5e9",
      slug: t.slug,
      ownerEmail: t.ownerEmail || "",
      planId: t.planName || "",
      commissionRate: String(t.commissionRate || 0),
      minOrderAmount: String(t.minOrderAmount || 0),
    });
    setEditSlugAvail(null);
    setEditOpen(true);
  }

  // Filter + paginate
  const filtered = tenants.filter(t => {
    const matchSearch = !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.slug.toLowerCase().includes(search.toLowerCase()) || (t.ownerEmail || "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || t.status === statusFilter;
    return matchSearch && matchStatus;
  });
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <AdminLayout>
      <div className="p-5 space-y-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-lg font-bold">Tenants</h1>
            <p className="text-muted-foreground text-sm mt-0.5">{tenants.length} total</p>
          </div>
          <Button onClick={() => setCreateOpen(true)} size="sm" data-testid="button-newTenant">
            <Plus className="w-4 h-4 mr-1.5" /> New Tenant
          </Button>
        </div>

        {/* Filters */}
        <div className="flex gap-2 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
            <Input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search name, slug, email…" className="pl-8 h-8 text-sm" />
          </div>
          <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(1); }}>
            <SelectTrigger className="h-8 text-xs w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All statuses</SelectItem>
              <SelectItem value="active" className="text-xs">Active</SelectItem>
              <SelectItem value="suspended" className="text-xs">Suspended</SelectItem>
              <SelectItem value="pending" className="text-xs">Pending</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}</div>
        ) : paginated.length === 0 ? (
          <div className="rounded-xl border border-border py-12 text-center text-muted-foreground text-sm">No tenants found</div>
        ) : (
          <div className="rounded-xl border border-border divide-y divide-border overflow-hidden">
            {paginated.map(t => (
              <div key={t.id} className="px-4 py-3 space-y-2">
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold">{t.name}</p>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium capitalize ${STATUS_COLOR[t.status] ?? "bg-muted text-muted-foreground"}`}>{t.status}</span>
                      {t.planName && <span className="text-xs px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium capitalize">{t.planName}</span>}
                    </div>
                    <p className="text-xs text-muted-foreground font-mono mt-0.5">/{t.slug} · {t.ownerEmail || "no owner"} · {t.orderCount} orders</p>
                  </div>
                  {/* Status dropdown */}
                  <Select value={t.status} onValueChange={(val) => {
                    if (val === "suspended" || t.status === "suspended") {
                      setTenantToSuspend({ tenant: t, newStatus: val });
                    } else {
                      statusMutation.mutate({ id: t.id, status: val });
                    }
                  }}>
                    <SelectTrigger className="h-7 text-xs w-28"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active" className="text-xs">Active</SelectItem>
                      <SelectItem value="suspended" className="text-xs">Suspended</SelectItem>
                      <SelectItem value="pending" className="text-xs">Pending</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button onClick={() => openEdit(t)} className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-border hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                    <Pencil className="w-3 h-3" /> Edit Info
                  </button>
                  <button onClick={() => impersonateMutation.mutate(t.id)} disabled={impersonateMutation.isPending} className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-primary/40 bg-primary/5 hover:bg-primary/10 transition-colors text-primary font-medium">
                    {impersonateMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <LayoutDashboard className="w-3 h-3" />} Enter Dashboard
                  </button>
                  <button onClick={() => setUsersDialogTenant(t)} className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-border hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                    <UserCog className="w-3 h-3" /> Users
                  </button>
                  <button onClick={() => window.open(`/#/t/${t.slug}`, "_blank")} className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-border hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                    <ExternalLink className="w-3 h-3" /> View Store
                  </button>
                  <button onClick={() => setTenantToDelete(t)} className="ml-auto flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-destructive/30 hover:bg-destructive/10 transition-colors text-destructive font-medium">
                    <Trash2 className="w-3 h-3" /> Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
            <span>Page {page} of {totalPages}</span>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="h-7 px-2 text-xs">Prev</Button>
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="h-7 px-2 text-xs">Next</Button>
            </div>
          </div>
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={v => !v && setCreateOpen(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Create New Tenant</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Store Name *</Label>
              <Input value={createForm.name} onChange={e => setCreateForm(p => ({ ...p, name: e.target.value }))} placeholder="Burger Stack" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Slug * <span className="text-muted-foreground">(URL path)</span></Label>
              <div className="relative">
                <Input value={createForm.slug} onChange={e => { const v = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""); setCreateForm(p => ({ ...p, slug: v })); checkSlug(v); }} placeholder="burger-stack" />
                {createForm.slug && (
                  <div className="absolute right-2.5 top-2.5">
                    {slugAvail === null ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /> : slugAvail ? <CheckCircle className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4 text-red-500" />}
                  </div>
                )}
              </div>
              {createForm.slug && slugAvail === false && <p className="text-xs text-red-500">Slug already taken</p>}
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Owner Email</Label>
              <Input type="email" value={createForm.ownerEmail} onChange={e => setCreateForm(p => ({ ...p, ownerEmail: e.target.value }))} placeholder="owner@store.com" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Owner Password</Label>
              <Input type="password" value={createForm.ownerPassword} onChange={e => setCreateForm(p => ({ ...p, ownerPassword: e.target.value }))} placeholder="Min 6 characters" />
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button className="flex-1" onClick={() => createMutation.mutate()} disabled={createMutation.isPending || slugAvail === false}>
                {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Create
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={v => !v && setEditOpen(false)}>
        <DialogContent className="max-w-sm flex flex-col max-h-[90vh]">
          <DialogHeader className="shrink-0"><DialogTitle>Edit — {selectedTenant?.name}</DialogTitle></DialogHeader>
          <div className="overflow-y-auto flex-1 pr-1"><div className="space-y-3">
            <div className="space-y-1"><Label className="text-xs">Store Name</Label>
              <Input value={editForm.name} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))} /></div>
            <div className="space-y-1"><Label className="text-xs">Description</Label>
              <Textarea value={editForm.description} onChange={e => setEditForm(p => ({ ...p, description: e.target.value }))} rows={2} /></div>
            <div className="space-y-1"><Label className="text-xs">Logo URL</Label>
              <Input value={editForm.logoUrl} onChange={e => setEditForm(p => ({ ...p, logoUrl: e.target.value }))} placeholder="https://…" /></div>
            <div className="space-y-1"><Label className="text-xs">Brand Color</Label>
              <div className="flex gap-2 items-center">
                <input type="color" value={editForm.primaryColor} onChange={e => setEditForm(p => ({ ...p, primaryColor: e.target.value }))} className="h-8 w-10 rounded border border-border cursor-pointer" />
                <Input value={editForm.primaryColor} onChange={e => setEditForm(p => ({ ...p, primaryColor: e.target.value }))} className="font-mono" maxLength={7} />
              </div>
            </div>
            <div className="space-y-1"><Label className="text-xs">Slug</Label>
              <div className="relative">
                <Input value={editForm.slug} onChange={e => { const v = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""); setEditForm(p => ({ ...p, slug: v })); if (selectedTenant) checkEditSlug(v, selectedTenant.id); }} />
                {editForm.slug && editForm.slug !== selectedTenant?.slug && (
                  <div className="absolute right-2.5 top-2.5">
                    {editSlugAvail === null ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /> : editSlugAvail ? <CheckCircle className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4 text-red-500" />}
                  </div>
                )}
              </div>
              {editForm.slug !== selectedTenant?.slug && editSlugAvail === false && <p className="text-xs text-red-500">Slug already taken</p>}
            </div>
            <div className="space-y-1"><Label className="text-xs">Owner Email</Label>
              <Input type="email" value={editForm.ownerEmail} onChange={e => setEditForm(p => ({ ...p, ownerEmail: e.target.value }))} /></div>
            <div className="space-y-1"><Label className="text-xs">Plan</Label>
              <Select value={editForm.planId} onValueChange={v => setEditForm(p => ({ ...p, planId: v }))}>
                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="No plan" /></SelectTrigger>
                <SelectContent>{PLANS.map(p => <SelectItem key={p} value={p} className="text-sm capitalize">{p || "No plan"}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1"><Label className="text-xs">Commission %</Label>
                <Input type="number" min="0" max="100" value={editForm.commissionRate} onChange={e => setEditForm(p => ({ ...p, commissionRate: e.target.value }))} /></div>
              <div className="space-y-1"><Label className="text-xs">Min Order KWD</Label>
                <Input type="number" min="0" value={editForm.minOrderAmount} onChange={e => setEditForm(p => ({ ...p, minOrderAmount: e.target.value }))} /></div>
            </div>
          </div></div>
          <div className="flex gap-2 pt-2 shrink-0 border-t border-border">
            <Button variant="outline" className="flex-1" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button className="flex-1" onClick={() => editMutation.mutate()} disabled={editMutation.isPending || (editForm.slug !== selectedTenant?.slug && editSlugAvail === false)}>
              {editMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Suspend confirm */}
      <AlertDialog open={!!tenantToSuspend} onOpenChange={o => !o && setTenantToSuspend(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tenantToSuspend?.newStatus === "suspended" ? "Suspend" : "Restore"} "{tenantToSuspend?.tenant.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              {tenantToSuspend?.newStatus === "suspended"
                ? "The store will go offline immediately. Existing orders are not affected."
                : "The store will become active and accessible to customers."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => tenantToSuspend && statusMutation.mutate({ id: tenantToSuspend.tenant.id, status: tenantToSuspend.newStatus })}
              className={tenantToSuspend?.newStatus === "suspended" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}>
              {tenantToSuspend?.newStatus === "suspended" ? "Suspend" : "Restore"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Users Dialog ── */}
      <Dialog open={!!usersDialogTenant} onOpenChange={v => !v && setUsersDialogTenant(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Users — {usersDialogTenant?.name}</span>
              <Button size="sm" onClick={openAddUser} className="flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5" /> Add User
              </Button>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 mt-1">
            {tenantUsers.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">No users found.</div>
            ) : tenantUsers.map(u => (
              <div key={u.id} className={`rounded-xl border p-3 ${u.role === "owner" ? "border-amber-200 bg-amber-50/50" : "border-border"}`}>
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0 text-muted-foreground">
                    {u.role === "owner" ? <Crown className="w-3.5 h-3.5 text-amber-600" /> : u.role === "manager" ? <ShieldCheck className="w-3.5 h-3.5" /> : u.role === "viewer" ? <Eye className="w-3.5 h-3.5" /> : <Users className="w-3.5 h-3.5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-sm font-medium">{u.name || u.email}</p>
                      <Badge className={`border-0 text-[10px] px-1.5 capitalize ${ROLE_COLORS[u.role] ?? "bg-gray-100 text-gray-600"}`}>{u.role}</Badge>
                      {!u.isActive && <Badge className="border-0 text-[10px] px-1.5 bg-red-100 text-red-600">Inactive</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">{u.email}</p>
                    {u.role !== "owner" && (
                      <div className="flex flex-wrap gap-x-3 mt-0.5 text-[10px] text-muted-foreground">
                        <span>Orders: <span className="font-medium">{u.permissions?.orders ?? "—"}</span></span>
                        <span>Products: <span className="font-medium">{u.permissions?.products ?? "—"}</span></span>
                        <span>Customers: <span className="font-medium">{u.permissions?.customers ?? "—"}</span></span>
                        <span>Settings: <span className="font-medium">{u.permissions?.settings ? "Yes" : "No"}</span></span>
                        <span>Team: <span className="font-medium">{u.permissions?.team ? "Yes" : "No"}</span></span>
                      </div>
                    )}
                  </div>
                  {u.role !== "owner" && (
                    <div className="flex items-center gap-1 shrink-0">
                      <Switch
                        checked={!!u.isActive}
                        onCheckedChange={v => toggleUserMutation.mutate({ id: u.id, isActive: v })}
                        title={u.isActive ? "Deactivate" : "Activate"}
                      />
                      <button onClick={() => openEditUser(u)} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title="Edit">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setDeleteUserTarget(u)} className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors" title="Remove">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Add / Edit User Form Dialog ── */}
      <Dialog open={userFormOpen} onOpenChange={v => !v && setUserFormOpen(false)}>
        <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editUserTarget ? "Edit User" : "Add User"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label className="text-xs">Full Name</Label>
              <Input value={userForm.name} onChange={e => setUserForm(f => ({ ...f, name: e.target.value }))} placeholder="Ahmed Al-Rashidi" /></div>
            <div className="space-y-1"><Label className="text-xs">Email *</Label>
              <Input type="email" value={userForm.email} onChange={e => setUserForm(f => ({ ...f, email: e.target.value }))} placeholder="employee@store.com" /></div>
            <div className="space-y-1"><Label className="text-xs">{editUserTarget ? "New Password (blank = keep)" : "Password *"}</Label>
              <Input type="password" value={userForm.password} onChange={e => setUserForm(f => ({ ...f, password: e.target.value }))} placeholder="Min 6 characters" /></div>
            <div className="space-y-1"><Label className="text-xs">Role</Label>
              <Select value={userForm.role} onValueChange={handleUserRoleChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="staff">Staff</SelectItem>
                  <SelectItem value="viewer">Viewer (read-only)</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="rounded-xl border border-border p-3 space-y-2.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Permissions</p>
              {(["orders", "products"] as const).map(field => (
                <div key={field} className="flex items-center justify-between gap-2">
                  <Label className="text-xs font-normal capitalize">{field}</Label>
                  <Select value={userForm.permissions[field]} onValueChange={v => setUserForm(f => ({ ...f, role: "custom", permissions: { ...f.permissions, [field]: v } }))}>
                    <SelectTrigger className="h-7 text-xs w-28"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none" className="text-xs">No access</SelectItem>
                      <SelectItem value="view" className="text-xs">View only</SelectItem>
                      <SelectItem value="manage" className="text-xs">Full manage</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ))}
              <div className="flex items-center justify-between gap-2">
                <Label className="text-xs font-normal">Customers</Label>
                <Select value={userForm.permissions.customers} onValueChange={v => setUserForm(f => ({ ...f, role: "custom", permissions: { ...f.permissions, customers: v } }))}>
                  <SelectTrigger className="h-7 text-xs w-28"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" className="text-xs">No access</SelectItem>
                    <SelectItem value="view" className="text-xs">View only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between gap-2">
                <Label className="text-xs font-normal">Store Settings</Label>
                <Switch checked={!!userForm.permissions.settings} onCheckedChange={v => setUserForm(f => ({ ...f, role: "custom", permissions: { ...f.permissions, settings: v } }))} />
              </div>
              <div className="flex items-center justify-between gap-2">
                <Label className="text-xs font-normal">Team Management</Label>
                <Switch checked={!!userForm.permissions.team} onCheckedChange={v => setUserForm(f => ({ ...f, role: "custom", permissions: { ...f.permissions, team: v } }))} />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setUserFormOpen(false)}>Cancel</Button>
              <Button className="flex-1" onClick={() => saveUserMutation.mutate()} disabled={saveUserMutation.isPending}>
                {saveUserMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                {editUserTarget ? "Save" : "Add User"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete User confirm ── */}
      <Dialog open={!!deleteUserTarget} onOpenChange={v => !v && setDeleteUserTarget(null)}>
        <DialogContent className="max-w-xs">
          <DialogHeader><DialogTitle>Remove User?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Remove <strong>{deleteUserTarget?.name || deleteUserTarget?.email}</strong>? They will no longer be able to log in.</p>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setDeleteUserTarget(null)}>Cancel</Button>
            <Button variant="destructive" className="flex-1" onClick={() => deleteUserTarget && deleteUserMutation.mutate(deleteUserTarget.id)} disabled={deleteUserMutation.isPending}>
              {deleteUserMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Remove
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!tenantToDelete} onOpenChange={o => !o && setTenantToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{tenantToDelete?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>This permanently deletes the tenant and ALL its data — products, orders, categories, users, and settings. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => tenantToDelete && deleteMutation.mutate(tenantToDelete.id)} disabled={deleteMutation.isPending} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleteMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Delete permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
