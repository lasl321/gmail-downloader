import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Email } from './gmail.js';

const MAX_NAME_LENGTH = 150;

function fileStem(subject: string): string {
  const stem = subject
    .replace(/[\/\\:*?"<>|\x00-\x1f]/g, '_')
    .trim()
    .slice(0, MAX_NAME_LENGTH)
    .trim();
  return stem === '' || /^\.+$/.test(stem) ? '(no subject)' : stem;
}

/** Writes each email to `<dir>/<subject>.txt` (`.html` if it has only an HTML body); returns the directory written to. */
export function saveEmailFiles(dir: string, emails: Email[]): string {
  mkdirSync(dir, { recursive: true });
  const used = new Set<string>();
  for (const e of [...emails].sort((a, b) => a.id.localeCompare(b.id))) {
    const htmlOnly = e.textBody.trim() === '' && e.htmlBody.trim() !== '';
    const ext = htmlOnly ? 'html' : 'txt';
    let name = `${fileStem(e.subject)}.${ext}`;
    if (used.has(name)) name = `${fileStem(e.subject)} (${e.id}).${ext}`;
    used.add(name);
    if (htmlOnly) {
      writeFileSync(join(dir, name), `<!-- Received: ${e.receivedAt} -->\n${e.htmlBody}`);
      continue;
    }
    const header = `From: ${e.from.name} <${e.from.email}>\nTo: ${e.to.name} <${e.to.email}>\nSubject: ${e.subject}\nReceived: ${e.receivedAt}\n\n`;
    writeFileSync(join(dir, name), header + e.textBody);
  }
  return dir;
}
