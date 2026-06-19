# eFancy — Self-Ordering Spectacles & Multi-Service App (MVP)

This repository implements the MVP described in `ai_prompts_self_ordering_app.md`,
prioritizing the **eSpectacles** module with the foundations for the other
modules (eGroceries, eFreshes, eServices).

## Architecture

```
backend/   Node.js + Express + SQLite (better-sqlite3) REST API
web/       React + Vite mobile-first responsive web client
```

The same REST API is intended to back future iOS / Android (React Native)
clients — keep all business rules server-side.

## What is implemented (MVP)

Backend (`/backend`)
- SQLite schema covering: users, roles, OTPs, sessions, spectacle frames + images,
  lens brands, partner shops, eyesight records, orders + order_items, payments,
  refunds, QR checkup tokens, system config, admin audit logs.
- OTP-based mobile login (OTP returned in dev mode for testing).
- JWT auth + role-based middleware (consumer / vendor / admin / super_admin).
- CRUD for frames, lens brands, partner shops (admin / super admin).
- eSpectacles ordering flow: create checkup pending order, create paid order,
  modify within 12h, finalise after 12h, cancel + refund.
- Order state machine with allowed transitions.
- Seed script with demo data and a super admin (mobile `+6500000000`).

Web (`/web`)
- Mobile-first React app, scalable top tabs + bottom Cart/Orders/Me bar.
- Home with 4 service buttons (eSpectacles, eGroceries, eFreshes, eServices).
- Full eSpectacles flow:
  - Page A: Choose Frame (grid, popup with swipeable images, single-select).
  - Page B: Eyesight Data Choice (No data → partner shop + checkup fee + QR
    pending order; Having data → SPH/CYL/Axis/ADD/PD with Modify/Confirm).
  - Page C: Ordering (lens options, suggested thickness, live total).
  - Page E: Confirmation (read-only, Modify, Make Payment).
  - Page F: Payment (5 methods; 12h modify window notice).
- Orders list with statuses, Me/profile, persistent login until logout.
- Admin pages: frames + partner shops + lens brands + config (checkup fee).

The other modules (eGroceries, eFreshes, eServices) have placeholder sub-homes
and are wired into the navigation, ready for phased delivery as described in
the master prompt.

## Quick start

Prereqs: Node 18+.

```bash
# 1. Backend
cd backend
npm install
npm run seed       # creates ./data.sqlite with demo data
npm run dev        # http://localhost:4000

# 2. Web (new terminal)
cd web
npm install
npm run dev        # http://localhost:5173
```

Demo accounts (OTP is printed to backend console and also returned in the
login response while `NODE_ENV !== 'production'`):

| Role        | Mobile        |
|-------------|---------------|
| Super Admin | +6500000000   |
| Admin       | +6500000001   |
| Vendor      | +6500000002   |
| Consumer    | +6500000003   |

## Configurable defaults (Super Admin)
- `checkup_fee` (default `20.00`)
- `order_modify_window_hours` (default `12`)
- `refund_window_weeks` (default `4`)

## Order lifecycle implemented

`Opening → Pending → Paid → (Finalised | Cancelled) → Processing → Ready for Shipping → Delivered → UserConfirmed → SystemDone`

eServices-specific states (`UserAccept`, `VendorAccept`, `PendingService`,
`Completed`) are present in the schema for the next phase.

## Notes / future work
- Real SMS provider integration (Twilio/MessageBird) — currently OTPs are
  logged for dev.
- Real payment gateway integration — currently payments are simulated.
- Push / email notifications.
- React Native shell sharing the same API.
- eGroceries / eFreshes / eServices full implementations.
