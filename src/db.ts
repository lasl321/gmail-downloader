import { DatabaseSync } from 'node:sqlite';
import type { Email } from './gmail.js';

function openDb(path: string): DatabaseSync {
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
      html_body  TEXT NOT NULL DEFAULT ''
    )
  `);
  // migrate databases created with the old single `body` column
  const cols = db.prepare('PRAGMA table_info(emails)').all().map((c) => c['name']);
  if (cols.includes('body')) db.exec('ALTER TABLE emails RENAME COLUMN body TO text_body');
  if (!cols.includes('html_body')) {
    db.exec(`ALTER TABLE emails ADD COLUMN html_body TEXT NOT NULL DEFAULT ''`);
  }
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
       (gmail_id, from_name, from_email, to_name, to_email, subject, text_body, html_body)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  db.exec('BEGIN');
  try {
    for (const e of emails) {
      insert.run(e.id, e.from.name, e.from.email, e.to.name, e.to.email, e.subject, e.textBody, e.htmlBody);
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  } finally {
    db.close();
  }
}
