---
name: gmail-downloader
description: Download emails from a sender (email address or domain) via the Gmail API into SQLite and print them as JSON. Use when the user wants to fetch/download/search Gmail messages from a sender, given a Google OAuth client JSON file.
argument-hint: <client-json-path> <email-or-domain> [label <name> | all mail] [after <YYYY-MM-DD>]
---

# gmail-downloader

Runs this repo's CLI (`src/cli.ts`, built to `dist/cli.js`).

## Required inputs

1. **Client JSON file** (optional): path to the Google OAuth client secret JSON. If not given, the CLI uses `~/.config/gmail-downloader/access.json` and errors if that is missing too.
2. **Sender**: an email address (`jobs@example.com`) or domain (`example.com`).

The sender is optional: if the user wants all inbox emails (or gives no sender), omit it and the whole inbox is downloaded. If the user gives a client JSON path, verify it exists; otherwise verify `~/.config/gmail-downloader/access.json` exists.

## Scope (default: inbox only)

- No scope mentioned → inbox only (the CLI default; pass no scope flag).
- User names a Gmail label → `--label "<name>"` (replaces the inbox scope).
- User asks for all emails / all mail / everywhere → `--all-mail`.
- User gives a start date → `--limit-date YYYY-MM-DD` (emails on or after that date).
- User wants emails as text files → `--save-files [dir]` (`dir` defaults to `output` in the repo root; writes `<subject>.txt` into `<dir>/YYYY-MM-DD/` for today, including emails already in SQLite).

## Run

Run from the repo root (`/Users/lasl321/code/gmail-downloader`), because the default `--db` (`emails.sqlite`) and `--token` (`token.json`) paths are relative to the working directory. Use an absolute path for `--credentials`.

```bash
cd /Users/lasl321/code/gmail-downloader && npm --silent start -- ["<sender>"] [--credentials "<abs-path-to-client.json>"] [--label "<name>" | --all-mail] [--limit-date YYYY-MM-DD] [--save-files [dir]]
```

`npm start` builds first (`prestart`). Run `npm install` first only if `node_modules` is missing.

## Behavior to know about

- First run opens a browser for Google OAuth consent and caches the token in `token.json`. Warn the user that a browser window may open, and that a long-running command may be waiting on them.
- Emails already saved in `emails.sqlite` are skipped, so stdout contains only **new** emails (a JSON array of `{from, to, subject, textBody, htmlBody}`). An empty array means nothing new.
- Errors go to stderr with exit code 1.

## Reporting

Summarize results (count, senders, subjects) rather than dumping full bodies, unless the user asks for them. Mention that everything is stored in `emails.sqlite`.
