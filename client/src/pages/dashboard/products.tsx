import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { apiFetch, apiRequest, queryClient } from "@/lib/queryClient";
import { getTUToken } from "@/lib/auth";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Package, Loader2, Pencil, Trash2, Copy,
  Tag, Search, CheckCircle2, XCircle,
} from "lucide-react";
import DashboardLayout from "./layout";
import { ImageUpload } from "@/components/image-upload";
import { ImagePositionPicker } from "@/components/image-position-picker";
import { resolveUrl } from "@/lib/queryClient";

interface Category { id: string; nameEn: string; nameAr: string; isActive: number; sortOrder: number; }
interface Product {
  id: string; name: string; description: string;
  basePrice: number; isAvailable: boolean; imageUrl: string; imagePosition: string;
  categoryId: string | null; stockQuantity: number;
}

type ProductForm = {
  name: string; description: string; basePrice: string;
  imageUrl: string; imagePosition: string; isAvailable: boolean;
  categoryId: string; stockQuantity: string;
};

type CategoryForm = { nameEn: string; nameAr: string; };

const emptyForm = (): ProductForm => ({
  name: "", description: "", basePrice: "", imageUrl: "", imagePosition: "50% 50%",
  isAvailable: true, categoryId: "none", stockQuantity: "999",
});

function formatKWD(n: number) { return n.toFixed(3) + " KWD"; }

export default function DashboardProducts() {
  const { slug } = useParams<{ slug: string }>();
  const { toast } = useToast();
  const token = getTUToken();
  const authHeaders = { Authorization: `Bearer ${token}` };

  // UI state
  const [tab, setTab] = useState<"products" | "categories">("products");
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("all");

  // Product dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Product | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyForm());

  // Delete confirms
  const [deleteProduct, setDeleteProduct] = useState<Product | null>(null);
  const [deleteCategory, setDeleteCategory] = useState<Category | null>(null);

  // Category dialog
  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [editCat, setEditCat] = useState<Category | null>(null);
  const [catForm, setCatForm] = useState<CategoryForm>({ nameEn: "", nameAr: "" });

  // Queries
  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ["/api/t", slug, "dashboard/products"],
    queryFn: () => apiFetch(`/api/t/${slug}/dashboard/products`, { headers: authHeaders }),
    enabled: !!token && !!slug,
  });

  const { data: categories = [], isLoading: catsLoading } = useQuery<Category[]>({
    queryKey: ["/api/t", slug, "dashboard/categories"],
    queryFn: () => apiFetch(`/api/t/${slug}/dashboard/categories`, { headers: authHeaders }),
    enabled: !!token && !!slug,
  });

  // Filtered products
  const filtered = products.filter(p => {
    const matchSearch = !search.trim() || p.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCat === "all" || p.categoryId === filterCat || (filterCat === "__none" && !p.categoryId);
    return matchSearch && matchCat;
  });

  // ── Product CRUD ────────────────────────────────────────────────────────
  function openCreate() {
    setEditTarget(null);
    setForm(emptyForm());
    setDialogOpen(true);
  }

  function openEdit(p: Product) {
    setEditTarget(p);
    setForm({
      name: p.name, description: p.description,
      basePrice: String(p.basePrice), imageUrl: p.imageUrl,
      imagePosition: p.imagePosition || "50% 50%",
      isAvailable: p.isAvailable,
      categoryId: p.categoryId || "none",
      stockQuantity: String(p.stockQuantity ?? 999),
    });
    setDialogOpen(true);
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const price = parseFloat(form.basePrice);
      if (!form.name.trim()) throw new Error("Product name is required");
      if (isNaN(price) || price < 0) throw new Error("Enter a valid price");
      const stock = parseInt(form.stockQuantity);
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        basePrice: price,
        imageUrl: form.imageUrl.trim() || null,
        imagePosition: form.imagePosition || "50% 50%",
        isAvailable: form.isAvailable,
        categoryId: form.categoryId === "none" ? null : form.categoryId,
        stockQuantity: isNaN(stock) ? 999 : stock,
      };
      if (editTarget) {
        await apiRequest("PATCH", `/api/t/${slug}/dashboard/products/${editTarget.id}`, payload);
      } else {
        await apiRequest("POST", `/api/t/${slug}/dashboard/products`, payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/t", slug, "dashboard/products"] });
      setDialogOpen(false);
      toast({ title: editTarget ? "Product updated" : "Product added" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/t/${slug}/dashboard/products/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/t", slug, "dashboard/products"] });
      setDeleteProduct(null);
      toast({ title: "Product deleted" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const duplicateMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("POST", `/api/t/${slug}/dashboard/products/${id}/duplicate`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/t", slug, "dashboard/products"] });
      toast({ title: "Product duplicated" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  // ── Category CRUD ───────────────────────────────────────────────────────
  function openCreateCat() {
    setEditCat(null);
    setCatForm({ nameEn: "", nameAr: "" });
    setCatDialogOpen(true);
  }

  function openEditCat(c: Category) {
    setEditCat(c);
    setCatForm({ nameEn: c.nameEn, nameAr: c.nameAr });
    setCatDialogOpen(true);
  }

  const saveCatMutation = useMutation({
    mutationFn: async () => {
      if (!catForm.nameEn.trim()) throw new Error("Category name (English) is required");
      const payload = { nameEn: catForm.nameEn.trim(), nameAr: catForm.nameAr.trim() || catForm.nameEn.trim() };
      if (editCat) {
        await apiRequest("PATCH", `/api/t/${slug}/dashboard/categories/${editCat.id}`, payload);
      } else {
        await apiRequest("POST", `/api/t/${slug}/dashboard/categories`, payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/t", slug, "dashboard/categories"] });
      setCatDialogOpen(false);
      toast({ title: editCat ? "Category updated" : "Category created" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteCatMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/t/${slug}/dashboard/categories/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/t", slug, "dashboard/categories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/t", slug, "dashboard/products"] });
      setDeleteCategory(null);
      toast({ title: "Category deleted" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  function getCategoryName(catId: string | null) {
    if (!catId) return null;
    return categories.find(c => c.id === catId)?.nameEn ?? null;
  }

  return (
    <DashboardLayout>
      <div className="p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold">Products</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              {products.length} product{products.length !== 1 ? "s" : ""} · {categories.length} categor{categories.length !== 1 ? "ies" : "y"}
            </p>
          </div>
          {tab === "products" ? (
            <Button size="sm" onClick={openCreate} className="flex items-center gap-1.5" data-testid="button-addProduct">
              <Plus className="w-4 h-4" /> Add Product
            </Button>
          ) : (
            <Button size="sm" onClick={openCreateCat} className="flex items-center gap-1.5" data-testid="button-addCategory">
              <Plus className="w-4 h-4" /> Add Category
            </Button>
          )}
        </div>

        {/* Tabs */}
        <Tabs value={tab} onValueChange={v => setTab(v as "products" | "categories")}>
          <TabsList className="w-full">
            <TabsTrigger value="products" className="flex-1" data-testid="tab-products">
              <Package className="w-3.5 h-3.5 mr-1.5" /> Products
            </TabsTrigger>
            <TabsTrigger value="categories" className="flex-1" data-testid="tab-categories">
              <Tag className="w-3.5 h-3.5 mr-1.5" /> Categories
            </TabsTrigger>
          </TabsList>

          {/* ── Products tab ── */}
          <TabsContent value="products" className="mt-3 space-y-3">
            {/* Search + category filter */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input
                  className="pl-9"
                  placeholder="Search products..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  data-testid="input-productSearch"
                />
              </div>
              <Select value={filterCat} onValueChange={setFilterCat}>
                <SelectTrigger className="w-40 shrink-0" data-testid="select-categoryFilter">
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  <SelectItem value="__none">Uncategorized</SelectItem>
                  {categories.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.nameEn}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {isLoading ? (
              <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
            ) : filtered.length === 0 ? (
              <div className="rounded-xl border border-border py-12 text-center">
                <Package className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  {search || filterCat !== "all" ? "No products match filters." : "No products yet. Add your first product."}
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-border divide-y divide-border overflow-hidden">
                {filtered.map(product => {
                  const catName = getCategoryName(product.categoryId);
                  const lowStock = (product.stockQuantity ?? 999) < 5;
                  return (
                    <div key={product.id} className="flex items-center gap-3 px-4 py-3" data-testid={`row-product-${product.id}`}>
                      {product.imageUrl ? (
                        <img src={resolveUrl(product.imageUrl)} alt={product.name} className="w-10 h-10 rounded-lg object-cover shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                          <Package className="w-4 h-4 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-sm font-medium">{product.name}</p>
                          {catName && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{catName}</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          {product.isAvailable ? (
                            <span className="flex items-center gap-0.5 text-xs text-green-600">
                              <CheckCircle2 className="w-3 h-3" /> Available
                            </span>
                          ) : (
                            <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                              <XCircle className="w-3 h-3" /> Hidden
                            </span>
                          )}
                          <span className={`text-xs ${lowStock ? "text-amber-600 font-medium" : "text-muted-foreground"}`}>
                            Stock: {product.stockQuantity ?? 999}
                            {lowStock && " ⚠"}
                          </span>
                        </div>
                      </div>
                      <div className="text-right shrink-0 mr-2">
                        <p className="text-sm font-semibold">{formatKWD(product.basePrice)}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => duplicateMutation.mutate(product.id)}
                          disabled={duplicateMutation.isPending}
                          className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                          data-testid={`button-duplicateProduct-${product.id}`}
                          title="Duplicate"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => openEdit(product)}
                          className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                          data-testid={`button-editProduct-${product.id}`}
                          title="Edit product"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteProduct(product)}
                          className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                          data-testid={`button-deleteProduct-${product.id}`}
                          title="Delete product"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* ── Categories tab ── */}
          <TabsContent value="categories" className="mt-3">
            {catsLoading ? (
              <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-12 rounded-xl" />)}</div>
            ) : categories.length === 0 ? (
              <div className="rounded-xl border border-border py-12 text-center">
                <Tag className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No categories yet. Add one to organize your menu.</p>
              </div>
            ) : (
              <div className="rounded-xl border border-border divide-y divide-border overflow-hidden">
                {categories.map(cat => {
                  const count = products.filter(p => p.categoryId === cat.id).length;
                  return (
                    <div key={cat.id} className="flex items-center gap-3 px-4 py-3" data-testid={`row-category-${cat.id}`}>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{cat.nameEn}</p>
                        {cat.nameAr && cat.nameAr !== cat.nameEn && (
                          <p className="text-xs text-muted-foreground" dir="rtl">{cat.nameAr}</p>
                        )}
                      </div>
                      <Badge variant="secondary" className="text-xs shrink-0">{count} product{count !== 1 ? "s" : ""}</Badge>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => openEditCat(cat)}
                          className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                          data-testid={`button-editCategory-${cat.id}`}
                          title="Edit"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteCategory(cat)}
                          className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                          data-testid={`button-deleteCategory-${cat.id}`}
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Product dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm flex flex-col max-h-[90vh]">
          <DialogHeader className="shrink-0">
            <DialogTitle>{editTarget ? "Edit Product" : "Add Product"}</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 pr-1">
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="prodName" className="text-xs">Name *</Label>
              <Input id="prodName" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} data-testid="input-productName" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="prodDesc" className="text-xs">Description</Label>
              <Textarea id="prodDesc" rows={2} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} data-testid="input-productDescription" className="resize-none" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="prodPrice" className="text-xs">Base Price (KWD) *</Label>
                <Input id="prodPrice" type="number" min="0" step="0.001" value={form.basePrice} onChange={e => setForm(p => ({ ...p, basePrice: e.target.value }))} data-testid="input-productPrice" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="prodStock" className="text-xs">Stock Qty</Label>
                <Input id="prodStock" type="number" min="0" step="1" value={form.stockQuantity} onChange={e => setForm(p => ({ ...p, stockQuantity: e.target.value }))} data-testid="input-productStock" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Category</Label>
              <Select value={form.categoryId} onValueChange={v => setForm(p => ({ ...p, categoryId: v }))}>
                <SelectTrigger data-testid="select-productCategory">
                  <SelectValue placeholder="No category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No category</SelectItem>
                  {categories.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.nameEn}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Product Image</Label>
              <ImageUpload
                value={form.imageUrl}
                onChange={url => setForm(p => ({ ...p, imageUrl: url, imagePosition: "50% 50%" }))}
              />
            </div>
            {form.imageUrl ? (
              <ImagePositionPicker
                imageUrl={form.imageUrl}
                position={form.imagePosition}
                onChange={pos => setForm(p => ({ ...p, imagePosition: pos }))}
              />
            ) : null}
            <div className="flex items-center justify-between py-1">
              <Label className="text-xs">Available for ordering</Label>
              <Switch checked={form.isAvailable} onCheckedChange={v => setForm(p => ({ ...p, isAvailable: v }))} data-testid="switch-productAvailable" />
            </div>
          </div>
          </div>
          <div className="flex gap-2 pt-2 shrink-0 border-t border-border">
            <Button variant="outline" className="flex-1" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button className="flex-1" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} data-testid="button-saveProduct">
              {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {editTarget ? "Save Changes" : "Add Product"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Category dialog ── */}
      <Dialog open={catDialogOpen} onOpenChange={setCatDialogOpen}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>{editCat ? "Edit Category" : "Add Category"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Name (English) *</Label>
              <Input
                value={catForm.nameEn}
                onChange={e => setCatForm(p => ({ ...p, nameEn: e.target.value }))}
                placeholder="e.g. Burgers"
                data-testid="input-categoryNameEn"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Name (Arabic)</Label>
              <Input
                value={catForm.nameAr}
                onChange={e => setCatForm(p => ({ ...p, nameAr: e.target.value }))}
                placeholder="e.g. برجر"
                dir="rtl"
                data-testid="input-categoryNameAr"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setCatDialogOpen(false)}>Cancel</Button>
              <Button className="flex-1" onClick={() => saveCatMutation.mutate()} disabled={saveCatMutation.isPending} data-testid="button-saveCategory">
                {saveCatMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {editCat ? "Save" : "Create"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete product confirm ── */}
      <Dialog open={!!deleteProduct} onOpenChange={() => setDeleteProduct(null)}>
        <DialogContent className="max-w-xs">
          <DialogHeader><DialogTitle>Delete Product?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Remove <strong>{deleteProduct?.name}</strong>? This cannot be undone.</p>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setDeleteProduct(null)}>Cancel</Button>
            <Button
              variant="destructive" className="flex-1"
              onClick={() => deleteProduct && deleteMutation.mutate(deleteProduct.id)}
              disabled={deleteMutation.isPending}
              data-testid="button-confirmDeleteProduct"
            >
              {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete category confirm ── */}
      <Dialog open={!!deleteCategory} onOpenChange={() => setDeleteCategory(null)}>
        <DialogContent className="max-w-xs">
          <DialogHeader><DialogTitle>Delete Category?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Remove <strong>{deleteCategory?.nameEn}</strong>? Products in this category will become uncategorized.
          </p>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setDeleteCategory(null)}>Cancel</Button>
            <Button
              variant="destructive" className="flex-1"
              onClick={() => deleteCategory && deleteCatMutation.mutate(deleteCategory.id)}
              disabled={deleteCatMutation.isPending}
              data-testid="button-confirmDeleteCategory"
            >
              {deleteCatMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
