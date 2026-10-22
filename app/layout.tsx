import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/AuthProvider";
import { RegisterServiceWorker } from "@/components/RegisterServiceWorker";

export const metadata: Metadata = {
  title: "Kem.Bali",
  description: "Rencanain bareng, biar Kem.Bali lagi.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Kem.Bali",
  },
};

export const viewport: Viewport = {
  themeColor: "#1e3a2a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className="h-full antialiased">
      <head>
        {/* Loaded as a plain <link>, not next/font, so it resolves in the browser at
            runtime instead of needing network access during the Next.js build. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full bg-kb-bg text-kb-ink">
        <AuthProvider>
          <RegisterServiceWorker />
          <div className="app-shell">{children}</div>
        </AuthProvider>
      </body>
    </html>
  );
}
