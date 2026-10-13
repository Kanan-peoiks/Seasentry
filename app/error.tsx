"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw } from "lucide-react";
import Button from "@/components/ui/Button";
import { useLanguage } from "@/lib/useLanguage";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { lang } = useLanguage();
  useEffect(() => {
    console.error(error);
  }, [error]);

  const az = lang === "az";
  return (
    <div className="session-gate error-page" role="alert">
      <AlertTriangle size={28} aria-hidden="true" />
      <h1>{az ? "Gözlənilməz xəta baş verdi" : "Something went wrong"}</h1>
      <p>{az ? "SeaSentry-nin bu bölməsində xəta oldu. Yenidən cəhd edin və ya idarə panelinə qayıdın." : "This section of SeaSentry hit an unexpected error. Try again, or go back to the dashboard."}</p>
      <div className="error-actions">
        <Button variant="primary" onClick={reset}><RotateCcw size={16} aria-hidden="true" />{az ? "Yenidən cəhd et" : "Try again"}</Button>
        <Link className="ui-button" href="/dashboard">{az ? "İdarə panelinə qayıt" : "Back to dashboard"}</Link>
      </div>
    </div>
  );
}
