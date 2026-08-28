export function errorHandler(err, req, res, _next) {
  console.error('Error:', err.message);
  if (err.code === '23505') {
    return res.status(409).json({ error: 'Registro duplicado', detalle: err.detail || null });
  }
  if (err.code === '23503') {
    return res.status(400).json({ error: 'Referencia inválida', detalle: err.detail || err.message || null });
  }
  if (err.code === '22P02') {
    return res.status(400).json({ error: 'Formato de dato inválido', detalle: err.message || null });
  }
  res.status(err.status || 500).json({
    error: err.expose ? err.message : 'Error interno del servidor',
    detalle: err.message || err.detail || null,
  });
}

export function notFound(req, res) {
  res.status(404).json({ error: 'Ruta no encontrada' });
}
