import { Router } from 'express';
import pool from '../config/db.js';
import { authMiddleware } from '../middleware/auth.js';
import { getEmpresaActiva, invalidarCacheEmpresa } from '../config/configEmpresa.js';

const router = Router();
router.use(authMiddleware);

router.get('/empresa', async (_req, res, next) => {
  try {
    const empresa = await getEmpresaActiva(true);
    res.json(empresa);
  } catch (err) { next(err); }
});

router.put('/empresa', async (req, res, next) => {
  try {
    const { ruc, razon_social, nombre_comercial, cod_ubigeo, direccion, cod_tip_nif, es_activa } = req.body;
    if (!ruc || !razon_social || !direccion) {
      return res.status(400).json({ error: 'ruc, razon_social y direccion son requeridos' });
    }
    const result = await pool.query(
      `INSERT INTO config_empresa (ruc, razon_social, nombre_comercial, cod_ubigeo, direccion, cod_tip_nif, es_activa)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (ruc) DO UPDATE SET
         razon_social = EXCLUDED.razon_social,
         nombre_comercial = EXCLUDED.nombre_comercial,
         cod_ubigeo = EXCLUDED.cod_ubigeo,
         direccion = EXCLUDED.direccion,
         cod_tip_nif = EXCLUDED.cod_tip_nif,
         es_activa = EXCLUDED.es_activa
       RETURNING *`,
      [ruc, razon_social, nombre_comercial || null, cod_ubigeo || '150101', direccion, cod_tip_nif || '6', es_activa === false ? false : true]
    );
    invalidarCacheEmpresa();
    res.json(result.rows[0]);
  } catch (err) { next(err); }
});

export default router;
