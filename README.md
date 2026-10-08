# gmail-downloader

A command-line tool that downloads emails from a given sender (or domain) through the Gmail API, saves them to a local SQLite database, and prints them as JSON.

Re-running is cheap: messages already in the database are skipped, so only new ones are downloaded.

## Requirements

- Node.js 22.13 or later (uses the built-in `node:sqlite` module, which prints an `ExperimentalWarning`)
- A Google account and a Google Cloud project with the Gmail API enabled

## Setup

### 1. Create OAuth credentials

1. Open the [Google Cloud Console](https://console.cloud.google.com/) and create (or select) a project.
2. Enable the **Gmail API** for the project (APIs & Services → Library).
3. Configure the OAuth consent screen. While the app is in "Testing" status, add your Google account as a test user.
4. Create credentials: APIs & Services → Credentials → **Create credentials → OAuth client ID**, with application type **Desktop app**.
5. Download the client JSON file (named like `client_secret_XXXX.json`). Files matching `client_secret_*.json` are git-ignored.

The tool requests the read-only scope `https://www.googleapis.com/auth/gmail.readonly`. It never modifies your mailbox.

### 2. Install and build

```
npm install
npm run build
```

## Usage

```
gmail-downloader [options] <credentials> <sender>
```

| Argument | Description |
| --- | --- |
| `credentials` | Path to the Google OAuth client JSON file |
| `sender` | Email address or domain to look for (e.g. `ziprecruiter.com`) |

| Option | Description |
| --- | --- |
| `-d, --db <path>` | SQLite file to write (default: `emails.sqlite`) |
| `-t, --token <path>` | Where to cache the OAuth token (default: `token.json`) |
| `--all-mail` | Search all mail instead of only the inbox |
| `-l, --label <name>` | Only search messages with this Gmail label (replaces the inbox scope) |
| `--limit-date <YYYY-MM-DD>` | Only search emails on or after this date |

Run it with `npm start --` (which builds first) or directly with `node dist/cli.js`:

```
# everything in the inbox from a domain
npm start -- client_secret_XXXX.json ziprecruiter.com

# one sender, anywhere in the mailbox, since a date
node dist/cli.js client_secret_XXXX.json jobs@example.com --all-mail --limit-date 2026-01-01

# only messages under a label, written to a custom database
node dist/cli.js client_secret_XXXX.json example.com --label "Professional/Jobs" -d jobs.sqlite
```

### First run

On the first run a browser window opens so you can authorize Gmail access. The resulting token is cached in `token.json` (mode `0600`) and reused on later runs. Delete the file to re-authorize. This needs a machine with a browser, so run it locally rather than in a headless container.

### Search behavior

The tool builds a Gmail search query from your options:

```
<scope> from:<sender> [after:YYYY/MM/DD]
```

where `<scope>` is `in:inbox` by default, nothing with `--all-mail`, or `label:"<name>"` with `--label`. `--label` takes precedence over `--all-mail`.

## Output

- **stdout:** a JSON array of the newly downloaded emails, each with `from`, `to`, `subject`, `textBody` and `htmlBody`. `from` and `to` are `{ "name", "email" }` objects holding the first sender and first recipient only.
- **stderr:** progress messages, e.g. `Found 42 message(s), 40 already saved`.
- **SQLite:** an `emails` table keyed by Gmail message ID:

  | Column | Type |
  | --- | --- |
  | `gmail_id` | TEXT, primary key |
  | `from_name`, `from_email` | TEXT |
  | `to_name`, `to_email` | TEXT |
  | `subject` | TEXT |
  | `text_body`, `html_body` | TEXT |

Since progress goes to stderr, you can pipe the JSON straight into other tools:

```
node dist/cli.js client_secret_XXXX.json example.com 2>/dev/null | jq '.[].subject'
```

## Development

```
npm run typecheck   # tsc --noEmit
npm run build       # compile src/ to dist/
```

Source layout:

- `src/cli.ts` — argument parsing and query construction
- `src/gmail.ts` — authentication, message search and fetching
- `src/db.ts` — SQLite storage
