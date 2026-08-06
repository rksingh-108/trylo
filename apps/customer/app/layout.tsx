import type { Metadata, Viewport } from "next";
import { themeInitScript } from "@trylo/ui";
import { Providers } from "./providers";
import { BottomNav } from "@/components/bottom-nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "TRYLO — Ride in minutes",
  description: "Book bikes, autos and cabs across the city with TRYLO.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "TRYLO",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FDFCFA" },
    { media: "(prefers-color-scheme: dark)", color: "#151312" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript("trylo-theme") }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <div className="fixed inset-0 -z-10 bg-background">
          <div className="absolute left-1/2 top-0 h-[36rem] w-[64rem] -translate-x-1/2 rounded-full bg-amber-500/10 blur-[120px]" />
          <div className="absolute bottom-0 right-0 h-[28rem] w-[28rem] rounded-full bg-teal-500/5 blur-[100px]" />
        </div>
        <Providers>
          <div className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col bg-background sm:my-4 sm:min-h-[calc(100dvh-2rem)] sm:overflow-hidden sm:rounded-[2rem] sm:border sm:border-border sm:shadow-elevation-4">
            <div className="flex flex-1 flex-col overflow-y-auto">{children}</div>
            <BottomNav />
          </div>
        </Providers>
      </body>
    </html>
  );
}
