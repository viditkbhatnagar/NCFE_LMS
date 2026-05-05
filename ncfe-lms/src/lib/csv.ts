import { NextResponse } from 'next/server';

export function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function csvBody(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const head = headers.map(csvEscape).join(',');
  const body = rows.map((r) => r.map(csvEscape).join(',')).join('\n');
  return body ? `${head}\n${body}\n` : `${head}\n`;
}

export function csvResponse(filename: string, csv: string): NextResponse {
  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
