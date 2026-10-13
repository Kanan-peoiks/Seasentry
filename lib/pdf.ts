// ============================================================
// Shared PDF writer. Embeds the local IBM Plex Sans files so
// Azerbaijani letters (ə, ğ, ı, ş, ç, ö, ü, İ) render correctly —
// jsPDF's built-in Helvetica has no glyphs for most of them.
// ============================================================

import { jsPDF } from "jspdf";

const FONT = "IBMPlexSans";
let fontsPromise: Promise<{ regular: string; semibold: string }> | null = null;

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

function loadFonts() {
  fontsPromise ??= Promise.all(
    ["/fonts/IBMPlexSans-Regular.ttf", "/fonts/IBMPlexSans-SemiBold.ttf"].map(async (url) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Font ${url} failed (${res.status})`);
      return toBase64(await res.arrayBuffer());
    })
  )
    .then(([regular, semibold]) => ({ regular, semibold }))
    .catch((error) => {
      fontsPromise = null;
      throw error;
    });
  return fontsPromise;
}

const MARGIN = 16;
const WIDTH = 210 - MARGIN * 2;
const BOTTOM = 280;

export type PdfWriter = {
  doc: jsPDF;
  title: (text: string, subtitle?: string) => void;
  heading: (text: string) => void;
  /** Label and value on one line, wrapping the value. */
  field: (label: string, value: string) => void;
  paragraph: (text: string, size?: number, muted?: boolean) => void;
  image: (base64Png: string, caption: string, sizeMm?: number) => void;
  gap: (mm: number) => void;
  save: (fileName: string, footer: string) => void;
};

export async function createPdf(): Promise<PdfWriter> {
  const fonts = await loadFonts();
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  doc.addFileToVFS(`${FONT}-Regular.ttf`, fonts.regular);
  doc.addFont(`${FONT}-Regular.ttf`, FONT, "normal");
  doc.addFileToVFS(`${FONT}-SemiBold.ttf`, fonts.semibold);
  doc.addFont(`${FONT}-SemiBold.ttf`, FONT, "bold");
  doc.setFont(FONT, "normal");
  doc.setTextColor(22, 49, 71);

  let y = 20;
  const ensure = (needed: number) => {
    if (y + needed > BOTTOM) {
      doc.addPage();
      y = 20;
    }
  };
  const text = (value: string, size: number, bold: boolean, color: [number, number, number] = [22, 49, 71]) => {
    doc.setFont(FONT, bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(value, WIDTH) as string[];
    const lineHeight = size * 0.45;
    lines.forEach((line) => {
      ensure(lineHeight);
      doc.text(line, MARGIN, y);
      y += lineHeight;
    });
  };

  return {
    doc,
    title: (value, subtitle) => {
      text(value, 18, true);
      if (subtitle) {
        y += 1;
        text(subtitle, 10, false, [82, 103, 120]);
      }
      y += 3;
      doc.setDrawColor(214, 226, 232);
      doc.line(MARGIN, y, MARGIN + WIDTH, y);
      y += 7;
    },
    heading: (value) => {
      ensure(16);
      y += 3;
      text(value, 13, true, [8, 127, 122]);
      y += 1.5;
    },
    field: (label, value) => {
      ensure(7);
      doc.setFont(FONT, "bold");
      doc.setFontSize(10);
      doc.setTextColor(82, 103, 120);
      doc.text(label, MARGIN, y);
      doc.setFont(FONT, "normal");
      doc.setTextColor(22, 49, 71);
      const lines = doc.splitTextToSize(value || "—", WIDTH - 58) as string[];
      lines.forEach((line, i) => {
        if (i > 0) ensure(5);
        doc.text(line, MARGIN + 58, y);
        y += 5;
      });
      y += 0.8;
    },
    paragraph: (value, size = 10, muted = false) => {
      text(value, size, false, muted ? [82, 103, 120] : [22, 49, 71]);
      y += 1.5;
    },
    image: (base64Png, caption, sizeMm = 80) => {
      ensure(sizeMm + 8);
      try {
        doc.addImage(`data:image/png;base64,${base64Png}`, "PNG", MARGIN, y, sizeMm, sizeMm);
        y += sizeMm + 4;
        text(caption, 8, false, [82, 103, 120]);
        y += 2;
      } catch {
        text(`[${caption}]`, 9, false, [82, 103, 120]);
      }
    },
    gap: (mm) => { y += mm; },
    save: (fileName, footer) => {
      const pages = doc.getNumberOfPages();
      for (let p = 1; p <= pages; p++) {
        doc.setPage(p);
        doc.setFont(FONT, "normal");
        doc.setFontSize(8);
        doc.setTextColor(82, 103, 120);
        doc.text(doc.splitTextToSize(footer, WIDTH - 20) as string[], MARGIN, 289);
        doc.text(`${p}/${pages}`, MARGIN + WIDTH, 289, { align: "right" });
      }
      doc.save(fileName);
    },
  };
}
