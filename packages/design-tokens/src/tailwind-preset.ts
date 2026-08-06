import type { Config } from "tailwindcss";
import plugin from "tailwindcss/plugin";
import { amber, teal, neutral, success, warning, danger } from "./colors";
import { fontFamily, fontSize } from "./typography";

/**
 * Shared Kinetic Route Tailwind preset. Both apps extend this in their tailwind.config.ts.
 * Semantic colors (background, primary, ring, ...) are CSS-variable driven so each app can
 * remap --primary to its own brand color (Signal Amber for customer, Transit Teal for driver)
 * without duplicating the rest of the theme. See tokens.css.
 */
const kineticRoutePreset: Partial<Config> = {
  darkMode: ["class"],
  theme: {
    extend: {
      colors: {
        amber,
        teal,
        neutral,
        dangerScale: danger,
        successScale: success,
        warningScale: warning,

        border: "hsl(var(--border) / <alpha-value>)",
        input: "hsl(var(--input) / <alpha-value>)",
        ring: "hsl(var(--ring) / <alpha-value>)",
        background: "hsl(var(--background) / <alpha-value>)",
        foreground: "hsl(var(--foreground) / <alpha-value>)",
        primary: {
          DEFAULT: "hsl(var(--primary) / <alpha-value>)",
          foreground: "hsl(var(--primary-foreground) / <alpha-value>)",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary) / <alpha-value>)",
          foreground: "hsl(var(--secondary-foreground) / <alpha-value>)",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive) / <alpha-value>)",
          foreground: "hsl(var(--destructive-foreground) / <alpha-value>)",
        },
        success: {
          DEFAULT: "hsl(var(--success) / <alpha-value>)",
          foreground: "hsl(var(--success-foreground) / <alpha-value>)",
        },
        warning: {
          DEFAULT: "hsl(var(--warning) / <alpha-value>)",
          foreground: "hsl(var(--warning-foreground) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "hsl(var(--muted) / <alpha-value>)",
          foreground: "hsl(var(--muted-foreground) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "hsl(var(--accent) / <alpha-value>)",
          foreground: "hsl(var(--accent-foreground) / <alpha-value>)",
        },
        popover: {
          DEFAULT: "hsl(var(--popover) / <alpha-value>)",
          foreground: "hsl(var(--popover-foreground) / <alpha-value>)",
        },
        card: {
          DEFAULT: "hsl(var(--card) / <alpha-value>)",
          foreground: "hsl(var(--card-foreground) / <alpha-value>)",
        },
      },
      fontFamily,
      fontSize,
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xl: "calc(var(--radius) + 6px)",
        "2xl": "calc(var(--radius) + 14px)",
      },
      boxShadow: {
        "elevation-1": "0 1px 2px -1px hsl(var(--shadow-color) / 0.06), 0 1px 3px hsl(var(--shadow-color) / 0.08)",
        "elevation-2": "0 2px 6px -2px hsl(var(--shadow-color) / 0.1), 0 6px 16px -4px hsl(var(--shadow-color) / 0.1)",
        "elevation-3": "0 8px 24px -6px hsl(var(--shadow-color) / 0.16), 0 2px 8px -2px hsl(var(--shadow-color) / 0.08)",
        "elevation-4": "0 16px 48px -12px hsl(var(--shadow-color) / 0.28), 0 4px 12px -2px hsl(var(--shadow-color) / 0.1)",
        glow: "0 8px 24px -6px hsl(var(--shadow-tint) / 0.45)",
        "glow-sm": "0 4px 14px -4px hsl(var(--shadow-tint) / 0.4)",
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "pulse-ring": {
          "0%": { transform: "scale(0.8)", opacity: "0.8" },
          "80%": { transform: "scale(1.8)", opacity: "0" },
          "100%": { transform: "scale(1.8)", opacity: "0" },
        },
        "route-dash": {
          to: { strokeDashoffset: "0" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.94)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "pulse-ring": "pulse-ring 1.8s cubic-bezier(0.4, 0, 0.2, 1) infinite",
        "route-dash": "route-dash 1.2s linear forwards",
        shimmer: "shimmer 1.8s ease-in-out infinite",
        "fade-in": "fade-in 0.28s ease-out",
        "slide-up": "slide-up 0.32s cubic-bezier(0, 0, 0.2, 1)",
        "scale-in": "scale-in 0.22s cubic-bezier(0.34, 1.56, 0.64, 1)",
        float: "float 3.4s ease-in-out infinite",
      },
    },
  },
  plugins: [
    plugin(({ addUtilities, matchUtilities, theme }) => {
      addUtilities({
        ".glass": {
          backgroundColor: "hsl(var(--glass-bg) / var(--glass-bg-alpha))",
          backdropFilter: "blur(20px) saturate(1.4)",
          WebkitBackdropFilter: "blur(20px) saturate(1.4)",
          border: "1px solid hsl(var(--border) / var(--glass-border-alpha))",
        },
        ".glass-strong": {
          backgroundColor: "hsl(var(--glass-bg) / 0.88)",
          backdropFilter: "blur(28px) saturate(1.5)",
          WebkitBackdropFilter: "blur(28px) saturate(1.5)",
          border: "1px solid hsl(var(--border) / var(--glass-border-alpha))",
        },
        ".text-balance": { textWrap: "balance" },
        ".no-scrollbar": {
          scrollbarWidth: "none",
          "&::-webkit-scrollbar": { display: "none" },
        },
      });
      matchUtilities(
        {
          "bg-shimmer": (_value) => ({
            backgroundImage:
              "linear-gradient(90deg, transparent, hsl(var(--foreground) / 0.06), transparent)",
            backgroundSize: "200% 100%",
          }),
        },
        { values: { DEFAULT: "" } }
      );
      void theme;
    }),
  ],
};

export default kineticRoutePreset;
