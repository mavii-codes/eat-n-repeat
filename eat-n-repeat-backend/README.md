# Eat n' Repeat backend

Express API with MySQL storage and JWT authentication.

## Run it

```bash
npm install
Copy-Item .env.example .env
npm run dev
```

The API starts at `http://localhost:4000`.

## Initial development account

The MySQL database and its `users` table are created automatically on first start. They include:

| Username | Password |
| --- | --- |
| `admin` | `admin123` |

Change this password before deploying. The password is hashed in MySQL; it is only shown here as the first-run development credential.

## Endpoints

- `GET /api/health`
- `POST /api/auth/login`
- `GET /api/auth/me` (requires `Authorization: Bearer <token>`)
- `GET|POST|PUT|DELETE /api/stock/categories` (requires authentication)
- `GET|POST|PUT|DELETE /api/stock/items` (requires authentication)
- `GET /api/menu/categories`, `GET /api/menu/items` (public — customer browsing)
- `POST|PUT /api/menu/categories[/:id]`, `POST /api/menu/categories/:id/archive|restore` (requires authentication)
- `POST|PUT /api/menu/items[/:id]`, `POST /api/menu/items/:id/archive|restore` (requires authentication)

## Deploy online (Render only)

Render does not offer managed MySQL, so this backend needs an externally
hosted MySQL database (e.g. Aiven free tier).

1. Create a MySQL database and copy its connection string:
   `mysql://user:password@host:port/eat_n_repeat`
2. Push this repo to GitHub.
3. Render dashboard: New > Blueprint > select the repo (reads `render.yaml`
   at the repo root). Fill in `DATABASE_URL` and the other `sync: false`
   secrets when prompted.
4. The build runs `prisma db push`, so all tables are created automatically.
5. After the first deploy, open Render > Shell and run the seed **once**:
   `npm run db:seed` (creates admin user, addons, default menu).
6. Back in Vercel (frontend): set `NEXT_PUBLIC_API_URL` to your Render URL,
   e.g. `https://eat-n-repeat-backend.onrender.com`, and redeploy.
   Make sure that same Vercel URL is listed in the backend's
   `CLIENT_ORIGIN`, otherwise browsers will block the calls (CORS).

Production start is `npm start` (`node dist/server.js` — the tsup bundle,
verified to boot; `GET /api/health` is the Render health check).

Example login request:

```json
{
  "identifier": "admin",
  "password": "admin123"
}
```
