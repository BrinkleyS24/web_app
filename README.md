# Intrackt Premium Web (starter)

This is the starter web app for premium features (pricing, account, dashboards). It uses:

- React + Vite
- Firebase Auth (Google sign-in)
- Your existing backend API (`backend/gmail-job-tracker-be`)

## 1) Configure env

Copy `frontend/web/.env.example` to `frontend/web/.env.local` and fill in:

- `VITE_API_BASE_URL`
- `VITE_FIREBASE_*` (from Firebase console → Web app config)

## 2) Make backend allow this origin in dev

When running locally, Vite uses `http://localhost:5173`.

In `backend/gmail-job-tracker-be/.env`, set:

- `DEV_ORIGINS=http://localhost:5173`

In production, set one of:

- `WEB_ORIGINS=https://your-web-domain`
- or `FRONTEND_URL=https://your-web-domain`

## 3) Run

In one terminal:

```powershell
cd backend/gmail-job-tracker-be
npm install
npm run dev
```

In another terminal:

```powershell
cd frontend/web
npm install
npm run dev
```

Open `http://localhost:5173`.

## What works right now

- **Home**: signs in and calls `POST /api/user` to read the plan
- **Pricing**: calls `POST /api/subscriptions/create-checkout-session`
- **Account**: calls `GET /api/subscriptions/status` and opens the customer portal

If billing is not configured on the backend, subscription routes will return an error (expected).

