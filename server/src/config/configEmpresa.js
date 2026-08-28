import pool from './db.js';

let cache = null;
let cacheTime = 0;
const TTL = 30000;

export async function getEmpresaActiva(force = false) {
  if (!force && cache && Date.now() - cacheTime < TTL) return cache;
  const result = await pool.query(
    `SELECT ruc, razon_social, nombre_comercial, cod_ubigeo, direccion, cod_tip_nif
     FROM config_empresa WHERE es_activa = TRUE ORDER BY id_config LIMIT 1`
  );
  if (result.rows.length === 0) {
    throw new Error('No hay una empresa configurada. Configure config_empresa antes de generar documentos.');
  }
  cache = result.rows[0];
  cacheTime = Date.now();
  return cache;
}

export async function getEmpresaConfig(ruc) {
  const result = await pool.query(
    `SELECT ruc, razon_social, nombre_comercial, cod_ubigeo, direccion, cod_tip_nif
     FROM config_empresa WHERE ruc = $1 LIMIT 1`,
    [ruc]
  );
  return result.rows[0] || null;
}

export function invalidarCacheEmpresa() {
  cache = null;
  cacheTime = 0;
}
