import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("three") || id.includes("@react-three")) return "vendor-three";
          if (id.includes("jspdf") || id.includes("html2canvas")) return "vendor-pdf";
          if (id.includes("@e965/xlsx")) return "vendor-xlsx";
          if (id.includes("recharts")) return "vendor-charts";
          if (id.includes("framer-motion")) return "vendor-motion";
        },
      },
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@tanstack/react-query",
      "@radix-ui/react-tooltip",
      "@radix-ui/react-select",
      "@radix-ui/react-switch",
      "@radix-ui/react-dialog",
      "@radix-ui/react-popover",
      "@radix-ui/react-toast",
    ],
  },
}));
