# Coy Discover

A standalone, mobile-first Discover experience inspired by the Coy SDE Intern assignment. It pairs a React/Vite client with a Node/Express API and configurable JSON-file or MongoDB storage. It includes a lightweight bearer-token sign-in flow and three seeded demo accounts. This is an independent mock project; it does not use Coy's code, services, or real user data.

## Features

- Home placeholder and Discover navigation, responsive for mobile and desktop.
- 35 fictional, seeded profiles with photos, bios, city and interests; 10 have seeded incoming likes for mutual-match demos.
- Ten sign-in demo IDs map directly to ten profiles. The signed-in profile appears in the app header/sidebar and is excluded from that account's own Discover feed.
- One-at-a-time profile cards, swipe/drag gestures, like/pass buttons, animation and feedback.
- Decisions persist to disk; a decided profile never appears in the feed again until reset.
- Demo sign-in with scrypt-hashed passwords, signed 24-hour bearer tokens, and per-account swipe isolation.
- Undo the most recent swipe for the signed-in account.
- Seeded incoming likes can only be revealed by a reciprocal like. Incoming likes are never sent in the feed or exposed by a separate API.
- Matches view, mutual-match modal, empty states, recoverable API errors and reset-demo control.
- Open any mutual match to view their full profile, bio, city and interests.
- API input validation and automated tests for privacy, mutual matches, persistence behavior and invalid requests.

### Assessment coverage

- **Part A:** Two Coy feature suggestions are included as clearly marked hypotheses; the README states they need validation because the live app was not explored for this submission.
- **Part B:** The app has a blank Home tab and a mobile-first Discover tab with 35 complete mock profiles, drag swipes, desktop buttons, animations, feedback, persistent decisions, and a no-profiles-left state.
- **Matching/privacy:** Ten seeded profiles carry incoming likes for the demo. A match is only returned after the signed-in profile likes one back. Feed responses omit incoming-like metadata, and matches contain only mutual likes.
- **Backend:** Express exposes `GET /feed`, `POST /swipe`, `GET /matches` (plus `/api` aliases), validates requests, and persists state in JSON or optional MongoDB storage.

## Extra feature added for the assessment

**Matched profile detail view:** after a mutual match, open **Matches** and select a person to view their full profile, bio, city and interests. The match screen only contains reciprocal likes; incoming one-sided likes remain private. I also added **Undo last swipe** as a small usability enhancement: it restores your latest passed or liked profile, and withdrawing a mutual like removes its match.

## Requirements

Node.js 20 or later and npm. By default the app uses a local JSON data file. MongoDB is optional. Profile photos load from Unsplash, so an internet connection is needed to display them; the app itself runs locally.

## Run locally

```bash
npm install
Copy-Item .env.example .env   # PowerShell; optional because defaults are provided
npm run seed
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). The API listens at [http://localhost:4000](http://localhost:4000). In bash, copy the environment template with `cp .env.example .env` instead. To run the production client build use `npm run build`; serve the built `client/dist` separately behind the API for deployment.

### Use MongoDB instead of JSON

The MongoDB driver is included. Start a local MongoDB server or create a MongoDB Atlas database, then put its connection URI into `.env`:

```dotenv
MONGODB_URI=mongodb://127.0.0.1:27017
MONGODB_DB=coy_discover
MONGODB_COLLECTION=app_state
```

Restart the app and run `npm run seed`. When `MONGODB_URI` is set, the API, seed and reset scripts all use the configured database; when it is blank, local JSON storage remains active. The first connection creates the demo account data automatically. Keep database credentials private and do not commit `.env`. This single-document store is intended for the assignment demo, not concurrent production traffic.

### Demo accounts

Choose any of the ten profile-backed demo IDs on the sign-in screen. The email and profile shown there are the same identity shown after signing in. Password for each is `CoyDemo123!`.

| Name | Demo ID / email |
|---|---|
| Maya | `p001` · `maya@example.com` |
| Aarav | `p002` · `aarav@example.com` |
| Isha | `p003` · `isha@example.com` |
| Kabir | `p004` · `kabir@example.com` |
| Ananya | `p005` · `ananya@example.com` |
| Rohan | `p006` · `rohan@example.com` |
| Zoya | `p007` · `zoya@example.com` |
| Dev | `p008` · `dev@example.com` |
| Meera | `p009` · `meera@example.com` |
| Arjun | `p010` · `arjun@example.com` |

Swipes are isolated by account. A newly reset store is seeded automatically with these users; `npm run reset` clears all demo accounts' swipes and recreates the test accounts. The ten incoming-like profiles create a match when a signed-in demo user likes one of those profiles (excluding their own profile).

### Reset

Use the **Reset demo** control in the sidebar, or run `npm run reset`. This clears saved swipe decisions and restores all demo profiles.

## Test

```bash
npm test
```

Tests use Node's built-in test runner and an isolated temporary data file.

## API

The app accepts both the `/api`-prefixed routes and the assignment's root paths. JSON is used for request and response bodies. Except login, demo account list, logout, and health, send `Authorization: Bearer <token>`.

### `POST /api/auth/login`

Body: `{ "email": "p001", "password": "CoyDemo123!" }` or use the account email. Returns a token and matching profile-backed user details such as `{ "id": "p001", "name": "Maya", "email": "maya@example.com", "profileId": "p001", "photo": "https://..." }`. Invalid credentials return `401`.

### `GET /api/auth/demo-accounts`

Public list of the ten intentionally seeded demo IDs and their matching public profiles. All accounts use the same demo password; no password hashes are returned.

### `GET /api/auth/me`

Returns the current authenticated user and their matching profile identity. Missing, invalid or expired tokens return `401`.

### `POST /api/auth/logout`

Returns `{ "ok": true }`; the client removes its locally stored token. The server remains stateless.

### `GET /feed` (`GET /api/feed`)

Returns undecided public profiles, oldest seed order first.

```json
{ "profiles": [{ "id": "p001", "name": "Maya", "age": 24, "city": "Kochi", "bio": "...", "photo": "https://...", "interests": ["film photography"] }] }
```

The public profile schema intentionally has no `likedYou`, incoming-likes list, or other reciprocity indicator.

### `POST /swipe` (`POST /api/swipe`)

Body: `{ "profileId": "p001", "direction": "like" }`, where direction is `like` or `pass`. A successful first swipe returns `201` with `{ "swipe": ..., "matched": false, "match": null }`, or a public match profile when the like is mutual. Repeated decisions return `409`; malformed input returns `400`; unknown profile IDs return `404`.

### `GET /api/swipe/last` and `POST /api/swipe/undo`

The first reports whether the signed-in user has a decision that can be undone. The second removes that user's most recent swipe and returns its profile to the feed. It returns `404` when there is no swipe to undo. Undoing a like also removes any match that depended on it.

### `GET /matches` (`GET /api/matches`)

Returns only reciprocal likes: `{ "matches": [...] }`. It never returns one-sided incoming likes.

### `GET /api/health`

Returns `{ "status": "ok" }` for a basic health check.

### `POST /api/reset`

Local demo utility that clears persisted swipes for the authenticated user. It is intended for the assignment demo; do not expose it publicly without appropriate authorization controls.

Errors use `{ "error": "..." }`. Browser requests are limited to the configured `CLIENT_ORIGIN` (default `http://localhost:5173`).

## Architecture and privacy notes

The client calls the Express API and never calculates reciprocity itself. Seed passwords are stored using Node scrypt and per-user random salts; the API issues signed, expiring bearer tokens. Each demo account maps to its corresponding seeded profile ID; that profile is displayed as the signed-in identity and filtered out of its own feed. Each swipe is associated with an account, and feed/matches/reset operations are scoped to the authenticated account. The server owns a static seed catalog and a small user/swipes store. JSON mode writes `server/data/state.json` through a temporary file followed by rename; MongoDB mode stores the demo state document in the configured collection. Feed serialization strips seed-only `likedYou` metadata. Match calculation is server-side and requires both a seeded incoming like and the current user's persisted `like` decision. A pass or like remains excluded from that user's feed. This authentication and storage design is for local demonstration. Before public deployment, set a strong `AUTH_SECRET`, use HTTPS, move tokens to secure HttpOnly cookies or a carefully reviewed token strategy, add rate limiting and account lifecycle controls, and use transactional persistence for concurrent writes.

## Project structure

```text
coy-discover/
├── client/                 React + Vite UI
│   └── src/                App and mobile-first styles
├── server/
│   ├── data/                Runtime JSON state (created on first swipe)
│   ├── src/data/            Fictional profile catalog
│   ├── src/scripts/         Seed/reset commands
│   ├── src/                 Express routes, storage and server entry
│   └── test/                API behavior and privacy tests
├── .env.example
└── package.json
```

## Part A — feature suggestions (hypotheses to validate)

These are product hypotheses based only on the assignment's described flows. I did not access Coy or complete its OTP, add-crush, email-verification, invite-link, or extra-slots journeys. Validate these ideas against the live product before presenting them as observations.

1. **A clear, private “crush status” timeline.** Let a user see whether a crush invitation is drafted, delivered, opened, or awaiting a response, with plain-language guidance on what the other person can and cannot see. The assignment mentions several steps (adding a crush, email verification, invite link) where users may wonder whether a private action has become visible. A status timeline could reduce uncertainty and support requests while preserving Coy's core privacy promise.
2. **A thoughtful invite follow-up and recovery flow.** Let users safely resend or copy an invite, correct a typo, and understand what happens when a recipient has not joined, without revealing who added them. The invite and extra-slot flow suggest that invitations are an important growth path; clear recovery could reduce abandoned invitations and accidental duplicate sends. Validate this against actual friction and ensure invite handling never exposes a sender without consent.

## Publish to GitHub

Create an empty public repository in your GitHub account, then from this project folder run:

```bash
git init
git add .
git commit -m "Build Coy Discover assignment"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/coy-discover.git
git push -u origin main
```

Replace `YOUR-USERNAME` and the repository URL with your own. Review the files before publishing. The included `.gitignore` excludes runtime data, dependencies, builds, and environment secrets. Publishing is left to you.
#   M u t u a l M a t c h - A p p  
 