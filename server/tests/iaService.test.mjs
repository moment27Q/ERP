import test from 'node:test';
import assert from 'node:assert/strict';

// dotenv no sobreescribe variables ya definidas, asi que ponerla vacia antes del import
// simula el despliegue sin IA configurada (sin red y sin exposing la clave real).
process.env.GROQ_API_KEY = '';

const { explicarErrorGuia, explicacionVacia, iaDisponible } = await import('../src/config/iaService.js');

test('la IA se desactiva cuando no hay GROQ_API_KEY', () => {
  assert.equal(iaDisponible(), false);
});

test('sin API key devuelve una explicacion de respaldo y no lanza', async () => {
  const r = await explicarErrorGuia({
    erroresLocales: [{ code: 'GRE-014', field: 'num_doc_destinatario', message: 'Documento invalido' }],
  });
  assert.equal(r.generado_por_ia, false);
  assert.ok(r.razon.length > 0);
  assert.ok(Array.isArray(r.solucion));
  assert.ok(r.solucion.length >= 1);
});

test('sin API key la razon menciona que falta configurar la IA', async () => {
  const r = await explicarErrorGuia({ erroresLocales: [{ code: 'GRE-014' }] });
  assert.match(r.razon, /GROQ_API_KEY/);
});

test('explicacionVacia devuelve siempre la forma que espera el frontend', () => {
  const r = explicacionVacia('motivo de prueba');
  for (const campo of ['titulo', 'certeza', 'razon', 'solucion', 'campo_principal', 'vale_intentar_reenviar']) {
    assert.ok(campo in r, `falta el campo ${campo}`);
  }
  assert.equal(r.razon, 'motivo de prueba');
  assert.equal(r.certeza, 'baja');
  assert.equal(r.vale_intentar_reenviar, true);
});

test('la IA nunca lanza ante entradas vacias, nulas o mal formadas', async () => {
  const entradas = [
    {},
    { erroresLocales: null },
    { erroresSunat: [] },
    { payload: 'x'.repeat(9000) },
    { guia: null },
    { erroresLocales: [{ code: null, message: undefined }] },
  ];
  for (const entrada of entradas) {
    const r = await explicarErrorGuia(entrada);
    assert.equal(typeof r.razon, 'string');
    assert.equal(typeof r.titulo, 'string');
    assert.ok(Array.isArray(r.solucion) && r.solucion.length >= 1);
    assert.ok(['alta', 'media', 'baja'].includes(r.certeza));
  }
});
