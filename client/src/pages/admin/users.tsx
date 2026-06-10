import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiFetch, apiRequest, queryClient } from "@/lib/queryClient";
import { getSAToken } from "@/lib/auth";
import AdminLayout from "./layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Plus, Loader2, Shield } from "lucide-react";

interface AdminUser { id: string; email: string; name: string | null; role: string; isActive: number; createdAt: string; }

export default function AdminUsers() {
  const token = getSAToken();
  const { toast } = useToast();
  const authH = { Authorization: `Bearer ${token}` };
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", name: "", role: "admin" });

  const { data: users = [], isLoading } = useQuery<AdminUser[]>({
    queryKey: ["/api/super-admin/users"],
    queryFn: () => apiFetch("/api/super-admin/users", { headers: authH }),
    enabled: !!token,
  });

  const createMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/super-admin/users", form, authH),
    onSuccess: () => {
      setOpen(false);
      setForm({ email: "", password: "", name: "", role: "admin" });
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/users"] });
      toast({ title: "Admin user created" });
    },
    onError: async (err: any) => {
      const msg = await err.response?.json?.().then((d: any) => d.message).catch(() => err.message);
      toast({ title: "Error", description: msg || err.message, variant: "destructive" });
    },
  });

  return (
    <AdminLayout>
      <div className="p-5 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold">Admin Users</h1>
            <p className="text-muted-foreground text-sm">{users.length} super admin accounts</p>
          </div>
          <Button size="sm" onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-1.5" /> Add Admin</Button>
        </div>

        {isLoading ? (
          <div className="space-y-3">{[1,2].map(i => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}</div>
        ) : (
          <div className="rounded-xl border border-border divide-y divide-border overflow-hidden">
            {users.map(u => (
              <div key={u.id} className="px-4 py-3 flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Shield className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{u.name || u.email}</p>
                  <p className="text-xs text-muted-foreground">{u.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${u.role === "admin" ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-700"}`}>{u.role}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${u.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{u.isActive ? "Active" : "Inactive"}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={v => !v && setOpen(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Add Admin User</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label className="text-xs">Email *</Label>
              <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="admin@example.com" /></div>
            <div className="space-y-1"><Label className="text-xs">Password *</Label>
              <Input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Min 6 characters" /></div>
            <div className="space-y-1"><Label className="text-xs">Name</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="John Admin" /></div>
            <div className="space-y-1"><Label className="text-xs">Role</Label>
              <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v }))}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin" className="text-sm">Admin (full access)</SelectItem>
                  <SelectItem value="auditor" className="text-sm">Auditor (read-only)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>Cancel</Button>
              <Button className="flex-1" onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
                {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Create
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
