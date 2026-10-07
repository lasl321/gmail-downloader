#!/usr/bin/env node
import { Command } from 'commander';
import { fetchEmails } from './gmail.js';
import { getSavedIds, saveEmails } from './db.js';

interface Options {
  db: string;
  token: string;
  allMail?: boolean;
}

const program = new Command();

program
  .name('gmail-tool')
  .description('Download emails from a sender into SQLite and print them as JSON')
  .argument('<credentials>', 'path to the Google OAuth client JSON file')
  .argument('<sender>', 'email address or domain to look for (e.g. ziprecruiter.com)')
  .option('-d, --db <path>', 'SQLite file to write', 'emails.sqlite')
  .option('-t, --token <path>', 'where to cache the OAuth token', 'token.json')
  .option('--all-mail', 'search all mail instead of only the inbox')
  .action(async (credentials: string, sender: string, opts: Options) => {
    const query = `${opts.allMail ? '' : 'in:inbox '}from:${sender}`;
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
