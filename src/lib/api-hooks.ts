"use client";

import { useState, useEffect, useCallback } from "react";
import { useAppStore } from "@/lib/store";

export function useFetch<T>(url: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(!!url);
  const [error, setError] = useState<string | null>(null);
  const refreshKey = useAppStore((s) => s.refreshKey);

  const reload = useCallback(async () => {
    if (!url) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json.data ?? json);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    reload();
  }, [reload, refreshKey]);

  return { data, loading, error, reload };
}

export async function apiPost(url: string, body: any, method = "POST") {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Erro na requisição");
  return json;
}

export async function apiDelete(url: string) {
  const res = await fetch(url, { method: "DELETE" });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Erro ao excluir");
  return json;
}

export const useRefresh = () => {
  const trigger = useAppStore((s) => s.triggerRefresh);
  return trigger;
};
