#!/usr/bin/env node
import { Command } from 'commander';
import { fetchEmails } from './gmail.js';
import { getSavedIds, saveEmails } from './db.js';

interface Options {
  db: string;
  token: string;
  allMail?: boolean;
  label?: string;
  limitDate?: string;
}

const program = new Command();

program
  .name('gmail-downloader')
  .description('Download emails from a sender into SQLite and print them as JSON')
  .argument('<credentials>', 'path to the Google OAuth client JSON file')
  .argument('<sender>', 'email address or domain to look for (e.g. ziprecruiter.com)')
  .option('-d, --db <path>', 'SQLite file to write', 'emails.sqlite')
  .option('-t, --token <path>', 'where to cache the OAuth token', 'token.json')
  .option('--all-mail', 'search all mail instead of only the inbox')
  .option('-l, --label <name>', 'only search messages with this Gmail label (replaces the inbox scope)')
  .option('--limit-date <YYYY-MM-DD>', 'only search emails on or after this date')
  .action(async (credentials: string, sender: string, opts: Options) => {
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
    const emails = await fetchEmails({
      credentialsPath: credentials,
      tokenPath: opts.token,
      query,
      skipIds: getSavedIds(opts.db),
    });
    saveEmails(opts.db, emails);
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
