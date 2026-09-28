import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { resolverDistrito } from '../config/catalogos/ubigeoDistritos.js';

const router = Router();
router.use(authMiddleware);

router.get('/', (req, res) => {
  const nombre = String(req.query.nombre || '').trim();
  if (!nombre) {
    return res.status(400).json({ error: 'Parametro nombre requerido.' });
  }
  const r = resolverDistrito(nombre);
  if (!r) {
    return res.status(404).json({ error: 'No se encontro un distrito con ese nombre en el catalogo INEI.' });
  }
  res.json(r);
});

export default router;