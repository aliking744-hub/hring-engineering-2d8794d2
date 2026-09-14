import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { waitForPrintableAssets } from "@/lib/printDocument";

interface ExportPdfOptions {
  filename: string;
  marginMm?: number;
}

interface ExportTextPdfOptions extends ExportPdfOptions {
  title: string;
  content: string;
}

interface PageSlice {
  sourceY: number;
  height: number;
}

const PDF_STYLES = `
  .pdf-export-root, .pdf-export-root * {
    box-sizing: border-box !important;
    color: #111827 !important;
    border-color: #d1d5db !important;
    text-shadow: none !important;
  }
  .pdf-export-root {
    direction: rtl !important;
    font-family: Vazirmatn, IRANSans, Tahoma, sans-serif !important;
    line-height: 1.8 !important;
    width: 900px !important;
    max-width: 900px !important;
    height: auto !important;
    max-height: none !important;
    overflow: visible !important;
    padding: 28px !important;
    background: #ffffff !important;
  }
  .pdf-export-root .no-print,
  .pdf-export-root button,
  .pdf-export-root textarea {
    display: none !important;
  }
  .pdf-export-root [class*="bg-"],
  .pdf-export-root [class*="glass"] {
    background: #ffffff !important;
    box-shadow: none !important;
  }
  .pdf-export-root [class*="text-muted"] {
    color: #4b5563 !important;
  }
  .pdf-export-root h1,
  .pdf-export-root h2,
  .pdf-export-root h3,
  .pdf-export-root h4 {
    color: #0f3d75 !important;
    break-after: avoid-page;
    page-break-after: avoid;
  }
  .pdf-export-root p,
  .pdf-export-root li,
  .pdf-export-root tr,
  .pdf-export-root table,
  .pdf-export-root section,
  .pdf-export-root [data-pdf-block],
  .pdf-export-root [class*="rounded"] {
    break-inside: avoid-page;
    page-break-inside: avoid;
  }
  .pdf-text-document h1 {
    margin: 0 0 8px;
    font-size: 28px;
  }
  .pdf-text-document .pdf-date {
    margin: 0 0 20px;
    color: #4b5563 !important;
  }
  .pdf-text-document h2,
  .pdf-text-document h3 {
    margin: 18px 0 8px;
  }
  .pdf-text-document p {
    margin: 0 0 10px;
    white-space: pre-wrap;
  }
`;

export function calculatePageSlices(
  totalHeight: number,
  pageHeight: number,
  semanticBoundaries: number[],
): PageSlice[] {
  if (totalHeight <= 0 || pageHeight <= 0) return [];

  const boundaries = Array.from(
    new Set(
      semanticBoundaries
        .map((value) => Math.round(value))
        .filter((value) => value > 0 && value < totalHeight),
    ),
  ).sort((left, right) => left - right);

  const slices: PageSlice[] = [];
  let sourceY = 0;
  while (sourceY < totalHeight) {
    const target = Math.min(sourceY + pageHeight, totalHeight);
    if (target === totalHeight) {
      slices.push({ sourceY, height: totalHeight - sourceY });
      break;
    }

    const minimumUsefulBreak = sourceY + pageHeight * 0.55;
    const candidates = boundaries.filter(
      (value) => value >= minimumUsefulBreak && value <= target,
    );
    const breakAt = candidates.at(-1) ?? target;
    const safeBreak = breakAt > sourceY ? breakAt : target;
    slices.push({ sourceY, height: safeBreak - sourceY });
    sourceY = safeBreak;
  }
  return slices;
}

function semanticBoundaries(root: HTMLElement, canvasHeight: number): number[] {
  const rootRect = root.getBoundingClientRect();
  const renderedHeight = Math.max(root.scrollHeight, rootRect.height, 1);
  const scale = canvasHeight / renderedHeight;
  const boundaries: number[] = [];

  root
    .querySelectorAll<HTMLElement>(
      "h1,h2,h3,h4,p,li,tr,table,section,[data-pdf-block],[class*='rounded']",
    )
    .forEach((node) => {
      const rect = node.getBoundingClientRect();
      const top = (rect.top - rootRect.top) * scale;
      const bottom = (rect.bottom - rootRect.top) * scale;
      if (top > 0) boundaries.push(top);
      if (bottom > 0) boundaries.push(bottom);
    });

  return boundaries;
}

function createPrintableClone(element: HTMLElement): {
  host: HTMLDivElement;
  clone: HTMLElement;
  style: HTMLStyleElement;
} {
  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.style.position = "absolute";
  host.style.left = "-10000px";
  host.style.top = "0";
  host.style.width = "900px";
  host.style.background = "#ffffff";
  host.style.pointerEvents = "none";

  const clone = element.cloneNode(true) as HTMLElement;
  clone.classList.add("pdf-export-root");
  clone.setAttribute("dir", "rtl");
  host.appendChild(clone);

  const style = document.createElement("style");
  style.dataset.pdfExportStyle = "true";
  style.textContent = PDF_STYLES;
  document.head.appendChild(style);
  document.body.appendChild(host);

  return { host, clone, style };
}

/**
 * Export a Persian/RTL result as an A4 PDF without cutting ordinary text,
 * headings, list items or table rows at fixed page boundaries.
 */
export async function exportElementToPdf(
  element: HTMLElement,
  { filename, marginMm = 12 }: ExportPdfOptions,
): Promise<void> {
  const { host, clone, style } = createPrintableClone(element);

  try {
    await waitForPrintableAssets(clone);

    const canvas = await html2canvas(clone, {
      scale: Math.max(2, window.devicePixelRatio || 1),
      useCORS: true,
      allowTaint: false,
      logging: false,
      backgroundColor: "#ffffff",
      scrollX: 0,
      scrollY: 0,
    });

    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageWidthMm = 210;
    const pageHeightMm = 297;
    const contentWidthMm = pageWidthMm - marginMm * 2;
    const contentHeightMm = pageHeightMm - marginMm * 2;
    const pixelsPerMm = canvas.width / contentWidthMm;
    const pageHeightPx = Math.floor(contentHeightMm * pixelsPerMm);
    const slices = calculatePageSlices(
      canvas.height,
      pageHeightPx,
      semanticBoundaries(clone, canvas.height),
    );

    slices.forEach((pageSlice, pageIndex) => {
      if (pageIndex > 0) pdf.addPage();

      const slice = document.createElement("canvas");
      slice.width = canvas.width;
      slice.height = pageSlice.height;
      const context = slice.getContext("2d");
      if (!context) throw new Error("PDF canvas is not available");

      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, slice.width, slice.height);
      context.drawImage(
        canvas,
        0,
        pageSlice.sourceY,
        canvas.width,
        pageSlice.height,
        0,
        0,
        canvas.width,
        pageSlice.height,
      );

      pdf.addImage(
        slice.toDataURL("image/jpeg", 0.94),
        "JPEG",
        marginMm,
        marginMm,
        contentWidthMm,
        pageSlice.height / pixelsPerMm,
        undefined,
        "FAST",
      );
      pdf.setFontSize(8);
      pdf.setTextColor(107, 114, 128);
      pdf.text(
        `${pageIndex + 1} / ${slices.length}`,
        pageWidthMm / 2,
        pageHeightMm - 5,
        { align: "center" },
      );
    });

    pdf.save(filename);
  } finally {
    host.remove();
    style.remove();
  }
}

export async function exportTextToPdf({
  title,
  content,
  filename,
  marginMm,
}: ExportTextPdfOptions): Promise<void> {
  const article = document.createElement("article");
  article.className = "pdf-text-document";
  article.setAttribute("dir", "rtl");

  const heading = document.createElement("h1");
  heading.textContent = title;
  article.appendChild(heading);

  const date = document.createElement("p");
  date.className = "pdf-date";
  date.textContent = `تاریخ: ${new Date().toLocaleDateString("fa-IR")}`;
  article.appendChild(date);

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const headingMatch = /^(#{1,3})\s+(.+)$/.exec(line);
    const node = document.createElement(headingMatch ? "h2" : "p");
    node.textContent = headingMatch ? headingMatch[2] : line;
    node.dataset.pdfBlock = "true";
    article.appendChild(node);
  }

  await exportElementToPdf(article, { filename, marginMm });
}
