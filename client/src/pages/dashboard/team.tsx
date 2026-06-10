import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { apiFetch, apiRequest, queryClient } from "@/lib/queryClient";
import { getTUToken } from "@/lib/auth";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Loader2, Users, ShieldCheck, Eye, Crown } from "lucide-react";
import DashboardLayout from "./layout";

interface Permissions {
  orders: "none" | "view" | "manage";
  products: "none" | "view" | "manage";
  customers: "none" | "view";
  settings: boolean;
  team: boolean;
}

interface TeamUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  permissions: Permissions;
  isActive: number;
  createdAt: string;
}

type UserForm = {
  email: string; password: string; name: string;
  role: string;
  permissions: Permissions;
};

const ROLE_OPTIONS = [
  { value: "manager", label: "Manager" },
  { value: "staff",   label: "Staff" },
  { value: "viewer",  label: "Viewer (read-only)" },
  { value: "custom",  label: "Custom" },
];

const DEFAULT_PERMS: Record<string, Permissions> = {
  manager: { orders: "manage", products: "manage", customers: "view",  settings: false, team: false },
  staff:   { orders: "manage", products: "view",   customers: "none",  settings: false, team: false },
  viewer:  { orders: "view",   products: "view",   customers: "none",  settings: false, team: false },
  custom:  { orders: "none",   products: "none",   customers: "none",  settings: false, team: false },
};

function emptyForm(): UserForm {
  return { email: "", password: "", name: "", role: "staff", permissions: { ...DEFAULT_PERMS.staff } };
}

const ROLE_COLORS: Record<string, string> = {
  owner:   "bg-amber-100 text-amber-800",
  manager: "bg-blue-100 text-blue-700",
  staff:   "bg-green-100 text-green-700",
  viewer:  "bg-gray-100 text-gray-600",
  custom:  "bg-purple-100 text-purple-700",
};

const ROLE_ICONS: Record<string, typeof Crown> = {
  owner: Crown, manager: ShieldCheck, staff: Users, viewer: Eye,
};

function RoleIcon({ role }: { role: string }) {
  const Icon = ROLE_ICONS[role] ?? Users;
  return <Icon className="w-3.5 h-3.5" />;
}

function PermLabel({ level }: { level: "none" | "view" | "manage" | boolean }) {
  if (level === true)     return <span className="text-green-600 font-medium">Yes</span>;
  if (level === false)    return <span className="text-muted-foreground">No</span>;
  if (level === "manage") return <span className="text-green-600 font-medium">Manage</span>;
  if (level === "view")   return <span className="text-blue-600 font-medium">View</span>;
  return <span className="text-muted-foreground">None</span>;
}

export default function DashboardTeam() {
  const { slug } = useParams<{ slug: string }>();
  const { toast } = useToast();
  const token = getTUToken();
  const authHeaders = { Authorization: `Bearer ${token}` };

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<TeamUser | null>(null);
  const [form, setForm] = useState<UserForm>(emptyForm());
  const [deleteTarget, setDeleteTarget] = useState<TeamUser | null>(null);

  const { data: users = [], isLoading } = useQuery<TeamUser[]>({
    queryKey: ["/api/t", slug, "dashboard/team"],
    queryFn: () => apiFetch(`/api/t/${slug}/dashboard/team`, { headers: authHeaders }),
    enabled: !!token && !!slug,
  });

  // When role preset changes, auto-fill permissions (unless custom)
  function handleRoleChange(role: string) {
    setForm(f => ({
      ...f,
      role,
      permissions: role !== "custom" ? { ...DEFAULT_PERMS[role] ?? DEFAULT_PERMS.staff } : f.permissions,
    }));
  }

  function openCreate() {
    setEditTarget(null);
    setForm(emptyForm());
    setDialogOpen(true);
  }

  function openEdit(u: TeamUser) {
    setEditTarget(u);
    setForm({
      email: u.email,
      password: "",
      name: u.name || "",
      role: u.role,
      permissions: { ...u.permissions },
    });
    setDialogOpen(true);
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.email.trim()) throw new Error("Email is required");
      if (!editTarget && !form.password.trim()) throw new Error("Password is required");
      if (!editTarget && form.password.length < 6) throw new Error("Password must be at least 6 characters");
      const payload: any = {
        email: form.email.trim(),
        name: form.name.trim() || form.email.trim(),
        role: form.role,
        permissions: form.permissions,
      };
      if (form.password.trim()) payload.password = form.password;
      if (editTarget) {
        await apiRequest("PATCH", `/api/t/${slug}/dashboard/team/${editTarget.id}`, payload);
      } else {
        await apiRequest("POST", `/api/t/${slug}/dashboard/team`, payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/t", slug, "dashboard/team"] });
      setDialogOpen(false);
      toast({ title: editTarget ? "User updated" : "User created" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      await apiRequest("PATCH", `/api/t/${slug}/dashboard/team/${id}`, { isActive });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/t", slug, "dashboard/team"] }),
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/t/${slug}/dashboard/team/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/t", slug, "dashboard/team"] });
      setDeleteTarget(null);
      toast({ title: "User removed" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const nonOwnerUsers = users.filter(u => u.role !== "owner");
  const ownerUser = users.find(u => u.role === "owner");

  return (
    <DashboardLayout>
      <div className="p-5 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold">Team</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              {users.length} member{users.length !== 1 ? "s" : ""}
            </p>
          </div>
          <Button size="sm" onClick={openCreate} className="flex items-center gap-1.5" data-testid="button-addUser">
            <Plus className="w-4 h-4" /> Add User
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
        ) : (
          <div className="space-y-3">
            {/* Owner row (read-only) */}
            {ownerUser && (
              <div className="rounded-xl border border-amber-200 bg-amber-50/50 dark:bg-amber-900/10 dark:border-amber-800 p-4">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                    <Crown className="w-4 h-4 text-amber-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold">{ownerUser.name || ownerUser.email}</p>
                      <Badge className="bg-amber-100 text-amber-800 border-0 text-[10px] px-1.5">Owner</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{ownerUser.email}</p>
                  </div>
                  <p className="text-xs text-muted-foreground hidden sm:block">Full access · cannot be edited</p>
                </div>
              </div>
            )}

            {/* Other users */}
            {nonOwnerUsers.length === 0 ? (
              <div className="rounded-xl border border-border py-12 text-center">
                <Users className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No team members yet. Add your first user.</p>
              </div>
            ) : (
              <div className="rounded-xl border border-border divide-y divide-border overflow-hidden">
                {nonOwnerUsers.map(u => (
                  <div key={u.id} className="px-4 py-3" data-testid={`row-user-${u.id}`}>
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0 text-muted-foreground">
                        <RoleIcon role={u.role} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium">{u.name || u.email}</p>
                          <Badge className={`border-0 text-[10px] px-1.5 capitalize ${ROLE_COLORS[u.role] ?? "bg-gray-100 text-gray-600"}`}>
                            {u.role}
                          </Badge>
                          {!u.isActive && (
                            <Badge className="border-0 text-[10px] px-1.5 bg-red-100 text-red-600">Inactive</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Switch
                          checked={!!u.isActive}
                          onCheckedChange={v => toggleActiveMutation.mutate({ id: u.id, isActive: v })}
                          data-testid={`switch-userActive-${u.id}`}
                          title={u.isActive ? "Deactivate" : "Activate"}
                        />
                        <button
                          onClick={() => openEdit(u)}
                          className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                          data-testid={`button-editUser-${u.id}`}
                          title="Edit"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(u)}
                          className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                          data-testid={`button-deleteUser-${u.id}`}
                          title="Remove"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Permission summary */}
                    <div className="mt-2 ml-12 grid grid-cols-3 sm:grid-cols-5 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <div><span className="mr-1">Orders:</span><PermLabel level={u.permissions?.orders ?? "none"} /></div>
                      <div><span className="mr-1">Products:</span><PermLabel level={u.permissions?.products ?? "none"} /></div>
                      <div><span className="mr-1">Customers:</span><PermLabel level={u.permissions?.customers ?? "none"} /></div>
                      <div><span className="mr-1">Settings:</span><PermLabel level={u.permissions?.settings ?? false} /></div>
                      <div><span className="mr-1">Team:</span><PermLabel level={u.permissions?.team ?? false} /></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Add / Edit dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={v => !v && setDialogOpen(false)}>
        <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editTarget ? "Edit User" : "Add Team Member"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Basic info */}
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Full Name</Label>
                <Input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Ahmed Al-Rashidi"
                  data-testid="input-userName"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Email *</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="employee@store.com"
                  data-testid="input-userEmail"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{editTarget ? "New Password (leave blank to keep)" : "Password *"}</Label>
                <Input
                  type="password"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="Min 6 characters"
                  data-testid="input-userPassword"
                />
              </div>
            </div>

            {/* Role preset */}
            <div className="space-y-1">
              <Label className="text-xs">Role</Label>
              <Select value={form.role} onValueChange={handleRoleChange}>
                <SelectTrigger data-testid="select-userRole"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map(r => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-0.5">
                {form.role === "manager" && "Full access to orders & products, no store settings."}
                {form.role === "staff"   && "Can manage orders, view products only."}
                {form.role === "viewer"  && "View-only across all sections."}
                {form.role === "custom"  && "Set permissions manually below."}
              </p>
            </div>

            {/* Permissions grid */}
            <div className="rounded-xl border border-border p-3 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Permissions</p>

              {/* Orders */}
              <div className="flex items-center justify-between gap-2">
                <Label className="text-xs font-normal">Orders</Label>
                <Select
                  value={form.permissions.orders}
                  onValueChange={v => setForm(f => ({ ...f, role: "custom", permissions: { ...f.permissions, orders: v as any } }))}
                >
                  <SelectTrigger className="h-7 text-xs w-28"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" className="text-xs">No access</SelectItem>
                    <SelectItem value="view" className="text-xs">View only</SelectItem>
                    <SelectItem value="manage" className="text-xs">Full manage</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Products */}
              <div className="flex items-center justify-between gap-2">
                <Label className="text-xs font-normal">Products</Label>
                <Select
                  value={form.permissions.products}
                  onValueChange={v => setForm(f => ({ ...f, role: "custom", permissions: { ...f.permissions, products: v as any } }))}
                >
                  <SelectTrigger className="h-7 text-xs w-28"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" className="text-xs">No access</SelectItem>
                    <SelectItem value="view" className="text-xs">View only</SelectItem>
                    <SelectItem value="manage" className="text-xs">Full manage</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Customers */}
              <div className="flex items-center justify-between gap-2">
                <Label className="text-xs font-normal">Customers</Label>
                <Select
                  value={form.permissions.customers}
                  onValueChange={v => setForm(f => ({ ...f, role: "custom", permissions: { ...f.permissions, customers: v as any } }))}
                >
                  <SelectTrigger className="h-7 text-xs w-28"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" className="text-xs">No access</SelectItem>
                    <SelectItem value="view" className="text-xs">View only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Settings */}
              <div className="flex items-center justify-between gap-2">
                <Label className="text-xs font-normal">Store Settings</Label>
                <Switch
                  checked={form.permissions.settings}
                  onCheckedChange={v => setForm(f => ({ ...f, role: "custom", permissions: { ...f.permissions, settings: v } }))}
                  data-testid="switch-permSettings"
                />
              </div>

              {/* Team */}
              <div className="flex items-center justify-between gap-2">
                <Label className="text-xs font-normal">Team Management</Label>
                <Switch
                  checked={form.permissions.team}
                  onCheckedChange={v => setForm(f => ({ ...f, role: "custom", permissions: { ...f.permissions, team: v } }))}
                  data-testid="switch-permTeam"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button className="flex-1" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} data-testid="button-saveUser">
                {saveMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                {editTarget ? "Save Changes" : "Add Member"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirm ── */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="max-w-xs">
          <DialogHeader><DialogTitle>Remove User?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Remove <strong>{deleteTarget?.name || deleteTarget?.email}</strong> from your team? They will no longer be able to log in.
          </p>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button
              variant="destructive" className="flex-1"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              disabled={deleteMutation.isPending}
              data-testid="button-confirmDeleteUser"
            >
              {deleteMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Remove
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
