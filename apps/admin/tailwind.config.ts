import type { Config } from "tailwindcss";
import kineticRoutePreset from "@trylo/design-tokens/tailwind-preset";
import animate from "tailwindcss-animate";

const config: Config = {
  presets: [kineticRoutePreset as Config],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}",
  ],
  plugins: [animate],
};

export default config;
