/** ===== gen_seed_sql.ts =====
 * 從 mockData.ts 產生 supabase/seed.sql，兩邊資料不會走鐘。
 * 用法：node --experimental-strip-types tools/gen_seed_sql.ts
 */
import { writeFileSync } from 'node:fs'
import { CLUBS, COURTS, PLAYERS } from '../src/lib/mockData.ts'

const q = (v: unknown): string => {
  if (v === null || v === undefined) return 'null'
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  if (typeof v === 'number') return String(v)
  // 陣列與物件都要當 jsonb 丟進去，否則 availability 會變成 '[object Object]'
  if (typeof v === 'object') return "'" + JSON.stringify(v).replace(/'/g, "''") + "'::jsonb"
  return "'" + String(v).replace(/'/g, "''") + "'"
}

function insert(table: string, rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return ''
  const cols = Object.keys(rows[0])
  const values = rows.map((r) => '  (' + cols.map((c) => q(r[c])).join(', ') + ')').join(',\n')
  return (
    'insert into ' + table + ' (' + cols.join(', ') + ') values\n' + values +
    '\non conflict (id) do nothing;\n\n'
  )
}

const sql =
  '-- ===== seed.sql =====\n' +
  '-- 由 tools/gen_seed_sql.ts 產生，不要手改。\n' +
  '-- 執行順序：先跑 schema.sql，再跑這一份。\n\n' +
  insert('clubs', CLUBS as unknown as Record<string, unknown>[]) +
  insert('courts', COURTS as unknown as Record<string, unknown>[]) +
  insert('players', PLAYERS as unknown as Record<string, unknown>[])

writeFileSync(new URL('../supabase/seed.sql', import.meta.url), sql)
console.log('已產生 supabase/seed.sql（' +
  (CLUBS.length + COURTS.length + PLAYERS.length) + ' 筆）')
