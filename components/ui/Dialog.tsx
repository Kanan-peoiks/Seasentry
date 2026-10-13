"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useLanguage } from "@/lib/useLanguage";

export type DialogVariant = "side" | "center" | "full" | "drawer";

type Props = {
  open: boolean;
  title: ReactNode;
  /** Plain-text name for screen readers when `title` is not plain text. */
  label?: string;
  subtitle?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  variant?: DialogVariant;
  /** Max width of side/center dialogs, e.g. 440 or "min(720px, 100%)". */
  width?: number | string;
  headerActions?: ReactNode;
};

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
let openDialogs = 0;

/** Modal dialog with Escape, focus trap, focus return, inert background and
 * body scroll lock. Content is portalled to <body>, so it is only mounted
 * while open. */
export default function Dialog({ open, title, label, subtitle, onClose, children, footer, variant = "side", width, headerActions }: Props) {
  const { t } = useLanguage();
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const [host, setHost] = useState<HTMLElement | null>(null);

  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const node = document.createElement("div");
    node.className = "ui-dialog-host";
    document.body.appendChild(node);
    // Mounting the portal target is the external-system sync this effect exists for.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHost(node);
    return () => {
      node.remove();
      setHost(null);
    };
  }, [open]);

  useEffect(() => {
    if (!open || !host) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const siblings = Array.from(document.body.children).filter((el) => el !== host && !el.classList.contains("ui-dialog-host") && !el.hasAttribute("inert")) as HTMLElement[];
    siblings.forEach((el) => el.setAttribute("inert", ""));
    openDialogs += 1;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const panel = panelRef.current;
    const first = panel?.querySelector<HTMLElement>("[data-autofocus]") ?? panel;
    first?.focus({ preventScroll: true });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (!items.length) {
        event.preventDefault();
        panel.focus();
        return;
      }
      const firstItem = items[0];
      const lastItem = items[items.length - 1];
      if (event.shiftKey && (document.activeElement === firstItem || document.activeElement === panel)) {
        event.preventDefault();
        lastItem.focus();
      } else if (!event.shiftKey && document.activeElement === lastItem) {
        event.preventDefault();
        firstItem.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown, true);

    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      siblings.forEach((el) => el.removeAttribute("inert"));
      openDialogs -= 1;
      if (openDialogs === 0) document.body.style.overflow = previousOverflow;
      if (previouslyFocused?.isConnected) previouslyFocused.focus({ preventScroll: true });
    };
  }, [open, host]);

  if (!open || !host) return null;

  return createPortal(
    <div className={`ui-dialog ui-dialog--${variant}`}>
      <div className="ui-dialog-backdrop" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={label ? undefined : titleId}
        aria-label={label}
        tabIndex={-1}
        className="ui-dialog-panel"
        style={width !== undefined && variant !== "full" ? { width: typeof width === "number" ? `${width}px` : width } : undefined}
      >
        <header className="ui-dialog-header">
          <div className="ui-dialog-heading">
            <h2 id={titleId}>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <div className="ui-dialog-actions">
            {headerActions}
            <button type="button" className="ui-icon-button" onClick={onClose} aria-label={t.common.close}>
              <X size={18} aria-hidden="true" />
            </button>
          </div>
        </header>
        <div className="ui-dialog-body">{children}</div>
        {footer && <footer className="ui-dialog-footer">{footer}</footer>}
      </div>
    </div>,
    host
  );
}
