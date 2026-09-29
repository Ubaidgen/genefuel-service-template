## What and why

<!-- One or two sentences. Link the ticket. -->

## Security checklist

<!-- Tick what applies; explain any "no" in a sentence. See docs/SECURITY.md. -->

- [ ] New routes use the default session auth, `@Roles(...)` or `@ServiceAuth(scope)` — any `@Public()` has a comment explaining why
- [ ] Every `:id` route checks ownership/role in `access.ts` and answers **404** for records the caller may not see
- [ ] Inputs are validated with a `.strict()` Zod schema with `max()` on every string/array
- [ ] Health data and member free text are encrypted with `FieldCrypto`
- [ ] Staff reads of member data and all writes record an audit event (no PII in `metadata`)
- [ ] Sensitive or expensive routes have a tighter `@Throttle`
- [ ] No secrets, tokens, emails or health values in logs, errors or audit metadata
- [ ] New env vars are added to `src/config/env.ts` (with production rules) and `.env.example`
- [ ] Security e2e tests cover 401 / 403 / 404 (IDOR) / 400 / 429 for new routes

## Database

- [ ] No schema change
- [ ] Migration generated with `npm run db:generate` and the SQL reviewed (locks, backfills, destructive changes)

## Verification

<!-- `npm run verify` output, integration tests, manual checks. -->
