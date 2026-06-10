import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import Storefront from "@/pages/storefront";
import Checkout from "@/pages/checkout";
import Confirm from "@/pages/confirm";
import TenantLogin from "@/pages/tenant-login";
import DashboardOverview from "@/pages/dashboard/overview";
import DashboardOrders from "@/pages/dashboard/orders";
import DashboardProducts from "@/pages/dashboard/products";
import DashboardSettings from "@/pages/dashboard/settings";
import DashboardCustomers from "@/pages/dashboard/customers";
import DashboardTeam from "@/pages/dashboard/team";
import AdminLogin from "@/pages/admin-login";
import AdminLayout from "@/pages/admin/layout";
import AdminDashboard from "@/pages/admin/dashboard";
import AdminTenants from "@/pages/admin/tenants";
import AdminAnalytics from "@/pages/admin/analytics";
import AdminAuditLog from "@/pages/admin/audit-log";
import AdminSettings from "@/pages/admin/settings";
import AdminUsers from "@/pages/admin/users";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";

function AppRouter() {
  return (
    <Switch>
      <Route path="/" component={Landing} />

      {/* Tenant storefront */}
      <Route path="/t/:slug" component={Storefront} />
      <Route path="/t/:slug/checkout" component={Checkout} />
      <Route path="/t/:slug/confirm" component={Confirm} />
      <Route path="/t/:slug/login" component={TenantLogin} />

      {/* Tenant dashboard */}
      <Route path="/t/:slug/dashboard" component={DashboardOverview} />
      <Route path="/t/:slug/dashboard/orders" component={DashboardOrders} />
      <Route path="/t/:slug/dashboard/products" component={DashboardProducts} />
      <Route path="/t/:slug/dashboard/settings" component={DashboardSettings} />
      <Route path="/t/:slug/dashboard/customers" component={DashboardCustomers} />
      <Route path="/t/:slug/dashboard/team" component={DashboardTeam} />

      {/* Super admin */}
      <Route path="/admin/login" component={AdminLogin} />
      <Route path="/admin" component={AdminDashboard} />
      <Route path="/admin/tenants" component={AdminTenants} />
      <Route path="/admin/analytics" component={AdminAnalytics} />
      <Route path="/admin/audit-log" component={AdminAuditLog} />
      <Route path="/admin/settings" component={AdminSettings} />
      <Route path="/admin/users" component={AdminUsers} />

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router hook={useHashLocation}>
          <AppRouter />
        </Router>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
