import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";

interface EvidenceContextValue {
  claimId: string | null;
  open: (id: string) => void;
  close: () => void;
}

const EvidenceContext = createContext<EvidenceContextValue | null>(null);

export function EvidenceProvider({ children }: { children: ReactNode }) {
  const [params, setParams] = useSearchParams();
  const claimId = params.get("claim");

  const open = useCallback(
    (id: string) => {
      const next = new URLSearchParams(params);
      next.set("claim", id);
      setParams(next, { replace: true });
    },
    [params, setParams]
  );

  const close = useCallback(() => {
    const next = new URLSearchParams(params);
    next.delete("claim");
    setParams(next, { replace: true });
  }, [params, setParams]);

  const value = useMemo(() => ({ claimId, open, close }), [claimId, open, close]);
  return <EvidenceContext.Provider value={value}>{children}</EvidenceContext.Provider>;
}

export function useEvidence() {
  const ctx = useContext(EvidenceContext);
  if (!ctx) throw new Error("useEvidence must be used within EvidenceProvider");
  return ctx;
}
