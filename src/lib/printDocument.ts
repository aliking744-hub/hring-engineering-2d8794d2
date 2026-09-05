const waitForImages = (root: ParentNode) =>
  Promise.all(
    Array.from(root.querySelectorAll<HTMLImageElement>("img")).map((image) => {
      if (image.complete) return Promise.resolve();
      return new Promise<void>((resolve) => {
        image.addEventListener("load", () => resolve(), { once: true });
        image.addEventListener("error", () => resolve(), { once: true });
      });
    }),
  );

export const waitForPrintableAssets = async (root: ParentNode = document) => {
  if (document.fonts) await document.fonts.ready;
  await waitForImages(root);
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
};
