"use client";

import { Database, LoaderCircle, RotateCcw } from "lucide-react";
import Button from "./Button";
import { useLanguage } from "@/lib/useLanguage";

export default function DataState({ loading, error, empty, onRetry, children }: { loading?: boolean; error?: string | null; empty?: boolean; onRetry?: () => void; children?: React.ReactNode }) {
  const { lang } = useLanguage();
  if (!loading && !error && !empty) return children;
  return <div className="data-state" role={error ? "alert" : "status"} aria-busy={loading || undefined}>
    {loading ? <LoaderCircle size={25} className="spinner" aria-hidden="true" /> : <Database size={25} aria-hidden="true" />}
    <h2>{loading ? (lang === "az" ? "Məlumat yüklənir…" : "Loading data…") : error ? (lang === "az" ? "Məlumatı yükləmək mümkün olmadı" : "Could not load data") : (lang === "az" ? "Hələ məlumat yoxdur" : "No records yet")}</h2>
    <p>{error || (loading ? (lang === "az" ? "Xidmət ilk sorğuda bir qədər gec açıla bilər." : "The service may take a moment to wake up.") : (lang === "az" ? "Yeni qeydlər burada görünəcək." : "New records will appear here."))}</p>
    {error && onRetry && <Button onClick={onRetry}><RotateCcw size={15} aria-hidden="true" />{lang === "az" ? "Yenidən cəhd et" : "Try again"}</Button>}
  </div>;
}
