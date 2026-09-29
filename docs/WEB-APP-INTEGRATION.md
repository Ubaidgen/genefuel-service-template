# Calling a service from genefuel-web-app

Browsers never call a service directly. The web-app's server calls it:

```
Browser → genefuel-web-app (API route / server action) → service → web-app → browser
```

- **Member actions**: the web-app forwards the member's `cookie` header. The service verifies it by calling back `GET {AUTH_BASE_URL}/api/auth/me`.
- **System actions** (cron, admin jobs): the web-app sends a short-lived service token.

This avoids CORS and cross-domain cookies, and the service can stay on a private network.

## 1. Configuration

Service (`.env`):

```bash
SERVICE_NAME=lab-service
AUTH_BASE_URL=https://app.genefuel.co.uk     # must be reachable from the service
SERVICE_TOKEN_SECRET=<shared secret>
SERVICE_TOKEN_ISSUERS=genefuel-web-app
```

genefuel-web-app (server-only env, never `NEXT_PUBLIC_`):

```bash
LAB_SERVICE_URL=https://lab-service.internal
LAB_SERVICE_TOKEN_SECRET=<same shared secret>
```

## 2. Client (in genefuel-web-app)

`src/lib/services/lab-service-client.ts` (`jose` is already a web-app dependency):

```ts
import "server-only";
import { SignJWT } from "jose";

const BASE_URL = process.env.LAB_SERVICE_URL ?? "";
const SECRET = new TextEncoder().encode(process.env.LAB_SERVICE_TOKEN_SECRET ?? "");
const TIMEOUT_MS = 5_000;

/** Acts as the signed-in member: forwards their cookie; the service verifies it. */
export function callAsMember(path: string, cookie: string, init: RequestInit = {}) {
  return fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { ...init.headers, cookie, "content-type": "application/json" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
}

/** Acts as the web-app itself (cron, admin jobs), limited to the given scopes. */
export async function callAsService(path: string, scopes: string[], init: RequestInit = {}) {
  const token = await new SignJWT({ scope: scopes.join(" ") })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer("genefuel-web-app")
    .setSubject("genefuel-web-app")
    .setAudience("lab-service") // the service's SERVICE_NAME
    .setIssuedAt()
    .setExpirationTime("60s")
    .sign(SECRET);

  return fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { ...init.headers, authorization: `Bearer ${token}`, "content-type": "application/json" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
}
```

## 3. Member route (in genefuel-web-app)

```ts
// src/app/api/lab-orders/route.ts
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { callAsMember } from "@/lib/services/lab-service-client";

export async function GET() {
  const cookie = (await headers()).get("cookie") ?? "";
  const res = await callAsMember("/v1/lab-orders", cookie);
  return NextResponse.json(await res.json(), { status: res.status });
}
```

The frontend keeps calling `/api/lab-orders` on the web-app. The service does its own ownership checks, so the web-app does not repeat them.

## 4. System call (in genefuel-web-app)

```ts
await callAsService(`/v1/internal/lab-orders/${id}/archive`, ["lab-orders:archive"], { method: "POST" });
```

This works only on routes marked `@ServiceAuth("lab-orders:archive")`.

## Notes

- Service error bodies are `{ error: { code, message, requestId } }` and safe to pass through. Log the `requestId` to correlate with service logs.
- A `503` from the service means it could not reach `/api/auth/me`. Check `AUTH_BASE_URL` and network access.
- Sessions verified by the service are cached for `AUTH_SESSION_CACHE_TTL_MS` (15s by default). A sign-out takes effect in the service within that window.
- `USER_ROLES` in `src/core/auth/actor.ts` must match `USER_ROLES` in the web-app's `src/lib/db/schema.ts`.
