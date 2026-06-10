import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiFetch, apiRequest, queryClient } from "@/lib/queryClient";
import { getSAToken, clearSAToken, setTUToken, decodePayload } from "@/lib/auth";
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
import { Shield, LogOut, Plus, Users, Store, Loader2, ExternalLink, Pencil, LayoutDashboard, ChevronRight, Trash2 } from "lucide-react";

interface Tenant {
  id: string; name: string; slug: string; status: string;
  ownerEmail: string; createdAt: string;
}
interface Stats { totalTenants: number; activeTenants: number; totalOrders: number; totalRevenue: number; }

type DialogMode = "create" | "storeInfo";

export default function AdminPanel() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const token = getSAToken();

  const [dialogMode, setDialogMode] = useState<DialogMode>("create");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);

  // Create form
  const [createForm, setCreateForm] = useState({ name: "", slug: "", ownerEmail: "", ownerPassword: "" });

  // Store info form
  const [infoForm, setInfoForm] = useState({ name: "", description: "", logoUrl: "", primaryColor: "#0ea5e9" });

  // Auth guard
  useEffect(() => {
    if (!token) { navigate("/admin/login"); return; }
    const payload = decodePayload(token);
    if (!payload || payload.exp * 1000 < Date.now()) { clearSAToken(); navigate("/admin/login"); }
  }, []);

  const authHeader = { Authorization: `Bearer ${token}` };

  const { data: tenants = [], isLoading } = useQuery<Tenant[]>({
    queryKey: ["/api/super-admin/tenants"],
    queryFn: () => apiFetch("/api/super-admin/tenants", { headers: authHeader }),
    enabled: !!token,
  });

  const { data: stats } = useQuery<Stats>({
    queryKey: ["/api/super-admin/stats"],
    queryFn: () => apiFetch("/api/super-admin/stats", { headers: authHeader }),
    enabled: !!token,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!createForm.name.trim() || !createForm.slug.trim() || !createForm.ownerEmail.trim() || !createForm.ownerPassword.trim())
        throw new Error("All fields are required");
      if (!/^[a-z0-9-]+$/.test(createForm.slug))
        throw new Error("Slug must be lowercase letters, numbers, and dashes only");
      await apiRequest("POST", "/api/super-admin/tenants", createForm, authHeader);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/tenants"] });
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/stats"] });
      setDialogOpen(false);
      setCreateForm({ name: "", slug: "", ownerEmail: "", ownerPassword: "" });
      toast({ title: "Tenant created" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const storeInfoMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTenant) return;
      await apiRequest("PATCH", `/api/super-admin/tenants/${selectedTenant.id}/store-info`, infoForm, authHeader);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/tenants"] });
      setDialogOpen(false);
      toast({ title: "Store info updated" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await apiRequest("PATCH", `/api/super-admin/tenants/${id}/status`, { status }, authHeader);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/tenants"] });
      toast({ title: "Status updated" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const impersonateMutation = useMutation({
    mutationFn: async (tenantId: string) => {
      const res = await apiFetch<{ token: string; tenant: { slug: string } }>(
        `/api/super-admin/impersonate/${tenantId}`,
        { method: "POST", headers: authHeader }
      );
      return res;
    },
    onSuccess: (data) => {
      setTUToken(data.token);
      navigate(`/t/${data.tenant.slug}/dashboard`);
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const [tenantToDelete, setTenantToDelete] = useState<Tenant | null>(null);
  const deleteMutation = useMutation({
    mutationFn: async (tenantId: string) => {
      await apiRequest("DELETE", `/api/super-admin/tenants/${tenantId}`, undefined, authHeader);
    },
    onSuccess: () => {
      setTenantToDelete(null);
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/tenants"] });
      toast({ title: "Tenant deleted", description: "The tenant and all its data have been removed." });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  function openCreateDialog() {
    setDialogMode("create");
    setCreateForm({ name: "", slug: "", ownerEmail: "", ownerPassword: "" });
    setDialogOpen(true);
  }

  function openStoreInfoDialog(t: Tenant) {
    setSelectedTenant(t);
    setInfoForm({ name: t.name, description: "", logoUrl: "", primaryColor: "#0ea5e9" });
    setDialogMode("storeInfo");
    setDialogOpen(true);
  }

  function handleLogout() {
    clearSAToken();
    queryClient.clear();
    navigate("/admin/login");
  }

  const statusColor: Record<string, string> = {
    active: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    suspended: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    pending: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            <span className="font-bold text-sm">Peak Super Admin</span>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors"
            data-testid="button-adminLogout"
          >
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Total Stores", value: stats?.totalTenants ?? "—" },
            { label: "Active Stores", value: stats?.activeTenants ?? "—" },
            { label: "Total Orders", value: stats?.totalOrders ?? "—" },
            { label: "Revenue (KWD)", value: stats?.totalRevenue != null ? stats.totalRevenue.toFixed(3) : "—" },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-xl border border-border p-4 bg-card space-y-1">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-xl font-bold">{value}</p>
            </div>
          ))}
        </div>

        {/* Tenants */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Tenants</h2>
            <Button size="sm" onClick={openCreateDialog} className="flex items-center gap-1.5" data-testid="button-addTenant">
              <Plus className="w-4 h-4" /> Add Tenant
            </Button>
          </div>

          {isLoading ? (
            <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
          ) : tenants.length === 0 ? (
            <div className="rounded-xl border border-border py-12 text-center text-muted-foreground text-sm">No tenants yet</div>
          ) : (
            <div className="rounded-xl border border-border divide-y divide-border overflow-hidden">
              {tenants.map(t => (
                <div key={t.id} className="px-4 py-3 space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold">{t.name}</p>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium capitalize ${statusColor[t.status] ?? "bg-muted text-muted-foreground"}`}>
                          {t.status}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground font-mono mt-0.5">
                        /{t.slug} · {t.ownerEmail}
                      </p>
                    </div>

                    {/* Status select */}
                    <Select value={t.status} onValueChange={(val) => statusMutation.mutate({ id: t.id, status: val })}>
                      <SelectTrigger className="h-7 text-xs w-28" data-testid={`select-tenantStatus-${t.id}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active" className="text-xs">Active</SelectItem>
                        <SelectItem value="suspended" className="text-xs">Suspended</SelectItem>
                        <SelectItem value="pending" className="text-xs">Pending</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Action buttons row */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Edit store info */}
                    <button
                      onClick={() => openStoreInfoDialog(t)}
                      className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-border hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                      data-testid={`button-editStoreInfo-${t.id}`}
                    >
                      <Pencil className="w-3 h-3" /> Edit Store Info
                    </button>

                    {/* Enter dashboard */}
                    <button
                      onClick={() => impersonateMutation.mutate(t.id)}
                      disabled={impersonateMutation.isPending}
                      className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-primary/40 bg-primary/5 hover:bg-primary/10 transition-colors text-primary font-medium"
                      data-testid={`button-enterDashboard-${t.id}`}
                    >
                      {impersonateMutation.isPending
                        ? <Loader2 className="w-3 h-3 animate-spin" />
                        : <LayoutDashboard className="w-3 h-3" />}
                      Enter Dashboard
                    </button>

                    {/* View storefront */}
                    <a
                      href={`/#/t/${t.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-border hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                      data-testid={`link-viewStore-${t.id}`}
                    >
                      <ExternalLink className="w-3 h-3" /> View Store
                    </a>

                    {/* Delete tenant */}
                    <button
                      onClick={() => setTenantToDelete(t)}
                      className="ml-auto flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-destructive/30 hover:bg-destructive/10 transition-colors text-destructive font-medium"
                      data-testid={`button-deleteTenant-${t.id}`}
                    >
                      <Trash2 className="w-3 h-3" /> Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Create Tenant Dialog */}
      <Dialog open={dialogOpen && dialogMode === "create"} onOpenChange={open => !open && setDialogOpen(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Create New Tenant</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="tenantName" className="text-xs">Store Name *</Label>
              <Input id="tenantName" value={createForm.name} onChange={e => setCreateForm(p => ({ ...p, name: e.target.value }))} data-testid="input-tenantName" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="tenantSlug" className="text-xs">Slug * (e.g. my-store)</Label>
              <Input
                id="tenantSlug"
                value={createForm.slug}
                onChange={e => setCreateForm(p => ({ ...p, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") }))}
                data-testid="input-tenantSlug"
              />
              {createForm.slug && <p className="text-xs text-muted-foreground">URL: /#/t/{createForm.slug}</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor="ownerEmail" className="text-xs">Owner Email *</Label>
              <Input id="ownerEmail" type="email" value={createForm.ownerEmail} onChange={e => setCreateForm(p => ({ ...p, ownerEmail: e.target.value }))} data-testid="input-ownerEmail" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ownerPassword" className="text-xs">Owner Password *</Label>
              <Input id="ownerPassword" type="password" value={createForm.ownerPassword} onChange={e => setCreateForm(p => ({ ...p, ownerPassword: e.target.value }))} data-testid="input-ownerPassword" />
            </div>
            <Button className="w-full" onClick={() => createMutation.mutate()} disabled={createMutation.isPending} data-testid="button-createTenant">
              {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Create Tenant
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Store Info Dialog */}
      <Dialog open={dialogOpen && dialogMode === "storeInfo"} onOpenChange={open => !open && setDialogOpen(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit Store Info</DialogTitle>
            {selectedTenant && <p className="text-xs text-muted-foreground mt-0.5">/{selectedTenant.slug}</p>}
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="siName" className="text-xs">Store Name</Label>
              <Input id="siName" value={infoForm.name} onChange={e => setInfoForm(p => ({ ...p, name: e.target.value }))} data-testid="input-siName" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="siDesc" className="text-xs">Description</Label>
              <Textarea id="siDesc" rows={3} value={infoForm.description} onChange={e => setInfoForm(p => ({ ...p, description: e.target.value }))} data-testid="input-siDescription" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="siLogo" className="text-xs">Logo URL</Label>
              <Input id="siLogo" type="url" placeholder="https://..." value={infoForm.logoUrl} onChange={e => setInfoForm(p => ({ ...p, logoUrl: e.target.value }))} data-testid="input-siLogoUrl" />
              {infoForm.logoUrl && (
                <img src={infoForm.logoUrl} alt="Logo preview" className="h-10 w-auto rounded border border-border mt-1 object-contain" />
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="siColor" className="text-xs">Brand Color</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  id="siColor"
                  value={infoForm.primaryColor}
                  onChange={e => setInfoForm(p => ({ ...p, primaryColor: e.target.value }))}
                  className="h-9 w-16 rounded border border-border cursor-pointer p-0.5 bg-background"
                  data-testid="input-siColor"
                />
                <Input
                  value={infoForm.primaryColor}
                  onChange={e => setInfoForm(p => ({ ...p, primaryColor: e.target.value }))}
                  className="font-mono"
                  maxLength={7}
                />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button className="flex-1" onClick={() => storeInfoMutation.mutate()} disabled={storeInfoMutation.isPending} data-testid="button-saveStoreInfo">
                {storeInfoMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Tenant Confirmation */}
      <AlertDialog open={!!tenantToDelete} onOpenChange={open => !open && setTenantToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{tenantToDelete?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the tenant and all its data — products, orders, categories, users, and settings. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => tenantToDelete && deleteMutation.mutate(tenantToDelete.id)}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirmDelete"
            >
              {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Delete permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
