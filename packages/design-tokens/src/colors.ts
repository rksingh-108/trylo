/**
 * Kinetic Route palette.
 * `amber` = Signal Amber (customer primary — action/urgency)
 * `teal`  = Transit Teal (driver primary — operational/on-duty)
 * `neutral` spans Chalk (lightest) → Ink (darkest), shared background/text scale
 */

export const amber = {
  50: "#FFF6EC",
  100: "#FFE9D1",
  200: "#FFD1A3",
  300: "#FFB56E",
  400: "#FF9A42",
  500: "#FF7A1A",
  600: "#F06000",
  700: "#C74B00",
  800: "#9F3B02",
  900: "#7A2F07",
  950: "#431705",
} as const;

export const teal = {
  50: "#EBFBF8",
  100: "#CDF4ED",
  200: "#9AE8DC",
  300: "#62D5C5",
  400: "#34B7A7",
  500: "#16988A",
  600: "#0C7A70",
  700: "#0A625A",
  800: "#0B4E48",
  900: "#0B403C",
  950: "#042523",
} as const;

export const neutral = {
  50: "#FDFCFA", // Chalk — app background
  100: "#F7F4EE",
  200: "#EDE8DF",
  300: "#DCD5C8",
  400: "#B0ACA5",
  500: "#86807A",
  600: "#635D57",
  700: "#4A4540",
  800: "#3A3632",
  900: "#2A2724",
  950: "#121110", // Ink — primary text
} as const;

export const success = {
  50: "#ECFDF3",
  500: "#12A150",
  700: "#0A6E37",
} as const;

export const warning = {
  50: "#FFFBEB",
  500: "#E8A317",
  700: "#95650B",
} as const;

export const danger = {
  50: "#FEF2F2",
  500: "#E53E3E",
  700: "#A32424",
} as const;

export const colors = { amber, teal, neutral, success, warning, danger } as const;
