---
name: job-emails
description: Download job-related emails from LinkedIn, ZipRecruiter, and Built In with the gmail-downloader app, saving them to SQLite and as text files. Use when the user wants to pull, refresh, or sweep their job-board emails.
argument-hint: [after <YYYY-MM-DD>] [label <name> | all mail] [output <dir>]
---

# job-emails

Runs this repo's CLI once per job board, in order, using the `gmail-downloader` skill's conventions (run from the repo root, default credentials at `~/.config/gmail-downloader/access.json`).

## Senders

1. `linkedin.com`
2. `ziprecruiter.com`
3. `builtin.com`

## Run

Verify `~/.config/gmail-downloader/access.json` exists first. Then run the three commands sequentially (not in parallel: they share `emails.sqlite` and `token.json`). Send stdout to a scratch file, since each prints a table of every email considered; stderr carries the progress lines.

```bash
cd /Users/lasl321/code/gmail-downloader
for s in linkedin.com ziprecruiter.com builtin.com; do
  echo "== $s" >&2
  npm --silent start -- --sender "$s" --limit-date "$(date +%F)" --save-files [dir] [extra flags] > "<scratchpad>/$s.txt"
done
```

- **Today only:** `--limit-date` is always today's date (`date +%F`), so only emails from the current day are considered. Only if the user gives a different start date, pass that instead.
- **Output directory:** `--save-files` with no value writes to `output/YYYY-MM-DD/` (gitignored). Only if the user names a directory, pass it as `--save-files "<dir>"`. Files include emails already in SQLite.
- **`[extra flags]`** come from the user's arguments, applied to all three senders: `--label "<name>"` for a label, `--all-mail` for all mail. Otherwise none (inbox only).
- If one sender fails, report it and still run the others.

See the `gmail-downloader` skill for the full flag behavior; the first run may open a browser for OAuth consent.

## Reporting

Per sender: how many messages were found, how many were already saved, and the subjects (stdout lists all considered, new and cached; new = found minus already saved). Then the total number of files in `output/YYYY-MM-DD/`. Do not dump bodies unless asked.
