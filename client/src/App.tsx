import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/DashboardLayout";
import Patients from "./pages/Patients";
import Dashboard from "./pages/Dashboard";
import Events from "./pages/Events";
import Staff from "./pages/Staff";
import Alerts from "./pages/Alerts";

function Router() {
  return (
    <Switch>
      <Route path="/" component={() => <DashboardLayout><Dashboard /></DashboardLayout>} />
      <Route path="/dashboard" component={() => <DashboardLayout><Dashboard /></DashboardLayout>} />
      <Route path="/patients" component={() => <DashboardLayout><Patients /></DashboardLayout>} />
      <Route path="/staff" component={() => <DashboardLayout><Staff /></DashboardLayout>} />
      <Route path="/events" component={() => <DashboardLayout><Events /></DashboardLayout>} />
      <Route path="/alerts" component={() => <DashboardLayout><Alerts /></DashboardLayout>} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
