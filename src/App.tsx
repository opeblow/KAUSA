import { Navigate, Route, Routes } from "react-router-dom";
import { useConvexAuth } from "@convex-dev/auth/react";
import { Loader2 } from "lucide-react";
import { InvestigationProvider } from "@/store/investigation";
import { EvidenceProvider } from "@/store/evidence";
import { EvidencePanel } from "@/components/EvidencePanel";
import { AppShell } from "@/components/layout/AppShell";
import { Landing } from "@/pages/Landing";
import { SignIn } from "@/pages/SignIn";
import { Workspace } from "@/pages/Workspace";
import { Overview } from "@/pages/Overview";
import { Ask } from "@/pages/Ask";
import { Investigation } from "@/pages/Investigation";
import { Verdict } from "@/pages/Verdict";
import { Missions } from "@/pages/Missions";
import { Methodology } from "@/pages/Methodology";
import { Memory } from "@/pages/Memory";
import { ErrorScreen } from "@/pages/ErrorScreen";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-base-950">
        <Loader2 className="size-5 animate-spin text-accent" />
      </div>
    );
  }
  if (!isAuthenticated) return <Navigate to="/signin" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <InvestigationProvider>
      <EvidenceProvider>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/signin" element={<SignIn />} />
          <Route
            path="/app"
            element={
              <RequireAuth>
                <AppShell />
              </RequireAuth>
            }
          >
            <Route index element={<Navigate to="/app/workspace" replace />} />
            <Route path="workspace" element={<Workspace />} />
            <Route path="overview" element={<Overview />} />
            <Route path="ask" element={<Ask />} />
            <Route path="investigation" element={<Investigation />} />
            <Route path="verdict" element={<Verdict />} />
            <Route path="missions" element={<Missions />} />
            <Route path="memory" element={<Memory />} />
            <Route path="methodology" element={<Methodology />} />
          </Route>
          <Route path="*" element={<ErrorScreen variant="notFound" />} />
        </Routes>
        <EvidencePanel />
      </EvidenceProvider>
    </InvestigationProvider>
  );
}
