# TRYLO — Product Requirements Document

**Status:** Living document, reflects the implemented codebase as of this writing.
**Owner:** Ritikesh Kumar Singh
**Type:** Independent engineering/portfolio project — not a commercial product.

---

## 1. Overview

TRYLO is a full-stack ride-booking platform: separate Customer, Driver, and Admin
applications sharing one real-time backend. It reproduces the core mechanics of a
ride-hailing product — booking, geo-matching, live GPS tracking, arrival detection,
OTP-verified pickup, in-app payment settlement, and admin oversight — as a learning
and portfolio project, deployed to Azure and exercised with real Android devices in
a small, controlled two-person test (customer phone + driver phone, different
networks).

This document describes what the product does today, why it's built the way it is,
and what's explicitly out of scope. It does not claim production readiness, scale,
or commercial intent.

---

## 2. Goals

- Model a complete, realistic ride lifecycle end-to-end — not a UI mockup — with a
  real backend, real database, real-time updates, and a genuine (if internal)
  payment settlement path.
- Demonstrate index-backed geo-matching in PostgreSQL rather than a naive
  full-scan or a bolted-on GIS extension.
- Keep every state transition (ride status, payment, cancellation fee) correct
  under concurrency and retries — no double-charging, no permanently stuck states.
- Ship on infrastructure a student can actually afford (Azure Free/Burstable
  tiers, scale-to-zero where possible).
- Be honest in documentation about what is and isn't production-grade (OTP
  delivery, payments, horizontal scale).

### Non-Goals

- Production-scale traffic handling, horizontal scaling, or load-tested capacity
  claims.
- Real payment processing (no Stripe/Razorpay/UPI integration).
- Real SMS-based OTP delivery.
- Multi-region or high-availability deployment.
- Driver supply/demand economics, surge modeling beyond a simple flag, or
  regulatory/compliance features.

---

## 3. Users

| Persona | Description | Primary surface |
|---|---|---|
| **Customer (Rider)** | Books a ride, tracks the driver live, pays via in-app wallet | `apps/customer` |
| **Driver** | Onboards with KYC + vehicle info, goes online, accepts rides, drives, gets paid | `apps/driver` |
| **Admin** | Operates the platform: approves drivers, manages users, reviews rides/payments/analytics | `apps/admin` |

---

## 4. Core Ride Lifecycle

The ride is the central entity. Its status moves through an explicit state
machine, with every transition recorded to an audit trail (`RideStatusHistory`):

```
requested → arriving → arrived → in_progress → completed
                ↓           ↓          
             cancelled  cancelled      (cancellation only allowed before in_progress
                                        for the customer; driver can cancel through
                                        "arrived")
```

- **requested** — customer has booked, matching engine is searching for a driver.
- **arriving** — a driver accepted; driver is en route to pickup.
- **arrived** — driver's live GPS confirms they've reached pickup (see §5.2).
- **in_progress** — rider verified the driver's OTP; trip is underway.
- **completed** — driver ended the trip; payment settles as part of the same
  transaction (see §5.4).
- **cancelled** — either party cancelled; a late cancellation (after a driver has
  accepted) incurs a fee.

---

## 5. Functional Requirements

### 5.1 Authentication
- Phone number + OTP challenge for both customers and drivers (`/otp/request`,
  `/otp/verify`); separate email/password login for admins.
- Short-lived JWT access tokens (15 min) + longer-lived refresh tokens.
- Role-based route authorization (`customer` / `driver` / `admin`).
- **Known limitation:** OTP is returned directly in the API response
  (`devHintOtp`) for controlled testing — not wired to a real SMS provider.

### 5.2 Matching & Live Tracking
- Geo-indexed driver search: driver `lat`/`lng` mirrored into a Postgres
  **generated** `geo` column (`cube`/`earthdistance`), GiST-indexed.
- Progressive-radius matching (1km → 2km → 3km), filtered by online status,
  verification, suspension, and vehicle type.
- Driver GPS relayed over Socket.IO into a per-ride room (`ride:{rideId}`); the
  customer's map subscribes and updates live, no polling.
- **Arrival detection** requires *both*: (a) the GPS fix's own reported accuracy
  is within a trusted threshold, and (b) **2 consecutive** trustworthy, in-radius
  pings — a single noisy fix can no longer falsely mark a driver "arrived."
  Confirmation counting and the final status transition are both concurrency-safe
  under overlapping location pings.
- **Marker customization:** a driver can choose their live-map marker's visual
  style (classic / arrow / beacon / compact) from their profile; the vehicle icon
  shown is always correct regardless of style, and the marker still rotates to
  the live GPS/compass heading. The choice is visible on both the driver's own
  map and the customer's live map for that ride.

### 5.3 Booking & Cancellation
- Fare estimate = base + distance + time + surge − promo, validated server-side
  against a tampered client submission.
- Free cancellation before a driver accepts; a flat late-cancellation fee applies
  once a driver is "arriving" or "arrived," debited from the rider's wallet.
- A rider is never trapped in a ride they can't afford to cancel — insufficient
  balance still lets the cancellation through, simply without charging the fee.
- Cancellation status change and its fee debit are one atomic transaction: a
  genuine failure rolls back both together, so a retry recovers cleanly instead
  of leaving a cancelled-but-uncharged ride.

### 5.4 Trip Completion & Payment
- OTP-verified pickup: the rider's OTP must be confirmed by the driver before the
  ride moves to `in_progress`.
- Ending a trip (`in_progress → completed`) and settling payment — rider wallet
  debit, driver earning record, `paymentStatus` — happen inside a single Prisma
  transaction. A genuine failure anywhere in that transaction rolls the whole
  thing back (the ride is *not* left "completed" with payment stuck pending); a
  retry starts clean and can fully recover.
- Concurrent/duplicate completion requests settle exactly once — the database
  transaction's own row lock is what serializes them, not application-level
  deduplication.
- Insufficient rider balance completes the ride with `paymentStatus: failed`
  rather than blocking trip completion.

### 5.5 Driver Onboarding
- Vehicle details (type, make, model, registration, color).
- KYC document upload with a verification status per document.
- Admin approve/reject; a suspended driver cannot go online.

### 5.6 Wallet
- Internal balance + transaction ledger per customer (no external payment
  gateway). Every debit (ride fare, cancellation fee) is a `WalletTransaction`
  row, uniquely tied to its ride where applicable to prevent double-charging.

### 5.7 Admin
- Dashboard overview; customer and driver management (suspend/unsuspend);
  driver verification approve/reject; ride list with status/payment filtering;
  wallet/payment transaction views; ride-trend analytics (day/week/month) and
  commission.

---

## 6. Non-Functional Requirements

- **Correctness under concurrency:** every financial/state-changing endpoint
  (accept, cancel, complete) uses a database-level compare-and-swap or an atomic
  transaction — no read-then-write race can double-process a ride.
- **Real-time delivery:** ride status and driver location changes reach the
  other party over Socket.IO with room-based scoping (not broadcast) and
  reconnect-safe room rejoin.
- **Cost-conscious deployment:** API on Azure Container Apps with
  `minReplicas=0` (scale-to-zero); Postgres started/stopped manually around test
  sessions via `scripts/azure-test-env.ps1`.
- **Honesty over polish:** documentation (this file and the README) states
  plainly what's simulated (OTP delivery, payments) versus what's real
  (geo-matching, live tracking, state machine, transactional settlement).

---

## 7. Explicitly Out of Scope

- Real SMS OTP delivery.
- Real payment gateway / real money movement.
- Horizontal scaling of the API (Socket.IO state and the matching loop are
  in-memory and single-instance by design).
- Surge pricing beyond a static flag, driver incentive/economics modeling.
- Multi-language/i18n, accessibility audit, or App Store/Play Store distribution.

---

## 8. Architecture Summary

```
Customer / Driver / Admin apps (Next.js, static export)
        │ REST                    │ GPS over WebSocket
        ▼                         ▼
apps/api — single Node process (Express REST + Socket.IO + matching engine)
        │
        ▼
PostgreSQL 16 (cube + earthdistance, GiST index)
```

Full stack, tech choices, and local-dev/deploy instructions are documented in
[`README.md`](README.md); this PRD covers *what* the product does and *why*, not
*how to run it*.

---

## 9. Recent Changes Reflected in This PRD

- False-arrival prevention (GPS accuracy + consecutive confirmations) and a
  concurrency-safe arrival transition.
- Driver-selectable live-map marker styles.
- Transactional, safely-retryable ride completion and late-cancellation fee
  charging (no permanently stuck completed-but-unpaid or cancelled-but-uncharged
  states under a genuine failure).

---

## 10. Open Questions / Future Considerations

- Real SMS OTP integration if this ever moved beyond controlled testing.
- A real payment gateway if wallet top-ups needed to reflect real money.
- Horizontal scaling (Redis-backed Socket.IO adapter, externalized matching
  loop) if concurrent-rider volume ever required more than one API instance.
