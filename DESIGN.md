# TRYLO — Design System

*"Kinetic Route"* — the visual language shared by all three TRYLO apps, defined
once in `packages/design-tokens` and `packages/ui`, then themed per-app. This
document describes the design decisions; for product scope see
[`PRD.md`](PRD.md), for technical architecture see [`ARCHITECTURE.md`](ARCHITECTURE.md).

---

## 1. Design Philosophy

TRYLO is built around **motion as feedback**, not decoration: a live map
marker that glides and rotates instead of snapping, sheets that spring open,
counters that animate toward their new value. The name "Kinetic Route" reflects
that — the product's core moment is *something moving toward you on a map*, and
the UI is built to make that feel alive rather than like a static dashboard
that happens to poll.

Three principles guide every screen:

1. **One primary color per app, everything else shared.** Customer, Driver,
   and Admin are visually distinct at a glance (see §2) but share every other
   token — spacing, type, radius, motion curves — so they still feel like one
   product family, not three unrelated apps.
2. **Status is always legible.** Ride state, verification state, payment
   state — every state that matters to the user gets a consistent visual
   treatment (`StatusPill`), not ad-hoc colored text.
3. **Honest, not decorative, animation.** Motion durations and easings are a
   fixed, small vocabulary (§5) reused everywhere — nothing bespoke per screen.

---

## 2. Color System

### Brand palette (`packages/design-tokens/src/colors.ts`)

| Scale | Name | Used for |
|---|---|---|
| **Amber** (`#FFF6EC` → `#431705`) | Signal Amber | Customer app's primary — action/urgency |
| **Teal** (`#EBFBF8` → `#042523`) | Transit Teal | Driver app's primary — operational/on-duty |
| **Neutral** (`#FDFCFA` Chalk → `#121110` Ink) | — | Shared background/text/border scale across all three apps |
| Success / Warning / Danger | — | Semantic states (payment succeeded, low balance, cancellation, etc.) — shared across all apps |

### Per-app primary mapping

Each app declares its own `--primary` in its `globals.css`, layered on top of
the shared `tokens.css` base:

| App | Primary | HSL | Rationale |
|---|---|---|---|
| Customer | Signal Amber | `25 100% 55%` | Warm, action-oriented — booking a ride is an active choice |
| Driver | Transit Teal | `175 82% 26%` | Cooler, operational — the driver's screen is a workspace, not a storefront |
| Admin | Indigo | `231 48% 40%` | Deliberately outside the amber/teal pair — signals "this is the ops surface," not a rider- or driver-facing brand moment |

### Semantic tokens

All components consume **CSS variables**, not raw hex — `--background`,
`--foreground`, `--card`, `--muted`, `--accent`, `--border`, `--destructive`,
`--success`, `--warning`, `--ring`, plus elevation-specific tokens
(`--shadow-color`, `--shadow-tint`, `--glass-bg`, `--glass-bg-alpha`,
`--scrim`) that shift meaningfully between light and dark rather than just
inverting. This is what lets a single component (e.g. `Card`, `Button`) work
correctly in both themes and across all three apps without per-app overrides.

---

## 3. Typography

| Role | Typeface | Used for |
|---|---|---|
| Display | **Space Grotesk** | Headings, fares, large numbers — anything that should feel like a statement |
| Body | **Inter** | Everything else — UI copy, labels, form fields |
| Mono | **JetBrains Mono** | OTPs, vehicle registration numbers, ride/transaction IDs — anything that benefits from fixed-width alignment |

A single type scale (`xs` 12px → `5xl` 48px, each with a paired line-height)
is shared across all apps — no per-app font-size overrides.

---

## 4. Spacing, Radius & Elevation

- **Spacing scale:** `0.5`–`24` (0.125rem–6rem), the standard Tailwind-style
  progression — no bespoke one-off values.
- **Radius scale:** `sm` (6px) → `full` (pill), with a single `--radius`
  (10px) as the default component radius. Cards, sheets, and buttons round
  consistently rather than each choosing their own curve.
- **Elevation** is theme-aware, not just `box-shadow` intensity: light mode
  leans on warm-tinted shadows (`--shadow-tint` = amber), dark mode leans on
  lighter surface color + a subtle border with cheaper shadows layered on top
  — because a heavy shadow reads as "dirty" rather than "elevated" on a dark
  background.

---

## 5. Motion

A fixed, small vocabulary (`packages/design-tokens/src/motion.ts`), reused
everywhere rather than invented per-component:

| Duration | Value | Used for |
|---|---|---|
| `instant` | 100ms | Micro-feedback (button press) |
| `fast` | 180ms | Toggles, small state changes |
| `base` | 280ms | Default transition (most UI motion) |
| `slow` | 450ms | Sheet open/close, page transitions |
| `route` | 800ms | The live map marker's position/heading glide |

| Easing | Curve | Used for |
|---|---|---|
| `standard` | `[0.4,0,0.2,1]` | Default — most transitions |
| `decelerate` | `[0,0,0.2,1]` | Things entering the screen |
| `accelerate` | `[0.4,0,1,1]` | Things leaving the screen |
| `spring` | `[0.34,1.56,0.64,1]` | Playful overshoot — sheets, the live marker's entrance pulse, pin-drop |

Framer Motion is the animation engine throughout (`motion.button`,
`AnimatePresence` for page/sheet transitions, `page-transition.tsx`).

### The live map, specifically

The `PremiumMap` component (`packages/ui/src/kinetic/premium-map.tsx`) is
where motion matters most functionally, not just aesthetically:

- The live marker **interpolates** between GPS fixes over `route` duration
  (800ms, tuned just under the driver's ~3s report interval) instead of
  snapping — it's always gliding toward the next known position, never frozen
  mid-interval or overtaken by a newer fix before finishing.
- Heading rotation is similarly smoothed (`useHeading`), preferring the
  device's own GPS/compass-fused heading when available, falling back to a
  bearing computed from successive fixes only when it isn't.
- A pulsing ring (`trylo-pulse-ring`) around the marker signals "live," and a
  slower secondary ring signals "waiting at pickup" — a purely visual cue,
  layered without changing the marker's own shape.
- Drivers can choose the marker's shape itself — `classic` (pulsing dot),
  `arrow` (a forward-pointing chevron — the shape itself communicates heading
  before you even register the rotation), `beacon` (larger, double-ringed),
  or `compact` (minimal, no rings) — while the vehicle icon inside always
  stays correct for their actual vehicle type, and rotation behavior is
  identical across all four.

---

## 6. Theming (Light / Dark / System)

Every app supports light, dark, and "follow system" (`ThemeToggle`,
`theme-provider.tsx`, `theme-script.ts` — the script runs before paint to
avoid a flash of the wrong theme). Themes are implemented purely as CSS
variable swaps (`.dark` class + a `prefers-color-scheme` media-query fallback
for "system" with no explicit class) — no component ever branches on theme in
JS; it always just reads the current `hsl(var(--x))`.

---

## 7. Component Library (`packages/ui`)

**Primitives** (`components/`): `Button`, `Card`, `Dialog`, `Sheet`, `Input`,
`Label`, `Avatar`, `Badge`, `Switch`, `Tabs`, `Table`, `Progress`, `Skeleton`,
`Toast`, `OtpInput`.

**Product-specific pieces** (`kinetic/`) — composed from the primitives, but
carry real product behavior: `PremiumMap`, `PlaceAutocomplete` +
`LocationSearchSheet` + `MapLocationPicker` (address search/pick flow),
`FareBadge`, `StatusPill`, `RatingStars`, `WaitingTimer`, `AnimatedCounter`,
`CancelRideSheet`, `SosConfirmSheet`, `RideChatSheet`, `EmptyState`,
`PageTransition`.

Sharing this package across all three Next.js apps means a fix or a new
marker style, once made here, is automatically consistent everywhere it's
used — this is exactly how the marker-style feature (§5) reached both the
driver's own map and the customer's live map without separate
implementations.

---

## 8. UX Patterns by App

### Customer
- **Bottom-sheet-driven flows** (`Sheet`) for location search, cancellation
  confirmation, and SOS — keeps the map visible underneath as the primary
  context instead of navigating away from it.
- **`StatusPill`** for ride status at every stage — same visual language from
  "requested" through "completed," never a bespoke per-screen status treatment.
- **`FareBadge`** and **`AnimatedCounter`** make the fare estimate and wallet
  balance feel responsive to input, not just displayed.

### Driver
- **Teal-primary, "on duty" framing** — the online/offline toggle and the
  live-map preview are the first things visible on the dashboard, reflecting
  that this is a workspace the driver returns to repeatedly, not a one-off
  purchase flow.
- **`WaitingTimer`** during the arrival window, distinct from the customer's
  simpler "driver is arriving" framing — the driver's own wait is a cost to
  them specifically.

### Admin
- **Indigo, table-first.** Dense `Table` layouts for customers/drivers/rides,
  `Tabs` for filtering, no map-centric hero moment — this surface is for
  scanning and acting on records, not tracking a single live trip.

---

## 9. PWA & Platform Notes

Customer and Driver ship real PWA manifests + service workers
(network-first, deliberately never caching `/api` or HTML — a stale cached
API response would be actively wrong for a live ride). Admin has no PWA
assets — it's a desktop-oriented internal tool, not something meant to be
"installed" on a phone home screen.

---

## 10. What's Intentionally Out of Scope

Matching the honesty standard set in `PRD.md` and `README.md`:

- No formal accessibility audit (contrast ratios follow the token system's
  intent but haven't been independently verified; no screen-reader testing
  pass has been done).
- No i18n/RTL support — copy is English-only, hardcoded.
- No design file (Figma/Sketch) exists — tokens and components *are* the
  source of truth, defined directly in code.
