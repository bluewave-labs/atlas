import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export interface BreadcrumbItem {
  label: string;
  to?: string;
}

interface BreadcrumbContextValue {
  crumbs: BreadcrumbItem[] | null;
  setCrumbs: (c: BreadcrumbItem[] | null) => void;
}

const BreadcrumbContext = createContext<BreadcrumbContextValue>({
  crumbs: null,
  setCrumbs: () => {},
});

export function BreadcrumbProvider({ children }: { children: ReactNode }) {
  const [crumbs, setCrumbs] = useState<BreadcrumbItem[] | null>(null);
  return (
    <BreadcrumbContext.Provider value={{ crumbs, setCrumbs }}>
      {children}
    </BreadcrumbContext.Provider>
  );
}

export function useBreadcrumb(crumbs: BreadcrumbItem[] | null) {
  const { setCrumbs } = useContext(BreadcrumbContext);
  const key = crumbs ? JSON.stringify(crumbs) : 'null';
  useEffect(() => {
    setCrumbs(crumbs);
    return () => setCrumbs(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}

export function useBreadcrumbValue(): BreadcrumbItem[] | null {
  return useContext(BreadcrumbContext).crumbs;
}
