# TRYLO

A full-stack ride-booking platform — separate Customer, Driver, and Admin apps on a shared real-time backend, built as an independent engineering project.

![Next.js](https://img.shields.io/badge/Next.js-15-000000?logo=nextdotjs) ![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black) ![Express](https://img.shields.io/badge/Express-4-000000?logo=express) ![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white) ![Prisma](https://img.shields.io/badge/Prisma-6-2D3748?logo=prisma) ![Socket.IO](https://img.shields.io/badge/Socket.IO-4-black?logo=socketdotio) ![Docker](https://img.shields.io/badge/Docker-multi--stage-2496ED?logo=docker&logoColor=white)

TRYLO is **not currently hosted** — there is no live deployment. It runs locally (see [💻 Local Development](#-local-development) and [🐳 Docker](#-docker)) and was validated end-to-end on real Android devices.

---

## 📱 Demo

TRYLO has been tested with real Android devices in a small, controlled two-person setup (a customer phone and a driver phone on different networks), exercising the full ride flow — booking, matching, live GPS tracking, arrival, OTP-verified pickup, and completion — rather than only in local development. No screenshots are currently checked into the repository, so none are included here.

---

## ✨ Features

Only functionality actually implemented in the codebase is listed below.

### Customer
- Phone + OTP authentication
- Profile setup
- Ride booking with fare estimate (base + distance + time + surge − promo)
- Nearby-driver matching
- Live ride tracking on the map
- Saved places
- Ride history
- Wallet (balance, transactions)
- Ride cancellation

### Driver
- Phone + OTP authentication
- Vehicle onboarding (type, make, model, registration, color)
- KYC document upload and verification status
- Online/offline toggle
- Incoming ride requests
- Accept / reject ride
- Arrival flow with OTP-verified pickup
- Active ride + GPS location updates
- Earnings and payout records
- Ride history

### Admin
- Login (separate admin auth)
- Dashboard overview
- Customer management
- Driver management, including verification and suspension
- Ride management and status history
- Wallet / payment transaction views
- Analytics (rides trend by day/week/month, commission)

---

## 🛠️ Technical Highlights

### Geo-indexed driver matching

Checking every driver's distance on every ride request doesn't scale. TRYLO instead pushes the search into PostgreSQL itself:

- Each driver's `lat`/`lng` is mirrored into a Postgres-**generated** `geo` column (`earth` type) via the `earthdistance`/`cube` extensions' `ll_to_earth()`, maintained automatically by the database — never written directly through Prisma.
- That column has a **GiST index**, so distance queries are index-backed instead of full table scans.
- Matching searches in **expanding rings — 1km → 2km → 3km** — only widening the radius if no eligible driver is found nearby, using the indexable `earth_box(...) @> geo` predicate combined with `earth_distance(...)` for exact ordering.
- Candidates are also filtered by online status, verification status, suspension, and vehicle type before ranking.

No scalability numbers or load-test benchmarks are claimed here — this describes the query strategy, not measured performance at scale.

### Real-time tracking

```
Driver phone → GPS reading → Socket.IO (WebSocket) → API server → "driver:location" event → ride room → Customer app's live map
```

The driver's browser reads its GPS position and sends it to the backend over a Socket.IO connection. The API relays that position as a `driver:location` event into a per-ride Socket.IO room (`ride:{rideId}`), so only the customer (and driver) currently on that ride receive it. The customer's map subscribes to that room and updates live — no polling.

### Authentication

- Phone-number login with an OTP challenge (`/otp/request`, `/otp/verify`) for both customers and drivers, and a separate admin login.
- Short-lived JWT **access tokens** (15 minutes) plus a longer-lived **refresh token** flow, so a leaked access token has a small blast radius.
- Role-based authorization (`customer` / `driver` / `admin`) enforced per route.

**Honest disclosure:** OTP delivery in the current implementation is a development/testing mechanism — the requested OTP is returned directly in the API response (`devHintOtp`) rather than sent through a real SMS provider. This is intentional for controlled testing and is **not** a production-grade OTP delivery flow.

### Wallet / settlement

TRYLO uses an **internal wallet-based settlement system** — there is **no external payment gateway** (no Stripe, Razorpay, or UPI integration). When a driver ends a ride, the ride's `paymentStatus`, the rider's wallet debit, and the driver's earning record are updated together inside a single Prisma `$transaction`, so a ride is settled atomically and exactly once — `paymentStatus` moves from `pending` to `paid` or `failed` a single time per ride, guarding against double-settlement on retries.

---

## 🗺️ Map Technology

TRYLO uses an open-source mapping stack instead of a paid Google Maps API key, to avoid tying a personal project to a metered commercial dependency:

- **MapLibre GL JS** for map rendering, tiled by **OpenFreeMap**
- **OSRM** (public routing API) for turn-by-turn routing and ETAs
- **Nominatim** / **Photon** for geocoding and place search/autocomplete

These are consumed as public HTTP services from the client apps — this is not a claim that TRYLO self-hosts any part of the mapping stack.

---

## 🏗️ Architecture

```mermaid
flowchart TB
    subgraph Apps["Client Applications (Next.js, static export)"]
        CUST["Customer App"]
        DRV["Driver App"]
        ADM["Admin App"]
    end

    subgraph API["apps/api — single Node process"]
        REST["Express REST API"]
        IO["Socket.IO"]
        MATCH["Matching Engine<br/>(1km → 2km → 3km)"]
    end

    DB[("PostgreSQL 16<br/>cube + earthdistance, GiST index")]

    CUST -->|REST| REST
    DRV -->|REST| REST
    ADM -->|REST| REST

    DRV -->|GPS over WebSocket| IO
    IO -->|driver:location event| CUST

    REST --> MATCH
    MATCH -->|earth_box / earth_distance query| DB
    REST --> DB
```

---

## 🧰 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15, React 19, TypeScript, Tailwind CSS |
| Backend | Node.js, Express 4 |
| Database | PostgreSQL 16 (`cube` + `earthdistance` extensions) |
| ORM | Prisma 6 |
| Real-time | Socket.IO 4 |
| Maps | MapLibre GL JS + OpenFreeMap |
| Routing | OSRM |
| Geocoding | Nominatim / Photon |
| Containerization | Docker (multi-stage build) |
| CI | GitHub Actions — monorepo build, typecheck, lint and tests (ephemeral PostgreSQL service container) |
| Monorepo | Turborepo + pnpm workspaces |

> **Note on the workflows still in this repo:** `.github/workflows/ci.yml` is the workflow that runs. The repository also still contains the Azure deploy pipelines (`api-deploy.yml`, `swa-customer.yml`, `swa-driver.yml`, `swa-admin.yml`) and the `azure/` PowerShell helper wrappers from when TRYLO was hosted on Azure — they are kept for reference but have nothing to deploy to any more.

---

## 📁 Project Structure

```
apps/
  api/            Express + Socket.IO backend
    src/
      auth/       JWT, refresh tokens, OTP
      matching/   Geo-indexed progressive-radius driver matching
      realtime/   Socket.IO server/rooms
      routes/     customerAuth, customerRide, customerWallet,
                   driverAuth, driverRide, driverEarnings,
                   adminAuth, adminCustomers, adminDrivers,
                   adminRides, adminPayments, adminAnalytics, ...
      lib/
    prisma/       schema.prisma + migrations
    Dockerfile

  customer/       Next.js customer app  (port 3000)
  driver/         Next.js driver app    (port 3001)
  admin/          Next.js admin app     (port 3002)

packages/
  types/          Shared TypeScript types
  ui/             Shared UI components (map, autocomplete, geocoding helpers)
  mock-data/      Shared API/socket clients + hooks
  design-tokens/  Shared design tokens / Tailwind preset
```

---

## 💻 Local Development

**Prerequisites:** Node.js ≥ 18.18 (the Docker build uses Node 22 to run `pnpm@11.18.0`), pnpm via Corepack, Docker.

```bash
# 1. Install dependencies (from the repo root)
pnpm install

# 2. Start local PostgreSQL (docker-compose.yml maps host port 55448 -> 5432)
pnpm db:up

# 3. Configure the API
cp apps/api/.env.example apps/api/.env
# then edit apps/api/.env — set DATABASE_URL to match the port docker-compose.yml
# actually exposes (55448), e.g.:
# DATABASE_URL="postgresql://trylo:trylo_dev_password@localhost:55448/trylo?schema=public"

# 4. Run database migrations
pnpm db:migrate

# 5. Configure the frontends (each defaults to http://localhost:4000 if unset)
cp apps/customer/.env.example apps/customer/.env.local
cp apps/driver/.env.example apps/driver/.env.local
# apps/admin has no .env.example — it uses the same localhost:4000 fallback

# 6. Run everything (Turborepo)
pnpm dev
# or run one app at a time:
pnpm dev:api
pnpm dev:customer
pnpm dev:driver
pnpm dev:admin
```

Never commit real `.env` files or secrets — only `.env.example` templates are checked in.

---

## 🐳 Docker

`apps/api/Dockerfile` is a 3-stage build:

1. **`pruner`** (`node:22-bookworm-slim`) — runs `turbo prune api --docker` to extract only what `apps/api` actually depends on (itself + `@trylo/types`) from the monorepo, instead of shipping the whole workspace.
2. **`installer`** (`node:22-bookworm-slim`) — installs the pruned dependency set with `pnpm install --frozen-lockfile`, runs `prisma generate`, and builds the TypeScript output. Node 22 is required here specifically because the pinned `pnpm@11.18.0` needs Node ≥ 22.13 to run at all.
3. **`runner`** (`node:20-bookworm-slim`) — the actual shipped image. Runs as a non-root user, exposes port `4000`, and starts with `node apps/api/dist/index.js`. Debian slim (not Alpine) is used because Prisma's query engine needs glibc + OpenSSL.

Only non-secret environment variables are referenced by name here — actual values are never committed:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Signs access/refresh tokens |
| `PORT` | API listen port (`4000`) |
| `CORS_ORIGINS` | Comma-separated allowed origins |

---

## ⚠️ Security & Testing Disclaimer

TRYLO is an independent engineering/learning project. It runs locally (or in Docker) and has been tested with real devices in a small, controlled two-person setting — **it is not deployed or hosted anywhere**, **it is not presented as a production-scale ride-hailing platform**, and no claims are made about production readiness, scalability to many concurrent users, or commercial launch.

Specifically, and honestly:
- There is no live deployment: the environment TRYLO was previously hosted in has been taken down, so there is no public URL and nothing is currently running there.
- OTP delivery is a development/testing mechanism (the OTP is returned in the API response), not integrated with a real SMS provider.
- Payment settlement is handled entirely by an internal wallet system — there is no real money movement or external payment gateway.
- The API intentionally runs as a single instance (in-memory Socket.IO state, in-process matching loop) and is not horizontally scaled.

---

## 🧠 What I Learned

- Writing index-backed geo queries in PostgreSQL (`cube`/`earthdistance`, GiST indexing, generated columns) instead of reaching for a full GIS extension
- Designing a progressive-radius search strategy as a simpler alternative to naive distance scanning
- Real-time state distribution over Socket.IO using per-ride rooms
- Modeling a multi-step ride lifecycle (`requested → matched → arriving → arrived → in_progress → completed/cancelled`) as explicit state, with a status-history audit trail
- Keeping wallet settlement transaction-safe and idempotent with Prisma `$transaction`
- Structuring a real Turborepo/pnpm monorepo across 4 apps and 4 shared packages
- Building a multi-stage Docker image for a monorepo service using `turbo prune`
- Operating a full stack on a student-budget cloud account — including scale-to-zero cold starts and eventually tearing the whole environment down to stop costs
- Replacing a paid Google Maps dependency with an open-source stack (MapLibre/OpenFreeMap, OSRM, Nominatim/Photon)

---

## 👨‍💻 Author

**Ritikesh Kumar Singh**

- GitHub: [github.com/rksingh-108](https://github.com/rksingh-108)
- LinkedIn: [linkedin.com/in/rksingh108](https://linkedin.com/in/rksingh108)
