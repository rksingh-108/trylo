import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TRYLO — Ride in minutes",
    short_name: "TRYLO",
    description: "Book bikes, autos and cabs across the city with TRYLO.",
    start_url: "/",
    display: "standalone",
    background_color: "#FDFCFA",
    theme_color: "#FF7A1A",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
