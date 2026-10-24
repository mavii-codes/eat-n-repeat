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

Example login request:

```json
{
  "identifier": "admin",
  "password": "admin123"
}
```
