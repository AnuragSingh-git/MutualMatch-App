# Coy Discover

A standalone, mobile-first Discover experience inspired by the Coy SDE Intern assignment.

**React + Vite** · **Node + Express** · **JSON or MongoDB** · **35 mock profiles**

> An independent demo project. It does not use Coy's code, services, or real user data.

## Contents

- [Highlights](#highlights)
- [Two meaningful extra features](#two-meaningful-extra-features)
- [Assessment coverage](#assessment-coverage)
- [Run locally](#run-locally)
- [Demo IDs](#demo-accounts)
- [MongoDB setup](#use-mongodb-instead-of-json)
- [Tests](#test)
- [API reference](#api)
- [Privacy and architecture](#architecture-and-privacy-notes)
- [Part A suggestions](#part-a--feature-suggestions-hypotheses-to-validate)
- [Publish to GitHub](#publish-to-github)

## Highlights

- Home placeholder and Discover navigation, responsive for mobile and desktop.
- 35 fictional, seeded profiles with photos, bios, city and interests; 10 have seeded incoming likes for mutual-match demos.
- Ten sign-in demo IDs map directly to ten profiles. The signed-in profile appears in the app header/sidebar and is excluded from that account's own Discover feed.
- Sign-up collects profile details and discovery preferences together, then assigns a demo ID equal to the new profile ID.
- Saved discovery preferences filter the feed by city and up to three interests, separately for each account.
- One-at-a-time profile cards, swipe/drag gestures, like/pass buttons, animation and feedback.
- Decisions persist to disk; a decided profile never appears in the feed again until reset.
- Ten profile-backed demo IDs, explicit log out, scrypt-hashed passwords, signed 24-hour bearer tokens, and per-account swipe isolation.
- Undo the most recent swipe for the signed-in account.
- Report or block a profile from Discover or a matched profile; manage blocks in Safety Center.
- Seeded incoming likes can only be revealed by a reciprocal like. Incoming likes are never sent in the feed or exposed by a separate API.
- Matches view, mutual-match modal, empty states, recoverable API errors and reset-demo control.
- Open any mutual match to view their full profile, bio, city and interests.
- API input validation and automated tests for privacy, mutual matches, persistence behavior and invalid requests.

### Assessment coverage

- **Part A:** Two Coy feature suggestions are included as clearly marked hypotheses; the README states they need validation because the live app was not explored for this submission.
- **Part B:** The app has a blank Home tab and a mobile-first Discover tab with 35 complete mock profiles, drag swipes, desktop buttons, animations, feedback, persistent decisions, and a no-profiles-left state.
- **Matching/privacy:** Ten seeded profiles carry incoming likes for the demo. A match is only returned after the signed-in profile likes one back. Feed responses omit incoming-like metadata, and matches contain only mutual likes.
- **Safety:** Blocking hides a profile from that account's feed and matches. Reports require a selected reason, persist privately, and also block the profile. Block lists are isolated by demo account.
- **Personalization:** City and interest filters are validated by the API, persisted per demo account, and applied before profiles are returned. Interests use an “any selected interest” match.
- **Backend:** Express exposes `GET /feed`, `POST /swipe`, `GET /matches` (plus `/api` aliases), validates requests, and persists state in JSON or optional MongoDB storage.

## Two meaningful extra features

### 1. Privacy and safety controls

The profile **Safety options** menu lets a user block someone or report them for inappropriate content, a suspected fake profile, harassment, or another concern. A report immediately blocks the profile as well. Blocked people disappear from Discover and Matches, and can be reviewed or unblocked later in the **Safety Center**. These actions are saved per account, and no reporting identity or one-sided incoming like is exposed through the API. This gives the assignment's privacy promise a practical safety control and demonstrates backend validation, persistence, account isolation, and match cleanup. Reports are stored as demo data; there is no moderation queue or real Coy reporting service.

### 2. Saved discovery preferences

Each demo account can filter Discover by city and up to three interests. These preferences persist across reloads and are applied by the backend, while each account's choices remain isolated. Interest selections use “match any”; if no profile meets the saved filters, the empty state offers a clear path to preferences. This adds useful control for people with different location and interest priorities, and demonstrates validated, persisted user-specific product settings.

Matched-profile details and **Undo last swipe** remain as smaller usability additions. Undoing a like removes the match that depended on it.

## Requirements

Node.js 20 or later and npm. By default the app uses a local JSON data file. MongoDB is optional. Profile photos load from Unsplash, so an internet connection is needed to display them; the app itself runs locally.

## Run locally

```bash
npm install
Copy-Item .env.example .env   # PowerShell; optional because defaults are provided
npm run seed
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). The API listens at [http://localhost:4000](http://localhost:4000). The frontend reads `VITE_API_URL` from the same root `.env` file as the backend. Leave it blank to use the Vite `/api` proxy to `http://localhost:4000`; for a separately hosted API, set it to the backend origin (for example, `https://api.example.com`, with no trailing slash or `/api`). Restart the Vite dev server after changing it; production builds read this value when `npm run build` runs. Set the backend's `CLIENT_ORIGIN` to your deployed frontend origin for CORS. Vite exposes `VITE_*` values in browser code, so never put secrets in them. In bash, copy the backend environment template with `cp .env.example .env` instead. To run the production client build use `npm run build`; serve the built `client/dist` separately behind the API for deployment.

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

### `GET /api/auth/signup-options` and `POST /api/auth/signup`

The sign-up form asks for name, email, password, age (18+), city, bio, profile interests, and a demo photo. It also collects the initial discovery city and up to three preferred interests. The API validates each field, hashes the password, creates the profile and account together, saves the preferences, and signs the new user in. The generated ID is sequential (`p036` after the 35 seeded profiles) and is identical to the new profile ID; the sign-up confirmation and account panel show it. Duplicate email returns `409`.

### `GET /api/auth/me`

Returns the current authenticated user and their matching profile identity. Missing, invalid or expired tokens return `401`.

### `POST /api/auth/logout`

The **Log out** button is visible in the app header on desktop and mobile. This endpoint returns `{ "ok": true }`; the client then removes its locally stored token and returns to sign-in. The server remains stateless.

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

### `GET /api/preferences` and `PUT /api/preferences`

Preferences belong to the authenticated account. `GET` returns that account's saved city and interests plus the accepted options. `PUT` accepts `{ "city": "Pune", "interests": ["pottery", "art"] }`; use an empty city and empty interests to clear the filters. The API rejects unknown values or more than three interests. A city filter matches that city; selected interests match profiles with any one of those interests. Saved settings automatically affect `GET /feed`.

### `GET /matches` (`GET /api/matches`)

Returns only reciprocal likes: `{ "matches": [...] }`. It never returns one-sided incoming likes.

### `GET /api/health`

Returns `{ "status": "ok" }` for a basic health check.

### `GET /api/safety/blocked`

Returns only the authenticated user's blocked public profiles.

### `POST /api/safety/block`

Body: `{ "profileId": "p020" }`. Blocks a profile for this account. It is removed from the account's feed and matches. Repeating the same block is safe and idempotent.

### `POST /api/safety/report`

Body: `{ "profileId": "p020", "reason": "harassment" }`. Allowed reasons are `inappropriate_content`, `suspected_fake`, `harassment`, and `other`. The report is stored privately and the profile is blocked for the reporting account. The app does not disclose report records or reporter identity through a read API.

### `POST /api/safety/unblock`

Body: `{ "profileId": "p020" }`. Removes the authenticated user's block. Existing swipe decisions still apply, so unblocking a previously swiped profile does not put it back in Discover.

### `POST /api/reset`

Local demo utility that clears persisted swipes for the authenticated user. It is intended for the assignment demo; do not expose it publicly without appropriate authorization controls.

Errors use `{ "error": "..." }`. Browser requests are limited to the configured `CLIENT_ORIGIN` (default `http://localhost:5173`).

## Architecture and privacy notes

The client calls the Express API and never calculates reciprocity itself. Seed and sign-up passwords are stored using Node scrypt and per-user random salts; the API issues signed, expiring bearer tokens. Each account maps to a profile ID; the signed-in profile is displayed as the user's identity and filtered out of its own feed. Sign-up creates that profile, account, and discovery preferences together. Swipes, preferences, blocks and reports are scoped to the authenticated account. Preferences are validated server-side and applied before feed serialization. Blocking removes a profile from that account's matches as well as its feed. Reports are retained privately in demo storage and are not exposed by any report-list endpoint. JSON mode writes `server/data/state.json` through a temporary file followed by rename; MongoDB mode stores the demo state document in the configured collection. Feed serialization strips seed-only `likedYou` metadata. Match calculation is server-side and requires both a seeded incoming like and the current user's persisted `like` decision. This authentication and storage design is for local demonstration. Before public deployment, set a strong `AUTH_SECRET`, use HTTPS, move tokens to secure HttpOnly cookies or a carefully reviewed token strategy, add rate limiting and account lifecycle controls, and use transactional persistence for concurrent writes.

## Project structure

The app is split by responsibility: the client keeps its API access and reusable UI separate from the app shell, while the server keeps HTTP routes, request authentication, and persistence in distinct layers.

```text
coy-discover/
├── client/
│   └── src/
│       ├── components/
│       │   ├── auth/          Sign-in and profile creation UI
│       │   └── shared/        Reusable empty-state UI
│       ├── services/          Frontend API client, configurable with VITE_API_URL
│       ├── styles/            Base and mobile-first styles
│       ├── App.jsx            App state and screen composition
│       └── main.jsx           React entry point
├── server/
│   ├── data/                  Runtime JSON state (created on first run)
│   ├── src/
│   │   ├── data/              Fictional profile catalog
│   │   ├── middleware/        Authentication middleware
│   │   ├── routes/             Auth, discovery, and safety endpoints
│   │   ├── scripts/            Seed/reset commands
│   │   ├── services/           JSON/MongoDB state access
│   │   ├── app.js              Express app and route mounting
│   │   └── index.js            Server startup
│   └── test/                   API behavior and privacy tests
├── .env.example              Backend settings and VITE_API_URL
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
