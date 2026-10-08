# gmail-downloader

TypeScript CLI that downloads Gmail messages from a sender into SQLite and prints them as JSON. See `README.md` for setup and usage.

## Commands

- `npm run build` — compile `src/` to `dist/`
- `npm run typecheck` — type-check without emitting
- `npm start -- <credentials.json> <sender>` — build and run

There are no tests or linter; run `npm run typecheck` after changes.

## Notes

- ESM project (`"type": "module"`): relative imports use `.js` extensions.
- Requires Node >= 22.13 (`node:sqlite`, `Set.prototype.difference`).
- `local-auth` and `googleapis` bundle different `google-auth-library` versions; keep the credential-copy workaround in `src/gmail.ts` (see README).
- Never commit `token.json`, `*.sqlite` or `client_secret_*.json`.
