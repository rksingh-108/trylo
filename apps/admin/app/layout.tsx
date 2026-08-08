import type { Metadata, Viewport } from "next";
import { themeInitScript } from "@trylo/ui";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "TRYLO Admin",
  description: "Operate the TRYLO platform — customers, drivers, rides, and payments.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FDFCFA" },
    { media: "(prefers-color-scheme: dark)", color: "#151312" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript("trylo-admin-theme") }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <div className="fixed inset-0 -z-10 bg-background">
          <div className="absolute left-1/2 top-0 h-[36rem] w-[64rem] -translate-x-1/2 rounded-full bg-primary/10 blur-[120px]" />
          <div className="absolute bottom-0 right-0 h-[28rem] w-[28rem] rounded-full bg-teal-500/5 blur-[100px]" />
        </div>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
