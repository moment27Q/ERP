import pool from '../config/db.js';

// Infraestructura compartida por la subida masiva de catalogos
// (vehiculos, estibadores, choferes y clientes/proveedores).
//
// Flujo en dos pasos: preview valida cada fila sin escribir en la base de datos,
// importar inserta o actualiza segun la clave natural de cada tabla.
//
// Cada modulo declara un `config` con:
//   tabla, clave, columnaClave, etiquetaClave  -> identidad de la fila
//   normalizar(fila)                            -> fila limpia desde el Excel
//   validar(n, ctx)                            -> arreglo de errores
//   existeEnArchivo(n, ctx)                    -> duplicados dentro del archivo
//   insert() / update(clave)                   -> { sql, valores }

export const MAX_FILAS_IMPORTAR = 500;

const NUMERO_A_TEXTO = new Map(Array.from({ length: 10 }, (_, i) => [i, String(i)]));

export function limpia(v) {
  if (v == null) return '';
  if (typeof v === 'number' && NUMERO_A_TEXTO.has(v)) return NUMERO_A_TEXTO.get(v);
  return String(v).trim();
}

// Convierte a numero devolviendo null cuando la celda esta vacia.
// NaN queda disponible para que la validacion lo reporte como error.
export function numeroOpcional(v) {
  const s = limpia(v);
  if (s === '') return null;
  const n = Number(s.replace(/,/g, '.'));
  return Number.isFinite(n) ? n : NaN;
}

export function esUnico(err) {
  return err && err.code === '23505';
}

export function nombreRestriccionUnica(err) {
  if (!err) return '';
  if (err.constraint) return String(err.constraint);
  return err.detail ? String(err.detail) : '';
}

// Lee del cuerpo las filas a importar, rechazando entradas fuera de rango.
export function leerFilas(req, res) {
  const filas = Array.isArray(req.body && req.body.rows) ? req.body.rows : [];
  if (filas.length === 0) {
    res.status(400).json({ error: 'No se recibieron filas para importar' });
    return null;
  }
  if (filas.length > MAX_FILAS_IMPORTAR) {
    res.status(400).json({ error: `Máximo ${MAX_FILAS_IMPORTAR} filas por importación` });
    return null;
  }
  return filas;
}

// Cuenta, por clave, cuantas filas del archivo la repiten.
export function contarOcurrencias(normalizadas, clave) {
  const occ = new Map();
  for (const n of normalizadas) {
    const k = limpia(n[clave]);
    if (!k) continue;
    occ.set(k, (occ.get(k) || 0) + 1);
  }
  return occ;
}

// Cuantas filas del archivo comparten clave entre si.
export function contarDuplicadosEnArchivo(normalizadas, clave) {
  let duplicadas = 0;
  for (const [, c] of contarOcurrencias(normalizadas, clave)) if (c > 1) duplicadas += 1;
  return duplicadas;
}

// Consulta que claves ya existen en la tabla, para marcar "Actualizar" en la vista previa.
export async function cargarExistentes(config, claves) {
  const existentes = new Map();
  const unicas = [...new Set(claves.map(limpia).filter(Boolean))];
  if (unicas.length === 0) return existentes;
  const r = await pool.query(
    `SELECT ${config.columnaClave} AS clave FROM ${config.tabla} WHERE ${config.columnaClave} = ANY($1::text[])`,
    [unicas]
  );
  for (const x of r.rows) existentes.set(x.clave, true);
  return existentes;
}

// Prepara el lote normalizado junto con el contexto que usan los validadores.
export function prepararLote(config, filas) {
  const normalizadas = filas.map(config.normalizar);
  return { normalizadas, ctx: { ocurrencias: contarOcurrencias(normalizadas, config.clave), lote: normalizadas } };
}

function evaluarFila(config, n, ctx, existentes) {
  const errores = config.validar(n, ctx);
  if (typeof config.existeEnArchivo === 'function' && config.existeEnArchivo(n, ctx)) {
    errores.push(`El ${config.etiquetaClave} está duplicado dentro del archivo`);
  }
  const clave = limpia(n[config.clave]);
  const existe = clave ? existentes.has(clave) : false;
  return {
    clave,
    errores,
    valido: errores.length === 0,
    accion: errores.length > 0 ? 'ERROR' : (existe ? 'ACTUALIZAR' : 'INSERTAR'),
  };
}

// Responde el paso de validacion sin escribir nada en la base de datos.
export function responderPreview(config, normalizadas, ctx, existentes) {
  const resultados = normalizadas.map((n, i) => {
    const ev = evaluarFila(config, n, ctx, existentes);
    return { fila: i + 2, ...ev, datos: n };
  });

  return {
    total: resultados.length,
    validas: resultados.filter((r) => r.valido).length,
    invalidas: resultados.filter((r) => !r.valido).length,
    actualizar: resultados.filter((r) => r.accion === 'ACTUALIZAR').length,
    duplicadosEnArchivo: contarDuplicadosEnArchivo(normalizadas, config.clave),
    resultados,
  };
}

// Rechaza el lote completo si alguna fila es invalida, con el detalle por fila.
export function validarLoteCompleto(config, normalizadas, ctx, existentes) {
  const invalidas = [];
  for (let i = 0; i < normalizadas.length; i += 1) {
    const ev = evaluarFila(config, normalizadas[i], ctx, existentes);
    if (!ev.valido) invalidas.push({ fila: i + 2, clave: ev.clave, errores: ev.errores });
  }
  return invalidas;
}

// Aplica el lote en una transaccion: una fila problematica revierte toda la importacion.
// Se apoya en ON CONFLICT para que una carrera con otro usuario no rompa el lote.
export async function importarLote(config, normalizadas, existentes) {
  const client = await pool.connect();
  let insertados = 0;
  let actualizados = 0;
  try {
    await client.query('BEGIN');
    for (const n of normalizadas) {
      const clave = limpia(n[config.clave]);
      const stmt = existentes.has(clave) ? config.update(clave) : config.insert();
      const r = await client.query(stmt.sql, stmt.valores(n));
      if (existentes.has(clave)) actualizados += 1;
      else insertados += 1;
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    if (esUnico(err)) {
      const e = new Error(
        `No se pudo completar la importación: una fila choca con un ${config.etiquetaClave} ya registrado (${nombreRestriccionUnica(err) || 'restricción única'}).`
      );
      e.status = 409;
      throw e;
    }
    throw err;
  } finally {
    client.release();
  }
  return { insertados, actualizados };
}

export function mensajeResumen(insertados, actualizados, sustantivo) {
  const partes = [];
  if (insertados > 0) partes.push(`${insertados} nuevo(s)`);
  if (actualizados > 0) partes.push(`${actualizados} actualizado(s)`);
  return `Se importaron ${insertados + actualizados} ${sustantivo}: ${partes.join(' y ')}.`;
}