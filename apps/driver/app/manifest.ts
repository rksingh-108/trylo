import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TRYLO Driver",
    short_name: "TRYLO Driver",
    description: "Go online, accept rides, and track your earnings with TRYLO.",
    start_url: "/",
    display: "standalone",
    background_color: "#FDFCFA",
    theme_color: "#0C7A70",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
