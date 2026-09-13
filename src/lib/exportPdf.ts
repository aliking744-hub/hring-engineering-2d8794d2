import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { waitForPrintableAssets } from "@/lib/printDocument";

interface ExportPdfOptions {
  filename: string;
  marginMm?: number;
}

/**
 * Export a Persian/RTL result as a print-ready A4 PDF.
 *
 * jsPDF.html() reflows RTL text and frequently loses Persian fonts. We first
 * render the existing, fully-shaped browser layout to a high-resolution canvas
 * and then paginate that image. This keeps Persian glyphs, tables, spacing and
 * brand typography exactly as the user sees them.
 */
export async function exportElementToPdf(
  element: HTMLElement,
  { filename, marginMm = 12 }: ExportPdfOptions,
): Promise<void> {
  await waitForPrintableAssets(element);

  const marker = `pdf-${crypto.randomUUID()}`;
  element.dataset.pdfSource = marker;

  try {
    const canvas = await html2canvas(element, {
      scale: Math.max(2, window.devicePixelRatio || 1),
      useCORS: true,
      allowTaint: false,
      logging: false,
      backgroundColor: "#ffffff",
      scrollX: 0,
      scrollY: -window.scrollY,
      onclone: (documentClone) => {
        const clone = documentClone.querySelector<HTMLElement>(
          `[data-pdf-source="${marker}"]`,
        );
        if (!clone) return;

        clone.classList.add("pdf-export-root");
        clone.setAttribute("dir", "rtl");
        clone.style.background = "#ffffff";
        clone.style.color = "#111827";
        clone.style.width = "900px";
        clone.style.maxWidth = "900px";
        clone.style.height = "auto";
        clone.style.maxHeight = "none";
        clone.style.overflow = "visible";

        const style = documentClone.createElement("style");
        style.textContent = `
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
            padding: 28px !important;
          }
          .pdf-export-root .no-print,
          .pdf-export-root button {
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
          }
          .pdf-export-root p,
          .pdf-export-root li,
          .pdf-export-root tr,
          .pdf-export-root [class*="rounded"] {
            break-inside: avoid-page;
          }
          .pdf-export-root textarea {
            display: none !important;
          }
        `;
        documentClone.head.appendChild(style);
      },
    });

    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageWidthMm = 210;
    const pageHeightMm = 297;
    const contentWidthMm = pageWidthMm - marginMm * 2;
    const contentHeightMm = pageHeightMm - marginMm * 2;
    const pixelsPerMm = canvas.width / contentWidthMm;
    const pageHeightPx = Math.floor(contentHeightMm * pixelsPerMm);
    const totalPages = Math.max(1, Math.ceil(canvas.height / pageHeightPx));

    for (let page = 0; page < totalPages; page += 1) {
      if (page > 0) pdf.addPage();

      const sourceY = page * pageHeightPx;
      const sliceHeight = Math.min(pageHeightPx, canvas.height - sourceY);
      const slice = document.createElement("canvas");
      slice.width = canvas.width;
      slice.height = sliceHeight;
      const context = slice.getContext("2d");
      if (!context) throw new Error("PDF canvas is not available");

      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, slice.width, slice.height);
      context.drawImage(
        canvas,
        0,
        sourceY,
        canvas.width,
        sliceHeight,
        0,
        0,
        canvas.width,
        sliceHeight,
      );

      const renderedHeightMm = sliceHeight / pixelsPerMm;
      pdf.addImage(
        slice.toDataURL("image/jpeg", 0.94),
        "JPEG",
        marginMm,
        marginMm,
        contentWidthMm,
        renderedHeightMm,
        undefined,
        "FAST",
      );
      pdf.setFontSize(8);
      pdf.setTextColor(107, 114, 128);
      pdf.text(`${page + 1} / ${totalPages}`, pageWidthMm / 2, pageHeightMm - 5, {
        align: "center",
      });
    }

    pdf.save(filename);
  } finally {
    delete element.dataset.pdfSource;
  }
}
