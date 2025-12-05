# LIBRARY__BACKEND

Backend for SHAI Library — a simple library seat/booking management API built with Node.js, Express and MongoDB.

## Features
- User authentication (signup/login) with Passport.js
- Seat booking, monthly bookings and protected/blocked seat handling
- Payments integration endpoints (placeholder/service model)
- Feedback submission and admin controls
- Scheduled auto-release job for held seats

## Tech stack
- Node.js + Express
- MongoDB (Mongoose)
- Passport.js for auth
- Multer for file uploads
- Cron-like scheduled job for automatic seat release

## Requirements
- Node.js 18+ (or compatible)
- MongoDB (local or hosted)

## Quickstart
1. Clone the repo and install dependencies:

	npm install

2. Create a `.env` file at the repo root (example keys below).

3. Start the server in development:

	npm run dev

Or start production:

	npm start

## Environment variables
Create a `.env` file with at least the following (names may vary by app code):

- `PORT` — server port (e.g., 5000)
- `MONGO_URI` — MongoDB connection string
- `JWT_SECRET` — secret for signing JWTs (or passport session secret)
- `PAYMENT_PROVIDER_KEYS` — any payment provider keys (if used)

## Scripts
- `npm start` — start the server (production)
- `npm run dev` — start with nodemon (development)
- `npm run seed` — initialize seats (if `scripts/initSeats.js` exists)

## API (high-level)
This project exposes REST endpoints for:
- Authentication: `POST /api/auth/signup`, `POST /api/auth/login`
- Seats: `GET /api/seats`, `POST /api/seats/book`, `PATCH /api/seats/:id`
- Monthly bookings: `POST /api/monthly-bookings`, `GET /api/monthly-bookings`
- Payments: `POST /api/payments/*` (controller placeholder)
- Feedback: `POST /api/feedback`, `GET /api/feedback` (admin)

Refer to route files in the `routes/` folder for exact paths and expected payloads.

## Project structure (important files)
- `app.js` — app entry and middleware setup
- `models/` — Mongoose models (User, Seat, Booking, Payment, etc.)
- `controllers/` — request handlers
- `routes/` — route definitions
- `services/` — background jobs and business logic (e.g., `autoReleaseJob.js`)
- `middleware/` — auth, file upload config
- `scripts/initSeats.js` — utility to seed seats

## Development tips
- Use Postman or similar to exercise routes during development.
- Ensure `MONGO_URI` points to a writable DB before running seed scripts.

## Contributing
Fork, create a branch, make changes and open a PR. Keep changes focused and add tests/documentation for non-trivial features.

## License
This project does not include a license file. Add one (e.g., MIT) if you intend to open-source the code.

---
If you want, I can also generate example `.env` and a quick Postman collection for common endpoints.
