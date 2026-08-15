import { useState } from "react";

export interface SortState {
  key: string;
  dir: "asc" | "desc";
}

export function useSort(defaultKey: string, defaultDir: "asc" | "desc" = "desc"): { sort: SortState; toggle: (key: string) => void } {
  const [sort, setSort] = useState<SortState>({ key: defaultKey, dir: defaultDir });
  const toggle = (key: string) => {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  };
  return { sort, toggle };
}

export function sortBy<T>(list: T[], sort: SortState, value: (item: T, key: string) => string | number): T[] {
  const { key, dir } = sort;
  return [...list].sort((a, b) => {
    const va = value(a, key);
    const vb = value(b, key);
    const cmp = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb));
    return dir === "asc" ? cmp : -cmp;
  });
}
