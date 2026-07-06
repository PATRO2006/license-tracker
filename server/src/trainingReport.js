// POSH Employee Training progress report.
// The bundled CSV is the default; on first boot it seeds the training_report
// table, after which the admin can replace it by uploading a new CSV.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CSV_PATH = path.join(__dirname, '..', 'assets', 'posh-training.csv');

function parseLine(line) {
  const out = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') inQ = false;
      else cur += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ',') { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

// Rows from the bundled CSV (used to seed the table on first run).
export function loadBundledRows() {
  try {
    const text = fs.readFileSync(CSV_PATH, 'utf-8').replace(/\r/g, '');
    const lines = text.split('\n').filter((l) => l.trim().length);
    return lines.slice(1).map((l) => {
      const [name, email, status, date] = parseLine(l);
      return { name: name || '', email: email || '', status: status || '', date: date || '' };
    });
  } catch (e) {
    console.error('[training-report] could not load CSV:', e.message);
    return [];
  }
}

// Summary + rows in the shape the frontend expects.
export function buildReportStats(rows) {
  const completed = rows.filter((r) => (r.status || '').trim().toLowerCase() === 'completed').length;
  return {
    title: 'POSH Employee Training',
    total: rows.length,
    completed,
    notCompleted: rows.length - completed,
    rows,
  };
}
