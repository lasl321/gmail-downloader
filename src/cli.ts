#!/usr/bin/env node
import { Command } from 'commander';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fetchEmails } from './gmail.js';
import { getEmailsByIds, getSavedIds, saveEmails } from './db.js';
import { saveEmailFiles } from './files.js';

const DEFAULT_CREDENTIALS_PATH = join(homedir(), '.config', 'gmail-downloader', 'access.json');

interface Options {
  credentials?: string;
  db: string;
  token: string;
  allMail?: boolean;
  label?: string;
  limitDate?: string;
  saveFiles?: boolean;
}

const program = new Command();

program
  .name('gmail-downloader')
  .description('Download emails from a sender into SQLite and print them as JSON')
  .argument('<sender>', 'email address or domain to look for (e.g. ziprecruiter.com)')
  .option(
    '-c, --credentials <path>',
    `path to the Google OAuth client JSON file (default: ${DEFAULT_CREDENTIALS_PATH})`,
  )
  .option('-d, --db <path>', 'SQLite file to write', 'emails.sqlite')
  .option('-t, --token <path>', 'where to cache the OAuth token', 'token.json')
  .option('--all-mail', 'search all mail instead of only the inbox')
  .option('-l, --label <name>', 'only search messages with this Gmail label (replaces the inbox scope)')
  .option('--limit-date <YYYY-MM-DD>', 'only search emails on or after this date')
  .option(
    '--save-files',
    'also save each email as <subject>.txt in a YYYY-MM-DD/ folder (includes emails already in SQLite)',
  )
  .action(async (sender: string, opts: Options) => {
    let credentials = opts.credentials;
    if (credentials === undefined) {
      if (!existsSync(DEFAULT_CREDENTIALS_PATH)) {
        throw new Error(
          `no credentials file: pass --credentials <path> or place the Google OAuth client JSON at ${DEFAULT_CREDENTIALS_PATH}`,
        );
      }
      credentials = DEFAULT_CREDENTIALS_PATH;
    } else if (!existsSync(credentials)) {
      throw new Error(`credentials file not found: ${credentials}`);
    }
    const scope = opts.label
      ? `label:"${opts.label.replaceAll('"', '')}" `
      : opts.allMail
        ? ''
        : 'in:inbox ';
    let dateFilter = '';
    if (opts.limitDate) {
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(opts.limitDate);
      const valid =
        m && new Date(`${opts.limitDate}T00:00:00Z`).toISOString().startsWith(opts.limitDate);
      if (!m || !valid) {
        throw new Error(`--limit-date must be a valid date in YYYY-MM-DD format, got "${opts.limitDate}"`);
      }
      dateFilter = ` after:${m[1]}/${m[2]}/${m[3]}`;
    }
    const query = `${scope}from:${sender}${dateFilter}`;
    const { emails, skippedIds } = await fetchEmails({
      credentialsPath: credentials,
      tokenPath: opts.token,
      query,
      skipIds: getSavedIds(opts.db),
    });
    saveEmails(opts.db, emails);
    if (opts.saveFiles) {
      const dir = new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD in local time
      const all = [...emails, ...getEmailsByIds(opts.db, skippedIds)];
      saveEmailFiles(dir, all);
      process.stderr.write(`Saved ${all.length} file(s) to ${dir}/\n`);
    }
    process.stdout.write(
      JSON.stringify(
        emails.map(({ from, to, subject, textBody, htmlBody }) => ({
          from,
          to,
          subject,
          textBody,
          htmlBody,
        })),
        null,
        2,
      ) + '\n',
    );
  });

program.parseAsync().catch((err: unknown) => {
  process.stderr.write(`error: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
