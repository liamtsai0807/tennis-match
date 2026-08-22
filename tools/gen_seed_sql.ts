/** ===== gen_seed_sql.ts =====
 * 從 mockData.ts 產生 supabase/seed.sql，兩邊資料不會走鐘。
 * 用法：node --experimental-strip-types tools/gen_seed_sql.ts
 */
import { writeFileSync } from 'node:fs'
import { CLUBS, COURTS, PLAYERS } from '../src/lib/mockData.ts'

/** SQL 字串常值，單引號要成對跳脫。 */
const lit = (v: unknown): string => "'" + String(v).replace(/'/g, "''") + "'"

const q = (v: unknown): string => {
  if (v === null || v === undefined) return 'null'
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  if (typeof v === 'number') return String(v)
  // 陣列與物件都要當 jsonb 丟進去，否則 availability 會變成 '[object Object]'
  if (typeof v === 'object') return lit(JSON.stringify(v)) + '::jsonb'
  return lit(v)
}

/**
 * jsonb 欄位不能靠值的 JS 型別來決定怎麼輸出。level_answers 可能是物件，也可能是
 * 字串 'manual'——走上面的 q() 會輸出裸的 'manual'，Postgres 轉 jsonb 時直接
 * 報 22P02（invalid input syntax for type json）。這裡一律先 JSON.stringify 再 cast。
 */
const qJson = (v: unknown): string =>
  v === null || v === undefined ? 'null' : lit(JSON.stringify(v)) + '::jsonb'

function insert(
  table: string,
  rows: Record<string, unknown>[],
  jsonbCols: string[] = [],
): string {
  if (rows.length === 0) return ''
  const cols = Object.keys(rows[0])
  const values = rows
    .map((r) => '  (' + cols.map((c) => (jsonbCols.includes(c) ? qJson(r[c]) : q(r[c]))).join(', ') + ')')
    .join(',\n')
  return (
    'insert into ' + table + ' (' + cols.join(', ') + ') values\n' + values +
    '\non conflict (id) do nothing;\n\n'
  )
}

const sql =
  '-- ===== seed.sql =====\n' +
  '-- 由 tools/gen_seed_sql.ts 產生，不要手改。\n' +
  '-- supabase start / db reset 會在套完 migrations 之後自動跑這一份。\n\n' +
  insert('clubs', CLUBS as unknown as Record<string, unknown>[]) +
  insert('courts', COURTS as unknown as Record<string, unknown>[]) +
  insert('players', PLAYERS as unknown as Record<string, unknown>[],
    ['level_answers', 'availability', 'pref_club_ids'])

writeFileSync(new URL('../supabase/seed.sql', import.meta.url), sql)
console.log('已產生 supabase/seed.sql（' +
  (CLUBS.length + COURTS.length + PLAYERS.length) + ' 筆）')
