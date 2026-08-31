import { Router } from 'express';
import { ZipArchive } from 'archiver';
import pool from '../config/db.js';
import { authMiddleware } from '../middleware/auth.js';
import * as mifact from '../config/mifactService.js';
import { validateGuiaBeforeMiFact } from '../config/grtValidator.js';
import { getEmpresaActiva } from '../config/configEmpresa.js';
import { estadoInternoDeRespuesta, estadoParaDocumento, mensajeErrorEntendible } from '../config/grtEstados.js';

const router = Router();
router.use(authMiddleware);

async function getGuiaGrtCompleta(idGuia) {
  const result = await pool.query(
    `SELECT g.*,
      cp.ruc AS proveedor_ruc, cp.razon_social AS proveedor_nombre, cp.direccion AS proveedor_direccion,
      cd.ruc AS destinatario_ruc, cd.razon_social AS destinatario_nombre, cd.direccion AS destinatario_direccion,
      ch.nombre_completo AS chofer_nombre, ch.placa_vehiculo, ch.dni AS chofer_dni, ch.licencia AS chofer_licencia,
      (SELECT d.factura FROM documento_cobro d WHERE d.numero_guia = g.numero_guia LIMIT 1) AS factura
    FROM guia_remision g
    LEFT JOIN cliente cp ON g.id_proveedor = cp.id_cliente
    LEFT JOIN cliente cd ON g.id_destinatario = cd.id_cliente
    LEFT JOIN chofer ch ON g.id_chofer = ch.id_chofer
    WHERE g.id_guia = $1`,
    [idGuia]
  );
  if (result.rows.length === 0) return null;
  const g = result.rows[0];
  g.items = g.items || null;
  g.vehiculos_secundarios = g.vehiculos_secundarios || [];
  g.conductores_secundarios = g.conductores_secundarios || [];
  g.docs_referenciado = g.docs_referenciado || [];
  return g;
}

async function getDocCompleto(idDocumento) {
  const result = await pool.query(
    `SELECT d.*,
      g.fecha AS guia_fecha, g.hora AS guia_hora, g.sector,
      g.cantidad, g.unidad, g.detalle, g.peso, g.tipo, g.orden,
      g.fecha_entrega, g.numero_guia,
      cp.ruc AS proveedor_ruc, cp.razon_social AS proveedor_nombre,
      cp.direccion AS proveedor_direccion, cp.fono AS proveedor_email,
      cd.ruc AS destinatario_ruc, cd.razon_social AS destinatario_nombre,
      cd.direccion AS destinatario_direccion,
      ch.nombre_completo AS chofer_nombre, ch.placa_vehiculo, ch.dni AS chofer_dni, ch.licencia AS chofer_licencia
    FROM documento_cobro d
    JOIN guia_remision g ON d.numero_guia = g.numero_guia
    LEFT JOIN cliente cp ON g.id_proveedor = cp.id_cliente
    LEFT JOIN cliente cd ON g.id_destinatario = cd.id_cliente
    LEFT JOIN chofer ch ON g.id_chofer = ch.id_chofer
    WHERE d.id_documento = $1`,
    [idDocumento]
  );
  return result.rows[0] || null;
}

async function getEmpresaParaDoc(doc) {
  try {
    const emp = await getEmpresaActiva();
    if (emp) {
      doc.TOKEN = doc.TOKEN || process.env.MIFACT_TOKEN;
      doc.cod_tip_nif = doc.cod_tip_nif || emp.cod_tip_nif || '6';
      doc.ruc = doc.ruc || emp.ruc;
      doc.razon_social = doc.razon_social || emp.razon_social;
      doc.cod_ubigeo = doc.cod_ubigeo || emp.cod_ubigeo;
      doc.nombre_comercial = doc.nombre_comercial || emp.nombre_comercial;
      doc.direccion = doc.direccion || emp.direccion;
    }
  } catch { /* noop */ }
  doc.emisor = doc.emisor || {};
  return doc;
}

function parseSerieCorrelativo(factura) {
  if (!factura) return { serie: 'F001', correlativo: '00000001' };
  const parts = factura.split('-');
  if (parts.length === 2) return { serie: parts[0], correlativo: parts[1] };
  const serie = factura.substring(0, 4);
  const correlativo = factura.substring(4);
  return { serie: serie || 'F001', correlativo: correlativo || '00000001' };
}

function correlativoValido(corr) {
  return /^\d{1,8}$/.test(toStr(corr));
}

function toStr(v) { return v == null ? '' : String(v); }
function siguienteCorrelativo(corr) {
  const n = (parseInt(toStr(corr), 10) || 0) + 1;
  return String(n).padStart(8, '0');
}

// Envia una sola guia a MiFact y actualiza su estado en BD.
// Devuelve { ok: true, result, estado_interno } o { ok: false, status, error, errores, estado_interno }.
async function enviarUnaGuia(idGuia) {
  const doc = await getGuiaGrtCompleta(idGuia);
  if (!doc) return { ok: false, status: 404, error: 'Guia no encontrada' };
  await getEmpresaParaDoc(doc);

  if (!doc.fecha) return { ok: false, status: 400, error: 'La guia no tiene fecha de emision.' };

  const correlativo = toStr(doc.numero_guia).replace(/[^0-9]/g, '').slice(-8).padStart(8, '0') || '00000001';
  const codTipGur = toStr(doc.cod_tip_gur) === '' ? '31' : toStr(doc.cod_tip_gur);
  doc.cod_tip_gur = codTipGur;
  const serie = toStr(doc.grt_serie) === '' ? (codTipGur === '09' ? 'T001' : 'V001') : toStr(doc.grt_serie);
  doc.grt_serie = serie;
  doc.grt_correlativo = correlativo;

  const validacion = validateGuiaBeforeMiFact(doc);
  if (!validacion.valid) {
    await pool.query('UPDATE guia_remision SET grt_estado = $1 WHERE id_guia = $2', ['VALIDANDO', idGuia]);
    return { ok: false, status: 422, error: 'La guia no cumple la validacion para MiFact', errores: validacion.errors, estado_interno: 'VALIDANDO' };
  }

  await pool.query('UPDATE guia_remision SET grt_estado = $1, grt_serie = $2, grt_correlativo = $3 WHERE id_guia = $4',
    ['LISTA_PARA_ENVIAR', serie, correlativo, idGuia]);

  let result;
  try {
    result = await mifact.sendGuiaRemision(doc);
  } catch (err) {
    await pool.query('UPDATE guia_remision SET grt_estado = $1 WHERE id_guia = $2', ['ERROR_ENVIO', idGuia]);
    return { ok: false, status: 502, error: 'No se pudo conectar con MiFact para enviar la guia.', detalle: err.message, estado_interno: 'ERROR_ENVIO' };
  }

  const esDuplicado = /ya existe|ya se encuentra|duplicad/i.test(result.errors || '');
  // Solo se reintenta la recuperación del PDF cuando el documento está en proceso (101),
  // no cuando fue rechazado (104) — en ese caso se responde el error de inmediato.
  const esProcesoReal = result.estado_documento === '101';

  if (esProcesoReal && !esDuplicado) {
    const reintentos = 3;
    for (let i = 0; i < reintentos; i++) {
      await new Promise((r) => setTimeout(r, 4000));
      let recur;
      try {
        recur = await mifact.getGuiaDocumento(serie, correlativo, 'pdf', doc.fecha || doc.guia_fecha);
      } catch {
        recur = null;
      }
      if (recur && (recur.pdf_bytes || recur.entrego_pdf === 'true' || recur.estado_documento === '102')) {
        result = { ...recur, reintentos_realizados: i + 1 };
        break;
      }
      if (i === reintentos - 1) {
        result = { ...result, reintentos_realizados: reintentos, error_recuperacion_pdf: 'No se pudo recuperar el PDF' };
      }
    }
  }

  if (esDuplicado) {
    result.mensaje_duplicado = `La guia ya fue enviada con serie ${serie}-${correlativo}. Genere una guia nueva con otro correlativo.`;
  }

  const estadoInterno = esDuplicado ? 'RECHAZADA' : estadoInternoDeRespuesta(result);
  const estadoDoc = esDuplicado ? 'error' : estadoParaDocumento(result);
  const respuesta = JSON.stringify(result);

  await pool.query(
    `UPDATE guia_remision SET
       grt_estado = $1, grt_respuesta = $2, numero_guia = $3, grt_correlativo = $4
     WHERE id_guia = $5`,
    [estadoInterno, respuesta, correlativo, correlativo, idGuia]
  );

  const amigable = mensajeErrorEntendible(result, 'GRT');
  return {
    ok: true,
    result: { ...result, estado_interno: estadoInterno, estado_documento_bd: estadoDoc, error_amigable: amigable, correlativo_enviado: `${serie}-${correlativo}` },
    estado_interno: estadoInterno,
  };
}

router.post('/guias/:id/enviar', async (req, res, next) => {
  try {
    const salida = await enviarUnaGuia(req.params.id);
    if (!salida.ok) {
      return res.status(salida.status || 500).json({ error: salida.error, detalle: salida.detalle, errores: salida.errores });
    }
    res.json(salida.result);
  } catch (err) { next(err); }
});

// Envio masivo: recibe un array de id_guia y envia cada una a MiFact.
// Responde siempre con un resumen por guia (sin abortar en la primera falla).
router.post('/guias/masivo/enviar', async (req, res, next) => {
  try {
    const { ids } = req.body || {};
    const lista = Array.isArray(ids) ? ids.map((x) => parseInt(toStr(x), 10)).filter((x) => !Number.isNaN(x)) : [];
    if (lista.length === 0) return res.status(400).json({ error: 'Debe indicar al menos una guia (ids).' });
    if (lista.length > 50) return res.status(400).json({ error: 'Maximo 50 guias por envio masivo.' });

    const resultados = [];
    for (const idGuia of lista) {
      let r;
      try {
        r = await enviarUnaGuia(idGuia);
      } catch (err) {
        await pool.query('UPDATE guia_remision SET grt_estado = $1 WHERE id_guia = $2', ['ERROR_ENVIO', idGuia]).catch(() => {});
        r = { ok: false, error: 'Error interno al enviar esta guia.', detalle: err.message, estado_interno: 'ERROR_ENVIO' };
      }
      const fila = await pool.query('SELECT id_guia, numero_guia, grt_estado FROM guia_remision WHERE id_guia = $1', [idGuia]).catch(() => ({ rows: [] }));
      const g = fila.rows[0] || {};
      if (r.ok) {
        resultados.push({
          id_guia: idGuia,
          numero_guia: g.numero_guia,
          ok: true,
          estado: r.estado_interno,
          correlativo_enviado: r.result.correlativo_enviado,
          pdf_bytes: r.result.pdf_bytes || null,
        });
      } else {
        resultados.push({
          id_guia: idGuia,
          numero_guia: g.numero_guia,
          ok: false,
          estado: r.estado_interno || g.grt_estado,
          error: r.error,
          detalle: r.detalle,
          errores: r.errores || null,
        });
      }
    }

    const enviadas = resultados.filter((x) => x.ok).length;
    res.json({ total: resultados.length, enviadas, fallidas: resultados.length - enviadas, resultados });
  } catch (err) { next(err); }
});

router.get('/guias/:id/preview', async (req, res, next) => {
  try {
    const doc = await getGuiaGrtCompleta(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Guia no encontrada' });
    await getEmpresaParaDoc(doc);
    doc.cod_tip_gur = toStr(doc.cod_tip_gur) === '' ? '31' : toStr(doc.cod_tip_gur);
    const validacion = validateGuiaBeforeMiFact(doc);
    const json = await mifact.buildGuiaTransportistaJson(doc);
    res.json({ valida: validacion.valid, errores: validacion.errors, json });
  } catch (err) { next(err); }
});

router.post('/enviar-factura/:id', async (req, res, next) => {
  try {
    const doc = await getDocCompleto(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Documento de cobro no encontrado' });
    if (!doc.factura) return res.status(400).json({ error: 'Debe tener un numero de factura para enviar' });

    const { serie, correlativo } = parseSerieCorrelativo(doc.factura);

    if (!correlativoValido(correlativo)) {
      return res.status(400).json({
        error: `Correlativo invalido '${correlativo}'. Debe ser numerico de hasta 8 digitos. Ej: ${serie}-00000083`,
      });
    }

    let result;
    let facturaEnviada = doc.factura;
    const maxReintentos = 10;

    for (let intento = 0; intento < maxReintentos; intento++) {
      result = await mifact.sendFactura({ ...doc, factura: facturaEnviada });

      const esDuplicado = /ya existe|ya se encuentra|duplicad/i.test(result.errors || '');
      if (esDuplicado) {
        const siguiente = siguienteCorrelativo(facturaEnviada.split('-').pop());
        facturaEnviada = `${serie}-${siguiente}`;
        result.correlativo_autogenerado = `${facturaEnviada} (duplicado, se genero nuevo)`;
        continue;
      }
      break;
    }

    await pool.query(
      `UPDATE documento_cobro SET
        sunat_status = $1, sunat_cdr = $2, sunat_response = $3,
        xml_base64 = $4, cdr_base64 = $5, sunat_hash = $6, factura = $7
       WHERE id_documento = $8`,
      [
        result.estado_documento === '102' || result.sunat_responsecode === '0' ? 'aceptado' : (result.errors ? 'error' : 'observado'),
        result.cdr_sunat || null,
        JSON.stringify(result),
        result.xml_enviado || null,
        result.cdr_sunat || null,
        result.codigo_hash || null,
        facturaEnviada,
        req.params.id,
      ]
    );

    res.json({ ...result, factura_enviada: facturaEnviada });
  } catch (err) { next(err); }
});

router.post('/enviar-guia/:id', async (req, res, next) => {
  try {
    const doc = await getDocCompleto(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Documento de cobro no encontrado' });

    const correlativo = doc.numero_guia.replace(/[^0-9]/g, '').slice(-8).padStart(8, '0');
    const serie = 'V001';

    let result;
    try {
      result = await mifact.sendGuiaRemision(doc);
    } catch (err) {
      return res.status(502).json({
        error: 'No se pudo conectar con MiFact para enviar la guia.',
        detalle: err.message,
      });
    }

    const esDuplicado = /ya existe|ya se encuentra|duplicad/i.test(result.errors || '');
    // Solo se reintenta la recuperación del PDF cuando el documento está en proceso (101),
    // no cuando fue rechazado (104) — en ese caso se responde el error de inmediato.
    const esProcesoReal = result.estado_documento === '101';

    if (esProcesoReal && !esDuplicado) {
      const reintentos = 3;
      for (let i = 0; i < reintentos; i++) {
        await new Promise((r) => setTimeout(r, 4000));
        let recur;
        try {
          recur = await mifact.getGuiaDocumento(serie, correlativo, 'pdf', doc.fecha || doc.guia_fecha);
        } catch {
          recur = null;
        }
        if (recur && (recur.pdf_bytes || recur.entrego_pdf === 'true' || recur.estado_documento === '102')) {
          result = { ...recur, reintentos_realizados: i + 1 };
          break;
        }
        if (i === reintentos - 1) {
          result = { ...result, reintentos_realizados: reintentos, error_recuperacion_pdf: 'No se pudo recuperar el PDF, generar nuevo correlativo' };
        }
      }
    }

    if (esDuplicado) {
      result.mensaje_duplicado = 'La guia ya fue enviada con este correlativo (serie V001-' + correlativo + '). No se reintenta: genera una guia nueva con otro correlativo.';
    }

    const accepted = result.estado_documento === '102' || result.sunat_responsecode === '0';
    const status = esDuplicado
      ? 'error'
      : accepted
        ? 'aceptado'
        : (result.errors ? 'error' : 'observado');
    await pool.query(
      `UPDATE documento_cobro SET
        sunat_status = $1, sunat_cdr = $2, sunat_response = $3,
        xml_base64 = $4, cdr_base64 = $5, sunat_hash = $6
       WHERE id_documento = $7`,
      [
        status,
        result.cdr_sunat || null,
        JSON.stringify(result),
        result.xml_enviado || null,
        result.cdr_sunat || null,
        result.codigo_hash || null,
        req.params.id,
      ]
    );

    res.json(result);
  } catch (err) { next(err); }
});

router.get('/estado-factura/:id', async (req, res, next) => {
  try {
    const doc = await getDocCompleto(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Documento no encontrado' });

    const { serie, correlativo } = parseSerieCorrelativo(doc.factura);
    const result = await mifact.getEstadoFactura(serie, correlativo, doc.guia_fecha);
    res.json(result);
  } catch (err) { next(err); }
});

router.get('/estado-guia/:id', async (req, res, next) => {
  try {
    const doc = await getDocCompleto(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Documento no encontrado' });

    const result = await mifact.getEstadoGuia('V001', doc.numero_guia.replace(/[^0-9]/g, '').slice(-8).padStart(8, '0'));
    res.json(result);
  } catch (err) { next(err); }
});

router.get('/descargar-factura/:id/:tipo', async (req, res, next) => {
  try {
    const doc = await getDocCompleto(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Documento no encontrado' });

    const tipo = req.params.tipo;
    if (!['pdf', 'xml', 'cdr'].includes(tipo)) {
      return res.status(400).json({ error: 'Tipo debe ser pdf, xml o cdr' });
    }

    const { serie, correlativo } = parseSerieCorrelativo(doc.factura);
    const result = await mifact.getFacturaDocumento(serie, correlativo, doc.guia_fecha, tipo);
    res.json(result);
  } catch (err) { next(err); }
});

router.get('/descargar-guia/:id/:tipo', async (req, res, next) => {
  try {
    const doc = await getDocCompleto(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Documento no encontrado' });

    const tipo = req.params.tipo;
    if (!['pdf', 'xml', 'cdr'].includes(tipo)) {
      return res.status(400).json({ error: 'Tipo debe ser pdf, xml o cdr' });
    }

    const correlativo = doc.numero_guia.replace(/[^0-9]/g, '').slice(-8).padStart(8, '0');
    const result = await mifact.getGuiaDocumento('V001', correlativo, tipo, doc.guia_fecha || doc.fecha);
    res.json(result);
  } catch (err) { next(err); }
});

// Descarga masiva: recibe un array de id_guia y devuelve un ZIP con los PDFs de
// las guias que ya fueron enviadas y aceptadas por MiFact. Las que no tengan PDF
// se omiten o se reportan en el ZIP segun corresponda.
router.post('/masivo/descargar-pdfs', async (req, res, next) => {
  try {
    const { ids } = req.body || {};
    const lista = Array.isArray(ids) ? ids.map((x) => parseInt(toStr(x), 10)).filter((x) => !Number.isNaN(x)) : [];
    if (lista.length === 0) return res.status(400).json({ error: 'Debe indicar al menos una guia (ids).' });
    if (lista.length > 100) return res.status(400).json({ error: 'Maximo 100 guias por descarga masiva.' });

    const filas = await pool.query(
      `SELECT g.*,
        cp.razon_social AS proveedor_nombre, cd.razon_social AS destinatario_nombre
       FROM guia_remision g
       LEFT JOIN cliente cp ON g.id_proveedor = cp.id_cliente
       LEFT JOIN cliente cd ON g.id_destinatario = cd.id_cliente
       WHERE g.id_guia = ANY($1::int[])`,
      [lista]
    );

    const aceptados = new Set(['ACEPTADO', 'ACEPTADA', 'FINALIZADO']);
    const buffer = [];
    const fallidos = [];

    for (const doc of filas.rows) {
      const estado = toStr(doc.grt_estado).toUpperCase();
      const correlativo = toStr(doc.numero_guia).replace(/[^0-9]/g, '').slice(-8).padStart(8, '0') || toStr(doc.grt_correlativo);
      const codTipGur = toStr(doc.cod_tip_gur) === '' ? '31' : toStr(doc.cod_tip_gur);
      const serie = toStr(doc.grt_serie) === '' ? (codTipGur === '09' ? 'T001' : 'V001') : toStr(doc.grt_serie);

      // Solo se intenta descargar guias que ya fueron aceptadas (o que conservan
      // un PDF almacenado de un envio previo exitoso).
      const esAceptada = aceptados.has(estado);

      let pdf = null;
      if (doc.grt_respuesta) {
        try {
          const parsed = typeof doc.grt_respuesta === 'string' ? JSON.parse(doc.grt_respuesta) : doc.grt_respuesta;
          if (parsed && parsed.pdf_bytes) pdf = parsed.pdf_bytes;
        } catch { /* noop */ }
      }

      if (!pdf && esAceptada) {
        try {
          const rec = await mifact.getGuiaDocumento(serie, correlativo, 'pdf', doc.fecha);
          if (rec && rec.pdf_bytes) pdf = rec.pdf_bytes;
        } catch { /* noop */ }
      }

      if (pdf) {
        buffer.push({ nombre: `${serie}-${correlativo}`, pdf });
      } else {
        fallidos.push({ id_guia: doc.id_guia, numero_guia: doc.numero_guia, estado: doc.grt_estado, motivo: 'Sin PDF disponible en MiFact o no aceptado' });
      }
    }

    if (buffer.length === 0) {
      return res.status(404).json({ error: 'Ninguna guia seleccionada tiene PDF disponible.', fallidos });
    }

    const zipNombre = `guias_pdf_${Date.now()}.zip`;
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${zipNombre}"`);

    const zip = new ZipArchive({ zlib: { level: 6 } });
    zip.on('error', (err) => next(err));
    zip.pipe(res);

    for (const item of buffer) {
      zip.append(Buffer.from(item.pdf, 'base64'), { name: `${item.nombre}.pdf` });
    }

    if (fallidos.length > 0) {
      zip.append(JSON.stringify(fallidos, null, 2), { name: '_sin_pdf.json' });
    }

    zip.finalize();
  } catch (err) { next(err); }
});

router.post('/enviar-email/:id', async (req, res, next) => {
  try {
    const doc = await getDocCompleto(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Documento no encontrado' });

    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email es requerido' });

    const { serie, correlativo } = parseSerieCorrelativo(doc.factura);
    const result = await mifact.enviarFacturaEmail(serie, correlativo, doc.guia_fecha, email);
    res.json(result);
  } catch (err) { next(err); }
});

router.post('/anular-factura/:id', async (req, res, next) => {
  try {
    const doc = await getDocCompleto(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Documento no encontrado' });

    const { serie, correlativo } = parseSerieCorrelativo(doc.factura);
    const result = await mifact.anularFactura(serie, correlativo, doc.guia_fecha, req.body.motivo);

    await pool.query(
      `UPDATE documento_cobro SET
        sunat_status = 'anulado', sunat_response = $1
       WHERE id_documento = $2`,
      [JSON.stringify(result), req.params.id]
    );

    res.json(result);
  } catch (err) { next(err); }
});

router.post('/anular-guia/:id', async (req, res, next) => {
  try {
    const doc = await getDocCompleto(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Documento no encontrado' });

    const correlativo = doc.numero_guia.replace(/[^0-9]/g, '').slice(-8).padStart(8, '0');
    const result = await mifact.anularGuia('V001', correlativo, req.body.motivo);

    await pool.query(
      `UPDATE documento_cobro SET
        sunat_status = 'anulado', sunat_response = $1
       WHERE id_documento = $2`,
      [JSON.stringify(result), req.params.id]
    );

    res.json(result);
  } catch (err) { next(err); }
});

router.post('/enviar-email-guia/:id', async (req, res, next) => {
  try {
    const doc = await getDocCompleto(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Documento no encontrado' });

    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email es requerido' });

    const correlativo = doc.numero_guia.replace(/[^0-9]/g, '').slice(-8).padStart(8, '0');
    const result = await mifact.enviarGuiaEmail('V001', correlativo, email);
    res.json(result);
  } catch (err) { next(err); }
});

export default router;
