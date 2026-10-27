#!/usr/bin/env node
import { Command, Option } from 'commander';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fetchEmails } from './gmail.js';
import { getEmailsByIds, getSavedIds, saveEmails } from './db.js';
import { saveEmailFiles } from './files.js';
import { renderTable, type Row } from './helpers/renderTable.js';

const DEFAULT_CREDENTIALS_PATH = join(homedir(), '.config', 'gmail-downloader', 'access.json');

const DEFAULT_DB_PATH = join(homedir(), '.config', 'gmail-downloader', 'emails.sqlite');

interface Options {
  sender: string[];
  credentials?: string;
  db?: string;
  token: string;
  saveFiles?: string;
}

const program = new Command();

program
  .name('gmail-downloader')
  .description('Download emails (from one or more senders, or all inbox emails if none) into SQLite and print them as a table')
  .option(
    '-s, --sender <address-or-domain>',
    'email address or domain to look for (e.g. ziprecruiter.com); repeat for multiple senders; omit to download everything in the inbox',
    (value: string, previous: string[]) => [...previous, value],
    [] as string[],
  )
  .option(
    '-c, --credentials <path>',
    `path to the Google OAuth client JSON file (default: ${DEFAULT_CREDENTIALS_PATH})`,
  )
  .option('-d, --db <path>', `SQLite file to write (default: ${DEFAULT_DB_PATH})`)
  .option('-t, --token <path>', 'where to cache the OAuth token', 'token.json')
  .addOption(
    new Option(
      '--save-files [dir]',
      'also save each email as <subject>.txt in <dir>/YYYY-MM-DD/ (includes emails already in SQLite)',
    ).preset('output'),
  )
  .action(async (opts: Options) => {
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
    const dbPath = opts.db ?? DEFAULT_DB_PATH;
    const froms = opts.sender.map((s) => `from:${s}`);
    const senderFilter = froms.length > 1 ? `{${froms.join(' ')}}` : (froms[0] ?? '');
    const query = `in:inbox ${senderFilter}`.trim();
    const { emails, skippedIds } = await fetchEmails({
      credentialsPath: credentials,
      tokenPath: opts.token,
      query,
      skipIds: getSavedIds(dbPath),
    });
    saveEmails(dbPath, emails);
    const all = [...emails, ...getEmailsByIds(dbPath, skippedIds)];
    if (opts.saveFiles) {
      const dir = join(opts.saveFiles, new Date().toLocaleDateString('sv-SE')); // YYYY-MM-DD in local time
      saveEmailFiles(dir, all);
      process.stderr.write(`Saved ${all.length} file(s) to ${dir}/\n`);
    }
    all.sort((a, b) => a.receivedAt.localeCompare(b.receivedAt));
    if (all.length) {
      const rows = all.map((e): Row => [
        new Date(e.receivedAt).toLocaleString('sv-SE').slice(0, 16), // YYYY-MM-DD HH:MM in local time
        e.from.email,
        e.subject,
      ]);
      process.stdout.write(renderTable(rows));
    }
  });

program.parseAsync().catch((err: unknown) => {
  process.stderr.write(`error: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
