import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { google, type Auth } from 'googleapis';
import type { gmail_v1 } from 'googleapis';
import { authenticate } from '@google-cloud/local-auth';
import { simpleParser, type AddressObject } from 'mailparser';

const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];
const CONCURRENCY = 5;

export interface Person {
  name: string;
  email: string;
}

export interface Email {
  id: string;
  from: Person;
  to: Person;
  subject: string;
  textBody: string;
  htmlBody: string;
  /** When Gmail received the message, as an ISO 8601 UTC timestamp. */
  receivedAt: string;
}

export interface FetchResult {
  emails: Email[];
  /** IDs of matching messages that were in `skipIds` and so not fetched. */
  skippedIds: Set<string>;
}

export interface FetchOptions {
  credentialsPath: string;
  tokenPath: string;
  query: string;
  skipIds?: Set<string>;
}

/**
 * Copies OAuth credentials (access/refresh tokens, expiry, etc.) from the client returned by
 * `@google-cloud/local-auth` onto a client created by `googleapis`.
 *
 * `local-auth` bundles google-auth-library v9, while `googleapis` uses v11. Their `OAuth2Client`
 * classes are structurally incompatible, so the v9 client can't be passed to `google.gmail()`
 * without a type cast. The credentials themselves are plain data, so we transfer just those.
 *
 * @param credentials `credentials` of the v9 client returned by `authenticate()`.
 * @param target      Native `googleapis` (v11) client that will receive the credentials.
 */
function copyCredentials(credentials: Parameters<Auth.OAuth2Client['setCredentials']>[0], target: Auth.OAuth2Client): void {
  target.setCredentials(credentials);
}

async function getAuth(credentialsPath: string, tokenPath: string): Promise<Auth.OAuth2Client> {
  const keys = JSON.parse(await readFile(credentialsPath, 'utf8'));
  const { client_id, client_secret, redirect_uris } = keys.installed ?? keys.web;
  const client = new google.auth.OAuth2(client_id, client_secret, redirect_uris?.[0]);
  try {
    client.setCredentials(JSON.parse(await readFile(tokenPath, 'utf8')));
    return client;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
  }
  process.stderr.write('Opening browser to authorize Gmail access...\n');
  const { credentials } = await authenticate({ keyfilePath: credentialsPath, scopes: SCOPES });
  copyCredentials(credentials, client);
  await mkdir(dirname(tokenPath), { recursive: true });
  await writeFile(tokenPath, JSON.stringify(credentials), { mode: 0o600 });
  return client;
}

const person = (list: AddressObject | undefined): Person => {
  const first = list?.value?.[0];
  return { name: first?.name ?? '', email: first?.address ?? '' };
};

async function fetchOne(gmail: gmail_v1.Gmail, id: string): Promise<Email> {
  const { data } = await gmail.users.messages.get({ userId: 'me', id, format: 'raw' });
  const parsed = await simpleParser(Buffer.from(data.raw ?? '', 'base64url'));
  return {
    id,
    from: person(parsed.from),
    to: person(Array.isArray(parsed.to) ? parsed.to[0] : parsed.to),
    subject: parsed.subject ?? '',
    textBody: (parsed.text ?? '').replace(/\r\n/g, '\n'),
    htmlBody: (parsed.html || '').replace(/\r\n/g, '\n'),
    receivedAt: new Date(Number(data.internalDate)).toISOString(),
  };
}

export async function fetchEmails({
  credentialsPath,
  tokenPath,
  query,
  skipIds = new Set(),
}: FetchOptions): Promise<FetchResult> {
  const auth = await getAuth(credentialsPath, tokenPath);
  const gmail = google.gmail({ version: 'v1', auth });

  const ids = new Set<string>();
  let pageToken: string | undefined;
  do {
    const { data }: { data: gmail_v1.Schema$ListMessagesResponse } = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults: 500,
      pageToken,
    });
    for (const m of data.messages ?? []) if (m.id) ids.add(m.id);
    pageToken = data.nextPageToken ?? undefined;
  } while (pageToken);

  const newIds = [...ids.difference(skipIds)];
  const skippedIds = ids.intersection(skipIds);
  process.stderr.write(
    `Found ${ids.size} message(s), ${ids.size - newIds.length} already saved\n`,
  );

  const emails: Email[] = [];
  for (let i = 0; i < newIds.length; i += CONCURRENCY) {
    const batch = newIds.slice(i, i + CONCURRENCY);
    emails.push(...(await Promise.all(batch.map((id) => fetchOne(gmail, id)))));
  }
  return { emails, skippedIds };
}
