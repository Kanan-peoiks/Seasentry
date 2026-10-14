"use client";

import Dialog, { type DialogVariant } from "./Dialog";

type Props = {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  width?: number | string;
  /** "side" (default) slides in from the right edge, "center" opens a
   * centered window and "full" covers the viewport. */
  variant?: DialogVariant;
  headerActions?: React.ReactNode;
  footer?: React.ReactNode;
};

/** Record detail shown in an accessible modal dialog. */
export default function DetailPanel({ open, title, subtitle, onClose, children, width = 440, variant = "side", headerActions, footer }: Props) {
  return (
    <Dialog open={open} title={title} subtitle={subtitle} onClose={onClose} width={width} variant={variant} headerActions={headerActions} footer={footer}>
      {children}
    </Dialog>
  );
}
