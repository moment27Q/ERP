import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const url = process.env.DATABASE_URL || process.argv[2];
if (!url) {
  console.error('Uso: DATABASE_URL="postgres://USER:PASS@HOST:PORT/DB" node applySchema.js');
  process.exit(1);
}

const client = new pg.Client({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();

  const schema = fs.readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), 'schema.sql'),
    'utf8'
  );
  console.log('Cargando schema.sql ...');
  await client.query(schema);
  console.log('Schema OK.');

  console.log('Seed roles / admin / empresa ...');
  await client.query(
    `INSERT INTO rol (nombre_rol) VALUES ('admin'), ('operador'), ('consulta')
     ON CONFLICT (nombre_rol) DO NOTHING`
  );
  await client.query(
    `INSERT INTO usuario (nombre_completo, usuario_login, contrasena_hash, id_rol, estado)
     SELECT 'Administrador', 'admin', $1, id_rol, 'activo'
     FROM rol WHERE nombre_rol='admin'
     ON CONFLICT (usuario_login) DO NOTHING`,
    ['$2b$10$tmmC5wxyT3ENfTZyx1a8qOkv8wMLhOqj9eiPT.URy3bEpBbXZIsNi']
  );
  await client.query(
    `INSERT INTO config_empresa (ruc, razon_social, nombre_comercial, cod_ubigeo, direccion, es_activa)
     VALUES ('20100100100', 'EMPRESA DEMO SAC', 'DEMO', '150101', 'JR. ANCASH NRO. 1050 INT. 1 - LIMA LIMA LIMA', true)`
  );
  console.log('Seed OK.');

  const t = await client.query(
    `SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY 1`
  );
  console.log('Tablas:', t.rows.map((r) => r.tablename).join(', '));
} catch (e) {
  console.error('ERROR:', e.message);
  process.exitCode = 1;
} finally {
  await client.end();
}