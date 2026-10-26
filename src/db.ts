import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { Email } from './gmail.js';

function openDb(path: string): DatabaseSync {
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`
    CREATE TABLE IF NOT EXISTS emails (
      gmail_id   TEXT PRIMARY KEY,
      from_name  TEXT NOT NULL,
      from_email TEXT NOT NULL,
      to_name    TEXT NOT NULL,
      to_email   TEXT NOT NULL,
      subject    TEXT NOT NULL,
      text_body  TEXT NOT NULL,
      html_body  TEXT NOT NULL DEFAULT '',
      received_at TEXT NOT NULL
    )
  `);
  return db;
}

export function getSavedIds(path: string): Set<string> {
  const db = openDb(path);
  try {
    return new Set(db.prepare('SELECT gmail_id FROM emails').all().map((r) => r['gmail_id'] as string));
  } finally {
    db.close();
  }
}

export function saveEmails(path: string, emails: Email[]): void {
  const db = openDb(path);
  const insert = db.prepare(
    `INSERT OR REPLACE INTO emails
       (gmail_id, from_name, from_email, to_name, to_email, subject, text_body, html_body, received_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  db.exec('BEGIN');
  try {
    for (const e of emails) {
      insert.run(e.id, e.from.name, e.from.email, e.to.name, e.to.email, e.subject, e.textBody, e.htmlBody, e.receivedAt);
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  } finally {
    db.close();
  }
}

export function getEmailsByIds(path: string, ids: Set<string>): Email[] {
  const db = openDb(path);
  try {
    return db
      .prepare('SELECT * FROM emails')
      .all()
      .filter((r) => ids.has(r['gmail_id'] as string))
      .map((r) => ({
        id: r['gmail_id'] as string,
        from: { name: r['from_name'] as string, email: r['from_email'] as string },
        to: { name: r['to_name'] as string, email: r['to_email'] as string },
        subject: r['subject'] as string,
        textBody: r['text_body'] as string,
        htmlBody: r['html_body'] as string,
        receivedAt: r['received_at'] as string,
      }));
  } finally {
    db.close();
  }
}
