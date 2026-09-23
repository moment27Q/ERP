import { Router } from 'express';
import pool from '../config/db.js';
import { authMiddleware } from '../middleware/auth.js';
import { esUbigeoValido } from '../config/catalogos/ubigeos.js';
import { esMotivoValido } from '../config/catalogos/motivoTraslado.js';
import { validarNumeroPorTipo } from '../config/catalogos/tipoIdentificacion.js';
import { esModalidadValida } from '../config/catalogos/modalidadTransporte.js';

const router = Router();
router.use(authMiddleware);

const MAX_FILAS_IMPORTAR = 500;

const limpia = (v) => (v == null ? '' : String(v).trim());

const tipoDocPorNumero = (num) => (limpia(num).length === 11 ? '6' : '1');

function esFechaValida(s) {
  const [y, m, d] = limpia(s).split('T')[0].split('-').map(Number);
  if (![y, m, d].every(Number.isInteger)) return false;
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

const esHoraValida = (s) => /^([01]\d|2[0-3]):[0-5]\d$/.test(limpia(s));

const numeroOpcional = (v) => {
  const s = limpia(v);
  if (s === '') return null;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : NaN;
};

function normalizarFila(fila) {
  const row = fila || {};
  const get = (k) => limpia(row[k]);
  const rucRem = get('ruc_remitente');
  const rucDest = get('ruc_destinatario');
  const dniCond = get('dni_conductor');
  const dniEstib = get('dni_estibador');
  let modalidadInterna = null;
  const rawMod = get('modalidad_transporte') || get('tipo_transporte');
  if (rawMod === '1' || rawMod === '01') modalidadInterna = 1;
  else if (rawMod === '2' || rawMod === '02') modalidadInterna = 2;

  const limpiaItem = (k) => limpia(k);
  const itemsRaw = Array.isArray(row.items) ? row.items : [];
  const itemsNorm = itemsRaw
    .map((it, idx) => ({
      num_linea: limpiaItem(it.num_linea) || String(idx + 1),
      cod_item: limpiaItem(it.cod_item),
      descripcion: limpiaItem(it.descripcion),
      unidad_medida: limpiaItem(it.unidad_medida) || 'NIU',
      cantidad: numeroOpcional(it.cantidad),
      peso_item: numeroOpcional(it.peso_item),
      cod_partida_arancelaria: limpiaItem(it.cod_partida_arancelaria),
      cod_producto_sunat: limpiaItem(it.cod_producto_sunat),
      bien_normalizado: numeroOpcional(it.bien_normalizado) === 1 ? 1 : 0,
    }))
    .filter((it) => it.cod_item || it.descripcion || (it.cantidad !== null && !Number.isNaN(it.cantidad)) || (it.peso_item !== null && !Number.isNaN(it.peso_item)));

  const confItems = itemsNorm.map((it) => ({
    NUM_LINEA: it.num_linea,
    COD_ITEM: it.cod_item,
    DESC_ITEM: it.descripcion,
    CANT_ITEM: it.cantidad != null ? String(it.cantidad) : '',
    PESO_ITEM: it.peso_item != null ? String(it.peso_item) : '',
    INDICADOR_BIEN_NORMALIZADO_ITEM: it.bien_normalizado,
    ...(it.unidad_medida ? { UNIDAD_MEDIDA: it.unidad_medida } : {}),
    ...(it.cod_partida_arancelaria ? { COD_PARTIDA_ARANCELARIA: it.cod_partida_arancelaria } : {}),
    ...(it.cod_producto_sunat ? { COD_PRODUCTO_SUNAT: it.cod_producto_sunat } : {}),
  }));

  const sumaCantItems = itemsNorm.reduce((s, it) => s + (Number.isFinite(it.cantidad) ? it.cantidad : 0), 0);
  const sumaPesoItems = itemsNorm.reduce((s, it) => s + (Number.isFinite(it.peso_item) ? it.peso_item : 0), 0);

  return {
    numero_guia: get('numero_guia'),
    fecha: get('fecha'),
    hora: get('hora'),
    fecha_traslado: get('fecha_traslado'),
    cod_motivo_traslado: get('cod_motivo_traslado'),
    modalidad_transporte: modalidadInterna,
    tipo_transporte: modalidadInterna,
    peso_bruto: numeroOpcional(get('peso_bruto')),
    unidad_peso_bruto: get('unidad_peso_bruto') || 'KGM',
    nro_bultos: get('nro_bultos'),
    pagador_flete: get('pagador_flete') || 'R',
    sector: get('sector'),
    tipo: get('tipo'),
    orden: get('orden'),
    suma: numeroOpcional(get('suma')),
    observaciones: get('observaciones'),
    tipo_doc_remitente: rucRem ? tipoDocPorNumero(rucRem) : '',
    num_doc_remitente: rucRem,
    razon_social_remitente: get('razon_social_remitente'),
    dir_partida: get('dir_partida'),
    distrito_partida: get('distrito_partida'),
    ubigeo_partida: get('ubigeo_partida'),
    tipo_doc_destinatario: rucDest ? tipoDocPorNumero(rucDest) : '',
    num_doc_destinatario: rucDest,
    razon_social_destinatario: get('razon_social_destinatario'),
    dir_llegada: get('dir_llegada'),
    distrito_llegada: get('distrito_llegada'),
    ubigeo_llegada: get('ubigeo_llegada'),
    tipo_doc_transp: get('ruc_transportista') ? tipoDocPorNumero(get('ruc_transportista')) : '',
    num_doc_transp: get('ruc_transportista'),
    razon_social_transp: get('razon_social_transportista'),
    tipo_doc_conductor: dniCond ? '1' : '',
    num_doc_conductor: dniCond,
    nombre_conductor: get('nombre_conductor'),
    nro_licencia_conduct: get('nro_licencia_conductor'),
    placa: get('placa'),
    dni_estibador: dniEstib,
    nombre_estibador: get('nombre_estibador'),
    items: confItems,
    items_cantidad_total: itemsNorm.length ? sumaCantItems : null,
    items_peso_total: itemsNorm.length ? sumaPesoItems : null,
    items_detalle: itemsNorm.length
      ? itemsNorm.map((it) => it.descripcion).filter(Boolean).join(', ').slice(0, 250)
      : '',
  };
}

function validarFilaNormalizada(n, ctx) {
  const errores = [];
  if (!n.numero_guia) {
    errores.push('N° de guía es obligatorio');
  } else {
    if (n.numero_guia.length > 30) errores.push('N° de guía no puede superar 30 caracteres');
    if (ctx.numerosEnArchivo.has(n.numero_guia)) errores.push('N° de guía duplicado en el archivo');
    if (ctx.existentesGuia.has(n.numero_guia)) errores.push('El N° de guía ya existe en el sistema');
  }
  if (!n.fecha) errores.push('Fecha es obligatoria');
  else if (!esFechaValida(n.fecha)) errores.push('Fecha inválida (use AAAA-MM-DD)');
  if (!n.hora) errores.push('Hora es obligatoria');
  else if (!esHoraValida(n.hora)) errores.push('Hora inválida (use HH:MM)');

  if (!n.num_doc_remitente) errores.push('RUC/DNI del remitente es obligatorio');
  else if (!validarNumeroPorTipo(n.tipo_doc_remitente, n.num_doc_remitente)) errores.push('RUC/DNI del remitente inválido');
  if (!ctx.clientesByRuc.has(n.num_doc_remitente) && !n.razon_social_remitente) {
    errores.push('Razón social del remitente es obligatoria (el cliente se creará nuevo)');
  }

  if (!n.num_doc_destinatario) errores.push('RUC/DNI del destinatario es obligatorio');
  else if (!validarNumeroPorTipo(n.tipo_doc_destinatario, n.num_doc_destinatario)) errores.push('RUC/DNI del destinatario inválido');
  if (!ctx.clientesByRuc.has(n.num_doc_destinatario) && !n.razon_social_destinatario) {
    errores.push('Razón social del destinatario es obligatoria (el cliente se creará nuevo)');
  }

  if (n.ubigeo_partida && !esUbigeoValido(n.ubigeo_partida)) errores.push('Ubigeo de partida inválido');
  if (n.ubigeo_llegada && !esUbigeoValido(n.ubigeo_llegada)) errores.push('Ubigeo de llegada inválido');
  if (n.cod_motivo_traslado && !esMotivoValido(n.cod_motivo_traslado)) errores.push('Motivo de traslado inválido');
  if (n.modalidad_transporte !== null && !esModalidadValida(n.modalidad_transporte)) errores.push('Modalidad de transporte inválida (1 público, 2 privado)');
  if (n.fecha_traslado && !esFechaValida(n.fecha_traslado)) errores.push('Fecha de traslado inválida');
  if (n.peso_bruto !== null && Number.isNaN(n.peso_bruto)) errores.push('Peso bruto inválido (use número)');
  else if (n.peso_bruto !== null && n.peso_bruto < 0) errores.push('Peso bruto no puede ser negativo');
  if (n.suma !== null && Number.isNaN(n.suma)) errores.push('Suma inválida (use número)');
  if (n.pagador_flete && !['R', 'C', 'V', 'V1', 'V2'].includes(n.pagador_flete)) errores.push('Pagador de flete inválido (R, C, V, V1 o V2)');

  if (n.num_doc_conductor) {
    if (!validarNumeroPorTipo('1', n.num_doc_conductor)) errores.push('DNI del conductor inválido (8 dígitos)');
    if (!ctx.choferesByDni.has(n.num_doc_conductor) && !n.nombre_conductor) {
      errores.push('Nombre del conductor es obligatorio (el conductor se creará nuevo)');
    }
  }
  if (n.dni_estibador) {
    if (!validarNumeroPorTipo('1', n.dni_estibador)) errores.push('DNI del estibador inválido (8 dígitos)');
    if (!ctx.estibadoresByDni.has(n.dni_estibador) && !n.nombre_estibador) {
      errores.push('Nombre del estibador es obligatorio (el estibador se creará nuevo)');
    }
  }

  if (Array.isArray(n.items) && n.items.length > 0) {
    n.items.forEach((it, i) => {
      const cod = limpia(it.COD_ITEM || '');
      const desc = limpia(it.DESC_ITEM || '');
      const cant = limpia(it.CANT_ITEM || '');
      const pes = limpia(it.PESO_ITEM || '');
      const campo = `Item ${i + 1} (${n.numero_guia || 'guía'}):`;
      if (!cod) errores.push(`${campo} código del producto es obligatorio`);
      if (!desc) errores.push(`${campo} descripción del producto es obligatoria`);
      if (!cant || Number.isNaN(parseFloat(cant))) errores.push(`${campo} cantidad inválida`);
      if (!pes || Number.isNaN(parseFloat(pes))) errores.push(`${campo} peso inválido`);
    });
  }

  const creara = {
    proveedor: !!n.num_doc_remitente && !ctx.clientesByRuc.has(n.num_doc_remitente),
    destinatario: !!n.num_doc_destinatario && !ctx.clientesByRuc.has(n.num_doc_destinatario),
    chofer: !!n.num_doc_conductor && !ctx.choferesByDni.has(n.num_doc_conductor),
    estibador: !!n.dni_estibador && !ctx.estibadoresByDni.has(n.dni_estibador),
  };
  return { valido: errores.length === 0, errores, creara };
}

async function construirContextoImport(normalizadas) {
  const nums = new Set();
  for (const n of normalizadas) if (n.numero_guia) nums.add(n.numero_guia);
  const numerosEnArchivo = nums;

  const existentesGuia = new Set();
  if (nums.size > 0) {
    const r = await pool.query('SELECT numero_guia FROM guia_remision WHERE numero_guia = ANY($1::text[])', [[...nums]]);
    r.rows.forEach((x) => existentesGuia.add(x.numero_guia));
  }

  const rucs = [...new Set([...normalizadas.flatMap((n) => [n.num_doc_remitente, n.num_doc_destinatario])].filter(Boolean))];
  const clientesByRuc = new Map();
  if (rucs.length > 0) {
    const r = await pool.query('SELECT id_cliente, ruc, razon_social FROM cliente WHERE ruc = ANY($1::text[])', [rucs]);
    r.rows.forEach((x) => clientesByRuc.set(x.ruc, x.id_cliente));
  }

  const dnis = [...new Set([...normalizadas.flatMap((n) => [n.num_doc_conductor, n.dni_estibador])].filter(Boolean))];
  const choferesByDni = new Map();
  const estibadoresByDni = new Map();
  if (dnis.length > 0) {
    const [ch, es] = await Promise.all([
      pool.query('SELECT id_chofer, dni FROM chofer WHERE dni = ANY($1::text[])', [dnis]),
      pool.query('SELECT id_estibador, dni FROM estibador WHERE dni = ANY($1::text[])', [dnis]),
    ]);
    ch.rows.forEach((x) => choferesByDni.set(x.dni, x.id_chofer));
    es.rows.forEach((x) => estibadoresByDni.set(x.dni, x.id_estibador));
  }

  return { numerosEnArchivo, existentesGuia, clientesByRuc, choferesByDni, estibadoresByDni };
}

const GRT_COLUMNS = [
  'fecha_traslado', 'tipo_transporte', 'peso_bruto', 'unidad_peso_bruto',
  'dir_partida', 'distrito_partida', 'ubigeo_partida',
  'dir_llegada', 'distrito_llegada', 'ubigeo_llegada',
  'tipo_doc_remitente', 'num_doc_remitente', 'razon_social_remitente',
  'destinatario_mismo_remitente', 'tipo_doc_destinatario', 'num_doc_destinatario', 'razon_social_destinatario',
  'traslado_total_bienes', 'transporte_subcontratado', 'retorno_envases_vacios',
  'retorno_vehiculo_vacio', 'transbordo_programado', 'pagador_flete',
  'nro_registro_mtc', 'entidad_emisora_aut_transportista', 'nro_autorizacion_especial_emisora',
  'tipo_doc_transp', 'num_doc_transp', 'razon_social_transp',
  'items', 'vehiculos_secundarios', 'conductores_secundarios', 'docs_referenciado',
  'observaciones', 'grt_serie', 'grt_correlativo', 'grt_estado', 'grt_respuesta',
  'placa', 'constancia_tuc', 'entidad_emisora_aut_vehiculo', 'nro_autorizacion_especial_vehiculo',
  'tipo_doc_conductor', 'num_doc_conductor', 'nombre_conductor', 'nro_licencia_conduct',
  'cod_tip_gur', 'cod_motivo_traslado', 'modalidad_transporte',
  'indicador_m1_l', 'indicador_traslado_total_dam_ds', 'peso_trasladado_parcial_dam_ds',
  'nro_bultos', 'nro_contenedor', 'num_nif_llegada_partida',
  'cod_puerto_aeropuerto', 'cod_locacion_puerto_aeropuerto', 'nombre_puerto_aeropuerto',
];

function prepararValor(col, v) {
  if (v === undefined || v === null) return null;
  if (['fecha', 'hora', 'fecha_traslado', 'fecha_entrega'].includes(col) && String(v).trim() === '') return null;
  if (['items', 'vehiculos_secundarios', 'conductores_secundarios', 'docs_referenciado', 'grt_respuesta'].includes(col)) {
    if (typeof v === 'string') { try { return JSON.stringify(JSON.parse(v)); } catch { return v; } }
    return JSON.stringify(v);
  }
  if (['destinatario_mismo_remitente', 'traslado_total_bienes', 'transporte_subcontratado',
       'retorno_envases_vacios', 'retorno_vehiculo_vacio', 'transbordo_programado'].includes(col)) {
    if (v === true || v === 'true' || v === 1 || v === '1') return true;
    if (v === false || v === 'false' || v === 0 || v === '0' || v === '') return false;
    return !!v;
  }
  if (['tipo_transporte', 'id_proveedor', 'id_destinatario', 'id_chofer', 'id_estibador'].includes(col)) {
    return v === '' ? null : parseInt(v, 10) || null;
  }
  if (['cantidad', 'peso', 'suma', 'peso_bruto'].includes(col)) {
    return v === '' ? null : parseFloat(v) || null;
  }
  if (['peso_trasladado_parcial_dam_ds'].includes(col)) {
    return v === '' || v == null ? null : parseFloat(v) || null;
  }
  return v;
}

router.get('/', async (req, res, next) => {
  try {
    const { search, fecha_desde, fecha_hasta, id_proveedor, id_destinatario, tipo } = req.query;
    let query = `
      SELECT g.*,
        c_prov.razon_social AS proveedor_nombre,
        c_dest.razon_social AS destinatario_nombre,
        ch.nombre_completo AS chofer_nombre,
        e.nombre_completo AS estibador_nombre,
        u.nombre_completo AS usuario_nombre,
        EXISTS(SELECT 1 FROM documento_cobro d WHERE d.numero_guia = g.numero_guia) AS tiene_cobro,
        (g.cod_tip_gur = '09' AND EXISTS(
          SELECT 1 FROM guia_remision grt
          CROSS JOIN LATERAL jsonb_array_elements(COALESCE(grt.docs_referenciado, '[]'::jsonb)) AS dr
          WHERE grt.cod_tip_gur = '31'
            AND COALESCE(dr->>'COD_TIP_DOC_REF', dr->>'tipo') = '09'
            AND COALESCE(dr->>'NUM_DOC_REF', dr->>'numero') = COALESCE(NULLIF(g.grt_serie, ''), 'T001') || '-' || g.numero_guia
        )) AS usado
      FROM guia_remision g
      LEFT JOIN cliente c_prov ON g.id_proveedor = c_prov.id_cliente
      LEFT JOIN cliente c_dest ON g.id_destinatario = c_dest.id_cliente
      LEFT JOIN chofer ch ON g.id_chofer = ch.id_chofer
      LEFT JOIN estibador e ON g.id_estibador = e.id_estibador
      LEFT JOIN usuario u ON g.id_usuario_registro = u.id_usuario
    `;
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (search) {
      conditions.push(`(g.numero_guia ILIKE $${paramIndex} OR c_prov.razon_social ILIKE $${paramIndex} OR c_dest.razon_social ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }
    if (fecha_desde) {
      conditions.push(`g.fecha >= $${paramIndex}`);
      params.push(fecha_desde);
      paramIndex++;
    }
    if (fecha_hasta) {
      conditions.push(`g.fecha <= $${paramIndex}`);
      params.push(fecha_hasta);
      paramIndex++;
    }
    if (id_proveedor) {
      conditions.push(`g.id_proveedor = $${paramIndex}`);
      params.push(id_proveedor);
      paramIndex++;
    }
    if (id_destinatario) {
      conditions.push(`g.id_destinatario = $${paramIndex}`);
      params.push(id_destinatario);
      paramIndex++;
    }
    if (tipo) {
      conditions.push(`COALESCE(g.cod_tip_gur, '') = $${paramIndex}`);
      params.push(tipo);
      paramIndex++;
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    query += ' ORDER BY g.fecha DESC, g.hora DESC LIMIT 200';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT g.*,
        c_prov.razon_social AS proveedor_nombre,
        c_dest.razon_social AS destinatario_nombre,
        ch.nombre_completo AS chofer_nombre,
        ch.placa_vehiculo,
        e.nombre_completo AS estibador_nombre,
        u.nombre_completo AS usuario_nombre,
        d.grt, d.lq, d.manifiesto, d.factura, d.monto, d.observacion AS cobro_observacion
      FROM guia_remision g
      LEFT JOIN cliente c_prov ON g.id_proveedor = c_prov.id_cliente
      LEFT JOIN cliente c_dest ON g.id_destinatario = c_dest.id_cliente
      LEFT JOIN chofer ch ON g.id_chofer = ch.id_chofer
      LEFT JOIN estibador e ON g.id_estibador = e.id_estibador
      LEFT JOIN usuario u ON g.id_usuario_registro = u.id_usuario
      LEFT JOIN documento_cobro d ON d.numero_guia = g.numero_guia
      WHERE g.id_guia = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'No encontrado' });
    res.json(result.rows[0]);
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const { numero_guia, fecha, hora, sector, id_proveedor, id_destinatario, cantidad, unidad, detalle, peso, tipo, orden, suma, id_chofer, id_estibador, fecha_entrega } = req.body;

    if (!numero_guia || !fecha || !hora) {
      return res.status(400).json({ error: 'numero_guia, fecha y hora son requeridos' });
    }

    const id_usuario_registro = req.user.id_usuario;

    const base = {
      numero_guia, fecha, hora, sector, id_proveedor, id_destinatario,
      cantidad, unidad, detalle, peso, tipo, orden, suma,
      id_chofer, id_estibador, fecha_entrega, id_usuario_registro,
    };

    const columnas = [];
    const valores = [];
    const placeholders = [];
    let idx = 1;
    const setear = (col, v) => { columnas.push(col); valores.push(prepararValor(col, v)); placeholders.push(`$${idx++}`); };

    for (const col of ['numero_guia','fecha','hora','sector','id_proveedor','id_destinatario','cantidad','unidad','detalle','peso','tipo','orden','suma','id_chofer','id_estibador','fecha_entrega','id_usuario_registro']) {
      setear(col, base[col]);
    }
    for (const col of GRT_COLUMNS) {
      if (req.body[col] !== undefined) setear(col, req.body[col]);
    }

    const result = await pool.query(
      `INSERT INTO guia_remision (${columnas.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`,
      valores
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { numero_guia, fecha, hora, sector, id_proveedor, id_destinatario, cantidad, unidad, detalle, peso, tipo, orden, suma, id_chofer, id_estibador, fecha_entrega } = req.body;

    const sets = [];
    const valores = [];
    let idx = 1;
    const setear = (col, v) => { if (v !== undefined) { sets.push(`${col} = $${idx++}`); valores.push(prepararValor(col, v)); } };

    const base = {
      numero_guia, fecha, hora, sector, id_proveedor, id_destinatario,
      cantidad, unidad, detalle, peso, tipo, orden, suma,
      id_chofer, id_estibador, fecha_entrega,
    };
    for (const col of ['numero_guia','fecha','hora','sector','id_proveedor','id_destinatario','cantidad','unidad','detalle','peso','tipo','orden','suma','id_chofer','id_estibador','fecha_entrega']) {
      setear(col, base[col]);
    }
    for (const col of GRT_COLUMNS) {
      setear(col, req.body[col]);
    }

    if (sets.length === 0) return res.status(400).json({ error: 'Sin campos para actualizar' });

    valores.push(req.params.id);
    const result = await pool.query(
      `UPDATE guia_remision SET ${sets.join(', ')} WHERE id_guia = $${idx} RETURNING *`,
      valores
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'No encontrado' });
    res.json(result.rows[0]);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const guia = await pool.query('SELECT numero_guia FROM guia_remision WHERE id_guia = $1', [req.params.id]);
    if (guia.rows.length === 0) return res.status(404).json({ error: 'No encontrado' });
    await pool.query('DELETE FROM documento_cobro WHERE numero_guia = $1', [guia.rows[0].numero_guia]);
    await pool.query('DELETE FROM guia_remision WHERE id_guia = $1', [req.params.id]);
    res.json({ message: 'Eliminado correctamente' });
  } catch (err) { next(err); }
});

router.post('/importar/preview', async (req, res, next) => {
  try {
    const filas = Array.isArray(req.body.rows) ? req.body.rows : [];
    if (filas.length === 0) return res.status(400).json({ error: 'No se recibieron filas para validar' });
    if (filas.length > MAX_FILAS_IMPORTAR) {
      return res.status(400).json({ error: `Máximo ${MAX_FILAS_IMPORTAR} filas por importación` });
    }

    const normalizadas = filas.map((f, i) => ({ fila: i + 2, n: normalizarFila(f) }));
    const ctx = await construirContextoImport(normalizadas.map((x) => x.n));

    const resultados = normalizadas.map(({ fila, n }) => {
      const { valido, errores, creara } = validarFilaNormalizada(n, ctx);
      return { fila, numero_guia: n.numero_guia, valido, errores, creara, datos: n };
    });

    res.json({
      total: resultados.length,
      validas: resultados.filter((r) => r.valido).length,
      invalidas: resultados.filter((r) => !r.valido).length,
      resultados,
    });
  } catch (err) { next(err); }
});

router.post('/importar', async (req, res, next) => {
  try {
    const filas = Array.isArray(req.body.rows) ? req.body.rows : [];
    if (filas.length === 0) return res.status(400).json({ error: 'No se recibieron filas para importar' });
    if (filas.length > MAX_FILAS_IMPORTAR) {
      return res.status(400).json({ error: `Máximo ${MAX_FILAS_IMPORTAR} filas por importación` });
    }

    const normalizadas = filas.map(normalizarFila);
    const ctx = await construirContextoImport(normalizadas);

    const invalidas = normalizadas
      .map((n, i) => ({ fila: i + 2, numero_guia: n.numero_guia, n, ...validarFilaNormalizada(n, ctx) }))
      .filter((r) => !r.valido)
      .map(({ n, ...rest }) => ({ fila: rest.fila, numero_guia: rest.numero_guia, errores: rest.errores }));

    if (invalidas.length > 0) {
      return res.status(400).json({ error: 'Hay filas inválidas. Corríjalas o use la vista previa', detalle: invalidas });
    }

    if (normalizadas.length > 1) {
      const dup = new Map();
      for (const n of normalizadas) dup.set(n.numero_guia, (dup.get(n.numero_guia) || 0) + 1);
      for (const [num, c] of dup.entries()) {
        if (c > 1) return res.status(400).json({ error: `N° de guía duplicado en el archivo: ${num}` });
      }
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const guiasInsertadas = [];
      for (const n of normalizadas) {
        let idProv = ctx.clientesByRuc.get(n.num_doc_remitente);
        if (!idProv) {
          const r = await client.query(
            `INSERT INTO cliente (ruc, razon_social, direccion) VALUES ($1, $2, $3)
             ON CONFLICT (ruc) DO UPDATE SET razon_social = EXCLUDED.razon_social
             RETURNING id_cliente`,
            [n.num_doc_remitente, n.razon_social_remitente, n.dir_partida || null]
          );
          idProv = r.rows[0].id_cliente;
        }

        let idDest = ctx.clientesByRuc.get(n.num_doc_destinatario);
        if (!idDest) {
          const r = await client.query(
            `INSERT INTO cliente (ruc, razon_social, direccion) VALUES ($1, $2, $3)
             ON CONFLICT (ruc) DO UPDATE SET razon_social = EXCLUDED.razon_social
             RETURNING id_cliente`,
            [n.num_doc_destinatario, n.razon_social_destinatario, n.dir_llegada || null]
          );
          idDest = r.rows[0].id_cliente;
        }

        let idChofer = n.num_doc_conductor ? ctx.choferesByDni.get(n.num_doc_conductor) : null;
        if (!idChofer && n.num_doc_conductor) {
          const r = await client.query(
            `INSERT INTO chofer (nombre_completo, dni, licencia, placa_vehiculo) VALUES ($1, $2, $3, $4)
             ON CONFLICT (dni) DO UPDATE SET nombre_completo = EXCLUDED.nombre_completo
             RETURNING id_chofer`,
            [n.nombre_conductor, n.num_doc_conductor, n.nro_licencia_conduct || null, n.placa || null]
          );
          idChofer = r.rows[0].id_chofer;
        }

        let idEstib = n.dni_estibador ? ctx.estibadoresByDni.get(n.dni_estibador) : null;
        if (!idEstib && n.dni_estibador) {
          const r = await client.query(
            `INSERT INTO estibador (nombre_completo, dni) VALUES ($1, $2)
             ON CONFLICT (dni) DO UPDATE SET nombre_completo = EXCLUDED.nombre_completo
             RETURNING id_estibador`,
            [n.nombre_estibador, n.dni_estibador]
          );
          idEstib = r.rows[0].id_estibador;
        }

        const body = {
          numero_guia: n.numero_guia,
          fecha: n.fecha,
          hora: n.hora,
          sector: n.sector || null,
          id_proveedor: idProv,
          id_destinatario: idDest,
          cantidad: n.items_cantidad_total,
          unidad: n.items && n.items.length ? (n.items[0].UNIDAD_MEDIDA || null) : null,
          detalle: n.items_detalle || null,
          peso: n.items_peso_total,
          tipo: n.tipo || null,
          orden: n.orden || null,
          suma: n.suma,
          id_chofer: idChofer,
          id_estibador: idEstib,
          fecha_entrega: null,
          id_usuario_registro: req.user.id_usuario,
        };
        for (const col of GRT_COLUMNS) {
          if (n[col] !== undefined && n[col] !== null && n[col] !== '') body[col] = n[col];
        }
        body.cod_tip_gur = '09';
        body.grt_serie = 'T001';
        body.grt_estado = 'BORRADOR';
        if (!body.unidad_peso_bruto) body.unidad_peso_bruto = 'KGM';

        const columnas = [];
        const valores = [];
        const placeholders = [];
        let idx = 1;
        const setear = (col, v) => { columnas.push(col); valores.push(prepararValor(col, v)); placeholders.push(`$${idx++}`); };

        for (const col of ['numero_guia','fecha','hora','sector','id_proveedor','id_destinatario','cantidad','unidad','detalle','peso','tipo','orden','suma','id_chofer','id_estibador','fecha_entrega','id_usuario_registro','cod_tip_gur','grt_serie','grt_estado']) {
          setear(col, body[col]);
        }
        for (const col of GRT_COLUMNS) {
          if (body[col] !== undefined) setear(col, body[col]);
        }

        const r = await client.query(
          `INSERT INTO guia_remision (${columnas.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING id_guia, numero_guia`,
          valores
        );
        guiasInsertadas.push(r.rows[0]);
      }
      await client.query('COMMIT');
      res.status(201).json({ insertadas: guiasInsertadas.length, guias: guiasInsertadas });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) { next(err); }
});

export default router;
