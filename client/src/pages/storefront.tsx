import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ShoppingCart, Minus, Plus, X, Store, MapPin, Truck } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

interface StoreInfo {
  id: string; name: string; slug: string; primaryColor: string;
  logoUrl: string; description: string; currency: string;
  pickupEnabled: boolean; deliveryEnabled: boolean;
  pickupAddress: string; pickupLocations: PickupLocation[];
  status: string;
}
interface PickupLocation { id: string; name: string; address: string; enabled: boolean; }
interface Category { id: string; name: string; sortOrder: number; }
interface ProductVariant { id: string; name: string; priceModifier: number; }
interface Product {
  id: string; name: string; description: string; basePrice: number;
  imageUrl: string; categoryId: string | null; isAvailable: boolean;
  variants: ProductVariant[];
}
interface CartItem { product: Product; variant: ProductVariant | null; qty: number; }

function formatKWD(amount: number) { return amount.toFixed(3) + " KWD"; }

export default function Storefront() {
  const { slug } = useParams<{ slug: string }>();
  const [, navigate] = useLocation();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [fulfillment, setFulfillment] = useState<"pickup" | "delivery">("pickup");
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");

  const { data: store, isLoading: storeLoading, isError } = useQuery<StoreInfo>({
    queryKey: ["/api/t", slug, "store-info"],
    queryFn: () => apiFetch(`/api/t/${slug}/store-info`),
    enabled: !!slug,
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/t", slug, "categories"],
    queryFn: () => apiFetch(`/api/t/${slug}/categories`),
    enabled: !!slug,
  });

  const { data: products = [], isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: ["/api/t", slug, "products"],
    queryFn: () => apiFetch(`/api/t/${slug}/products`),
    enabled: !!slug,
  });

  // Default to first available fulfillment method + auto-select first branch
  useEffect(() => {
    if (store) {
      if (store.pickupEnabled) setFulfillment("pickup");
      else if (store.deliveryEnabled) setFulfillment("delivery");
      const branches = (store.pickupLocations || []).filter(l => l.enabled);
      if (branches.length > 0) setSelectedBranchId(branches[0].id);
    }
  }, [store]);

  const accentColor = store?.primaryColor || "#0ea5e9";

  function cartTotal() {
    return cart.reduce((sum, item) => sum + (item.product.basePrice + (item.variant?.priceModifier ?? 0)) * item.qty, 0);
  }
  function cartCount() { return cart.reduce((sum, item) => sum + item.qty, 0); }

  function addToCart(product: Product, variant: ProductVariant | null) {
    setCart(prev => {
      const key = product.id + (variant?.id ?? "");
      const existing = prev.find(i => i.product.id + (i.variant?.id ?? "") === key);
      if (existing) return prev.map(i => i === existing ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { product, variant, qty: 1 }];
    });
  }

  function changeQty(key: string, delta: number) {
    setCart(prev =>
      prev.map(i => {
        if (i.product.id + (i.variant?.id ?? "") === key) return { ...i, qty: Math.max(0, i.qty + delta) };
        return i;
      }).filter(i => i.qty > 0)
    );
  }

  function removeItem(key: string) {
    setCart(prev => prev.filter(i => i.product.id + (i.variant?.id ?? "") !== key));
  }

  function goToCheckout() {
    sessionStorage.setItem(`cart_${slug}`, JSON.stringify(cart));
    sessionStorage.setItem(`fulfillment_${slug}`, fulfillment);
    if (selectedBranchId) sessionStorage.setItem(`branch_${slug}`, selectedBranchId);
    navigate(`/t/${slug}/checkout`);
  }

  const filteredProducts = activeCategory
    ? products.filter(p => p.categoryId === activeCategory)
    : products;

  const bothEnabled = store?.pickupEnabled && store?.deliveryEnabled;
  const enabledBranches = (store?.pickupLocations || []).filter(l => l.enabled);

  if (isError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background text-foreground">
        <Store className="w-12 h-12 text-muted-foreground" />
        <h2 className="text-xl font-semibold">Store not found</h2>
        <p className="text-muted-foreground text-sm">The store you're looking for doesn't exist or is unavailable.</p>
      </div>
    );
  }

  if (storeLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="h-14 border-b border-border flex items-center px-4 gap-3">
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-5 w-36" />
        </div>
        <div className="max-w-5xl mx-auto p-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-4">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-52 rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (store?.status !== "active") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background text-foreground">
        <Store className="w-12 h-12 text-muted-foreground" />
        <h2 className="text-xl font-semibold">Store is currently unavailable</h2>
        <p className="text-muted-foreground text-sm">Please check back later.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            {store.logoUrl ? (
              <img src={store.logoUrl} alt={store.name} className="h-8 w-8 rounded-full object-cover shrink-0" />
            ) : (
              <div className="h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ backgroundColor: accentColor }}>
                {store.name.charAt(0).toUpperCase()}
              </div>
            )}
            <span className="font-semibold text-base truncate">{store.name}</span>
          </div>
          <button
            data-testid="button-cart"
            onClick={() => setCartOpen(true)}
            className="relative flex items-center gap-2 px-3 py-1.5 rounded-full border border-border hover:bg-accent transition-colors text-sm font-medium"
          >
            <ShoppingCart className="w-4 h-4" />
            <span>Cart</span>
            {cartCount() > 0 && (
              <span className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full text-[10px] font-bold text-white flex items-center justify-center" style={{ backgroundColor: accentColor }}>
                {cartCount()}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Fulfillment bar — toggle + branch selector */}
      {(store?.pickupEnabled || store?.deliveryEnabled) && (
        <div className="border-b border-border bg-background">
          <div className="max-w-5xl mx-auto px-4 py-2 space-y-2">
            {/* Pickup / Delivery toggle (only when both enabled) */}
            {bothEnabled && (
              <div className="flex items-center gap-2">
                <button
                  data-testid="button-fulfillment-pickup"
                  onClick={() => setFulfillment("pickup")}
                  className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    fulfillment === "pickup" ? "text-white" : "bg-muted text-muted-foreground hover:bg-accent"
                  }`}
                  style={fulfillment === "pickup" ? { backgroundColor: accentColor } : {}}
                >
                  <MapPin className="w-3.5 h-3.5" /> Pickup
                </button>
                <button
                  data-testid="button-fulfillment-delivery"
                  onClick={() => setFulfillment("delivery")}
                  className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    fulfillment === "delivery" ? "text-white" : "bg-muted text-muted-foreground hover:bg-accent"
                  }`}
                  style={fulfillment === "delivery" ? { backgroundColor: accentColor } : {}}
                >
                  <Truck className="w-3.5 h-3.5" /> Delivery
                </button>
              </div>
            )}

            {/* Branch selector — shown when pickup is selected and multiple branches exist */}
            {fulfillment === "pickup" && enabledBranches.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap pb-1">
                {enabledBranches.length === 1 ? (
                  // Single branch — just show the info, no selection needed
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <MapPin className="w-3 h-3 shrink-0" />
                    <span className="font-medium text-foreground">{enabledBranches[0].name}</span>
                    {enabledBranches[0].address && (
                      <span className="text-muted-foreground">· {enabledBranches[0].address}</span>
                    )}
                  </div>
                ) : (
                  // Multiple branches — pill selector
                  enabledBranches.map(branch => (
                    <button
                      key={branch.id}
                      data-testid={`button-branch-${branch.id}`}
                      onClick={() => setSelectedBranchId(branch.id)}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                        selectedBranchId === branch.id
                          ? "text-white border-transparent"
                          : "border-border bg-muted text-muted-foreground hover:bg-accent"
                      }`}
                      style={selectedBranchId === branch.id ? { backgroundColor: accentColor, borderColor: accentColor } : {}}
                    >
                      <MapPin className="w-3 h-3" />
                      {branch.name}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Category filter */}
      {categories.length > 0 && (
        <div className="border-b border-border bg-background">
          <div className="max-w-5xl mx-auto px-4">
            <div className="flex gap-2 py-2 overflow-x-auto scrollbar-none">
              <button
                onClick={() => setActiveCategory(null)}
                className={`px-3 py-1 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${!activeCategory ? "text-white" : "bg-muted text-muted-foreground hover:bg-accent"}`}
                style={!activeCategory ? { backgroundColor: accentColor } : {}}
              >
                All
              </button>
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`px-3 py-1 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${activeCategory === cat.id ? "text-white" : "bg-muted text-muted-foreground hover:bg-accent"}`}
                  style={activeCategory === cat.id ? { backgroundColor: accentColor } : {}}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Products */}
      <main className="max-w-5xl mx-auto px-4 py-6">
        {store.description && <p className="text-muted-foreground text-sm mb-6">{store.description}</p>}
        {productsLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-52 rounded-xl" />)}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground"><p className="text-sm">No products available yet.</p></div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredProducts.filter(p => p.isAvailable).map(product => (
              <ProductCard key={product.id} product={product} accentColor={accentColor} onAddToCart={addToCart} />
            ))}
          </div>
        )}
      </main>

      {/* Cart drawer */}
      <Sheet open={cartOpen} onOpenChange={setCartOpen}>
        <SheetContent side="right" className="w-full max-w-sm flex flex-col">
          <SheetHeader>
            <SheetTitle>Your Cart</SheetTitle>
          </SheetHeader>

          {cart.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground">
              <ShoppingCart className="w-10 h-10" />
              <p className="text-sm">Your cart is empty</p>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto space-y-3 py-3">
                {cart.map(item => {
                  const key = item.product.id + (item.variant?.id ?? "");
                  const price = item.product.basePrice + (item.variant?.priceModifier ?? 0);
                  return (
                    <div key={key} className="flex items-start gap-3 p-3 rounded-lg border border-border">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium leading-tight">{item.product.name}</p>
                        {item.variant && <p className="text-xs text-muted-foreground mt-0.5">{item.variant.name}</p>}
                        <p className="text-xs font-semibold mt-1">{formatKWD(price)}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button onClick={() => changeQty(key, -1)} className="h-6 w-6 rounded-full border border-border flex items-center justify-center hover:bg-accent transition-colors">
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-sm w-4 text-center">{item.qty}</span>
                        <button onClick={() => changeQty(key, 1)} className="h-6 w-6 rounded-full border border-border flex items-center justify-center hover:bg-accent transition-colors">
                          <Plus className="w-3 h-3" />
                        </button>
                        <button onClick={() => removeItem(key)} className="ml-1 text-muted-foreground hover:text-destructive transition-colors">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="border-t border-border pt-3 space-y-3">
                {/* Fulfillment summary / switch in cart */}
                {bothEnabled ? (
                  <div className="space-y-1.5">
                    <div className="rounded-lg border border-border p-2 flex gap-2">
                      <button
                        onClick={() => setFulfillment("pickup")}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-xs font-medium transition-colors ${fulfillment === "pickup" ? "text-white" : "text-muted-foreground hover:bg-muted"}`}
                        style={fulfillment === "pickup" ? { backgroundColor: accentColor } : {}}
                        data-testid="button-cart-pickup"
                      >
                        <MapPin className="w-3 h-3" /> Pickup
                      </button>
                      <button
                        onClick={() => setFulfillment("delivery")}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-xs font-medium transition-colors ${fulfillment === "delivery" ? "text-white" : "text-muted-foreground hover:bg-muted"}`}
                        style={fulfillment === "delivery" ? { backgroundColor: accentColor } : {}}
                        data-testid="button-cart-delivery"
                      >
                        <Truck className="w-3 h-3" /> Delivery
                      </button>
                    </div>
                    {fulfillment === "pickup" && enabledBranches.length > 0 && (() => {
                      const selBranch = enabledBranches.find(b => b.id === selectedBranchId) || enabledBranches[0];
                      return selBranch ? (
                        <p className="text-xs text-muted-foreground px-1">
                          <span className="font-medium text-foreground">{selBranch.name}</span>
                          {selBranch.address ? ` — ${selBranch.address}` : ""}
                        </p>
                      ) : null;
                    })()} 
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    {store?.pickupEnabled ? <MapPin className="w-3.5 h-3.5" /> : <Truck className="w-3.5 h-3.5" />}
                    <span>{store?.pickupEnabled ? "Pickup" : "Delivery"}</span>
                    {fulfillment === "pickup" && enabledBranches.length === 1 && (
                      <span className="text-foreground font-medium">— {enabledBranches[0].name}</span>
                    )}
                  {fulfillment === "pickup" && enabledBranches.length > 1 && (() => {
                    const selBranch = enabledBranches.find(b => b.id === selectedBranchId);
                    return selBranch ? <span className="text-foreground font-medium">— {selBranch.name}</span> : null;
                  })()}
                  </div>
                )}

                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Subtotal</span>
                  <span className="font-semibold">{formatKWD(cartTotal())}</span>
                </div>
                <Button
                  className="w-full text-white"
                  style={{ backgroundColor: accentColor }}
                  onClick={goToCheckout}
                  data-testid="button-checkout"
                >
                  Checkout — {fulfillment === "pickup" ? "Pickup" : "Delivery"}
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function ProductCard({ product, accentColor, onAddToCart }: {
  product: Product; accentColor: string;
  onAddToCart: (product: Product, variant: ProductVariant | null) => void;
}) {
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(
    product.variants.length > 0 ? product.variants[0] : null
  );
  const price = product.basePrice + (selectedVariant?.priceModifier ?? 0);

  return (
    <div data-testid={`card-product-${product.id}`} className="rounded-xl border border-border bg-card overflow-hidden flex flex-col hover:shadow-sm transition-shadow">
      {product.imageUrl ? (
        <img src={product.imageUrl} alt={product.name} className="w-full h-32 object-cover" />
      ) : (
        <div className="w-full h-32 bg-muted flex items-center justify-center">
          <span className="text-2xl">🛍️</span>
        </div>
      )}
      <div className="p-3 flex flex-col flex-1 gap-2">
        <p className="text-sm font-semibold leading-tight line-clamp-2">{product.name}</p>
        {product.description && <p className="text-xs text-muted-foreground line-clamp-2 flex-1">{product.description}</p>}
        {product.variants.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {product.variants.map(v => (
              <button
                key={v.id}
                onClick={() => setSelectedVariant(v)}
                className={`px-2 py-0.5 rounded text-xs font-medium border transition-colors ${
                  selectedVariant?.id === v.id ? "text-white border-transparent" : "border-border text-muted-foreground hover:bg-accent"
                }`}
                style={selectedVariant?.id === v.id ? { backgroundColor: accentColor, borderColor: accentColor } : {}}
              >
                {v.name}
              </button>
            ))}
          </div>
        )}
        <div className="flex items-center justify-between mt-auto gap-2">
          <span className="text-sm font-bold">{formatKWD(price)}</span>
          <button
            onClick={() => onAddToCart(product, selectedVariant)}
            className="h-7 w-7 rounded-full flex items-center justify-center text-white transition-opacity hover:opacity-90 shrink-0"
            style={{ backgroundColor: accentColor }}
            data-testid={`button-add-${product.id}`}
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
