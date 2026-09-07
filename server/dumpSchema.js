import pool from './src/config/db.js';

async function q(sql, params) {
  return pool.query(sql, params);
}

const tables = (await q(
  `SELECT table_name FROM information_schema.tables
   WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name`
)).rows.map((r) => r.table_name);

let out = `-- Esquema generado automaticamente\n`;

const seqs = (
  await q(
    `SELECT sequencename, start_value, min_value, last_value, increment_by
     FROM pg_sequences WHERE schemaname='public' ORDER BY sequencename`
  )
).rows;

for (const s of seqs) {
  out += `\nCREATE SEQUENCE IF NOT EXISTS public.${s.sequencename}
  INCREMENT BY ${s.increment_by}
  MINVALUE ${s.min_value}
  START WITH ${s.last_value ?? s.start_value};`;
}

for (const t of tables) {
  const cols = (
    await q(
      `SELECT column_name, data_type, character_maximum_length, is_nullable, column_default
       FROM information_schema.columns
       WHERE table_schema='public' AND table_name=$1
       ORDER BY ordinal_position`,
      [t]
    )
  ).rows;

  if (!cols.length) continue;

  out += `\nCREATE TABLE IF NOT EXISTS public.${t} (\n`;
  const lines = cols.map((c) => {
    let tipo = c.data_type;
    if (['character varying', 'character'].includes(c.data_type)) tipo += `(${c.character_maximum_length})`;
    let def = '';
    if (c.column_default && c.column_default !== 'NULL') {
      def = ` DEFAULT ${c.column_default}`;
    }
    return `  ${c.column_name} ${tipo}${c.is_nullable === 'NO' ? ' NOT NULL' : ''}${def}`;
  });

  const pk = (
    await q(
      `SELECT kcu.column_name FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON tc.constraint_name = kcu.constraint_name
       WHERE tc.table_schema='public' AND tc.table_name=$1
         AND tc.constraint_type='PRIMARY KEY'
       ORDER BY kcu.ordinal_position`,
      [t]
    )
  ).rows;
  if (pk.length) lines.push(`  PRIMARY KEY (${pk.map((r) => r.column_name).join(', ')})`);

  out += `  ${lines.join(',\n')}\n);\n`;
}

// Indices (no unicos con PK/unique constraints)
const idxs = (
  await q(
    `SELECT indexname, indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY indexname`
  )
).rows;
for (const i of idxs) {
  if (i.indexdef.includes(' PRIMARY KEY') || i.indexdef.includes('UNIQUE INDEX')) continue;
  if (i.indexname.startsWith('idx') || i.indexname.includes('_idx')) {
    out += `\n${i.indexdef};\n`;
  }
}

pool.end();
console.log(out);