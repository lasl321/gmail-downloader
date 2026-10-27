export type Row = [received: string, from: string, subject: string];

export function renderTable(rows: Row[]): string {
  const all: Row[] = [['Received', 'From', 'Subject'], ...rows];
  const w0 = Math.max(...all.map((r) => r[0].length));
  const w1 = Math.max(...all.map((r) => r[1].length));
  let w2 = Math.max(...all.map((r) => r[2].length));
  // On a terminal, shrink the subject column so lines don't wrap.
  if (process.stdout.columns) w2 = Math.max('Subject'.length, Math.min(w2, process.stdout.columns - w0 - w1 - 10));
  const fit = (text: string, w: number) => (text.length > w ? `${text.slice(0, w - 1)}…` : text).padEnd(w);
  const line = ([a, b, c]: Row) => `│ ${fit(a, w0)} │ ${fit(b, w1)} │ ${fit(c, w2)} │`;
  const rule = (l: string, m: string, r: string) =>
    l + [w0, w1, w2].map((w) => '─'.repeat(w + 2)).join(m) + r;
  const [header, ...body] = all;
  return [rule('┌', '┬', '┐'), line(header!), rule('├', '┼', '┤'), ...body.map(line), rule('└', '┴', '┘')].join('\n') + '\n';
}
