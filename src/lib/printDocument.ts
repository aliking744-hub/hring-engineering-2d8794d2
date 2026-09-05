const waitForImages = (document: Document) =>
  Promise.all(
    Array.from(document.images).map((image) => {
      if (image.complete) return Promise.resolve();
      return new Promise<void>((resolve) => {
        image.addEventListener("load", () => resolve(), { once: true });
        image.addEventListener("error", () => resolve(), { once: true });
      });
    }),
  );

export const escapePrintHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const readyToPrint = async (target: Window) => {
  const fonts = target.document.fonts;
  if (fonts) await fonts.ready;
  await waitForImages(target.document);
  await new Promise<void>((resolve) => target.requestAnimationFrame(() => resolve()));
};

export const openPrintDocument = async (html: string) => {
  const target = window.open("", "_blank");
  if (!target) throw new Error("مرورگر پنجره چاپ را مسدود کرده است");
  target.document.open();
  target.document.write(html);
  target.document.close();
  await readyToPrint(target);
  target.focus();
  target.print();
};

export const printCurrentDocument = async () => {
  await readyToPrint(window);
  window.print();
};
