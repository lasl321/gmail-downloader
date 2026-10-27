# gmail-downloader

A command-line tool that downloads emails from one or more senders (an address like `jobs@example.com` or a whole domain like `example.com`) using the Gmail API. Each email is:

- stored in a local SQLite file (`~/.config/gmail-downloader/emails.sqlite`), so later runs only fetch new messages,
- printed to stdout as a table, and
- optionally saved as a plain-text file (`--save-files`).

The tool is **read-only**: it requests only the `gmail.readonly` scope and never modifies or deletes your mail.

## Requirements

- Node.js 22.13 or newer
- A Google account with Gmail
- A Google OAuth client file (see below — you create this once, for free)

## 1. Install

```bash
npm install
```

## 2. Get a Google OAuth client file (one-time setup)

Google requires every app that reads Gmail to identify itself with an OAuth client. Since this tool runs on your own machine, you create your own client in the Google Cloud Console and download it as a JSON file. No paid license or billing is needed.

1. Go to <https://console.cloud.google.com/> and sign in with the Google account whose Gmail you want to download.
2. **Create a project**: click the project picker at the top, choose **New Project**, name it (e.g. `gmail-downloader`), and create it. Make sure it is selected.
3. **Enable the Gmail API**: open **APIs & Services → Library**, search for **Gmail API**, and click **Enable**.
4. **Configure the consent screen**: open **APIs & Services → OAuth consent screen** (in newer consoles: **Google Auth Platform**) and click **Get started**.
   - App name: anything (e.g. `gmail-downloader`); support email: your address.
   - Audience: **External** (choose **Internal** only if you are on a Google Workspace account and the mailbox belongs to your organization).
   - Contact email: your address. Accept the terms and create.
5. **Add yourself as a test user**: under **Audience** (or **OAuth consent screen → Test users**), click **Add users** and enter the Gmail address you will download from. While the app is in "Testing" status, only listed test users can authorize it.
6. **Create the client**: open **APIs & Services → Credentials → Create credentials → OAuth client ID**.
   - Application type: **Desktop app**.
   - Name: anything. Click **Create**.
7. Click **Download JSON** on the dialog (or the download icon next to the client in the Credentials list). You now have a file named like `client_secret_123456-abc.apps.googleusercontent.com.json`.

### Where to put the file

Either move it to the default location, which the tool checks automatically:

```bash
mkdir -p ~/.config/gmail-downloader
mv ~/Downloads/client_secret_*.json ~/.config/gmail-downloader/access.json
```

or keep it anywhere and pass `--credentials <path>` on every run.

Treat this file as a secret. It is already covered by `.gitignore` (`client_secret_*.json`), but don't commit or share it under another name.

## 3. Run it

```bash
npm start -- [options]
```

`npm start` compiles the TypeScript first. Add `--silent` (`npm --silent start -- ...`) to hide npm's own output so only the table appears on stdout. Progress messages go to stderr.

Examples:

```bash
# Every email in the inbox (no sender)
npm start

# All inbox emails from a domain
npm start -- --sender ziprecruiter.com

# Several senders at once (repeat --sender)
npm start -- --sender linkedin.com --sender ziprecruiter.com

# A single address, using a credentials file in another location
npm start -- --sender jobs@example.com --credentials ~/secrets/client_secret_abc.json

# Also write each email to output/
npm start -- --sender linkedin.com --save-files
```

### First run: authorizing access

The first time you run the tool, it opens your browser to a Google consent page.

1. Choose the Google account you added as a test user.
2. You will see **"Google hasn't verified this app."** This is expected — you created the app yourself. Click **Advanced → Go to <app name> (unsafe)**.
3. Approve **"View your email messages and settings"** (this is the read-only scope).
4. The browser says authentication succeeded; return to the terminal.

The resulting token is cached in `~/.config/gmail-downloader/token.json`, so later runs don't open the browser. Delete the token file to re-authorize or switch accounts.

> **Token expiry:** while your OAuth consent screen is in "Testing" status, Google expires the token after about 7 days. If you get an authorization error, delete the token file and run again to re-authorize.

## Options

| Option | Description |
| --- | --- |
| `-s, --sender <address-or-domain>` | Optional, repeatable. Email address or domain to search for (`from:` in Gmail). With several `--sender` flags, emails from any of them match. If omitted, all inbox emails are downloaded. |
| `-c, --credentials <path>` | Google OAuth client JSON. Default: `~/.config/gmail-downloader/access.json`. |
| `-d, --db <path>` | SQLite file to write. Default: `~/.config/gmail-downloader/emails.sqlite`. |
| `-t, --token <path>` | Where to cache the OAuth token. Default: `~/.config/gmail-downloader/token.json`. |
| `--save-files [dir]` | Also save each email as `<subject>.txt` (`.html` if it has only an HTML body) directly in `<dir>`. `dir` defaults to `output`. Includes emails already in SQLite. |

## Output

- **stdout**: a `console.table` (`Received` in local time, `From`, `Subject`, plus Node's leading `(index)` column) of every email considered in this run, including ones already in SQLite, sorted by receive date (oldest first). No output means nothing matched. Redirect it to keep it: `npm --silent start -- --sender example.com > emails.txt`.
- **`~/.config/gmail-downloader/emails.sqlite`** (or the `--db` path): every email downloaded so far. Re-running skips messages already stored, so it is safe to run repeatedly.
- **`output/*.txt`** (with `--save-files`): one text file per email, with `From`, `To`, `Subject`, and `Received` headers followed by the plain-text body. Emails with only an HTML body are saved as `.html` (with a leading `Received` comment). If two emails share a subject, the later file gets the Gmail message ID appended to its name.

`*.sqlite`, `token.json`, and `output/` are gitignored because they contain your personal email or credentials (the default locations under `~/.config/gmail-downloader/` are outside the repo anyway).

## Troubleshooting

- **`no credentials file`**: put the OAuth JSON at `~/.config/gmail-downloader/access.json` or pass `--credentials <path>`.
- **`Error 403: access_denied` in the browser**: the Google account isn't listed as a test user. Add it under the OAuth consent screen's test users (step 5).
- **`Gmail API has not been used in project ... or it is disabled`**: enable the Gmail API for the project (step 3), wait a minute, and retry.
- **Authorization suddenly fails after a few days**: delete the token file and re-run (see token expiry above).
