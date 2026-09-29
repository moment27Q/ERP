import dotenv from 'dotenv';
dotenv.config();

const API_KEY = process.env.GROQ_API_KEY || '';
const BASE_URL = (process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1').replace(/\/+$/, '');
const MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
const TIMEOUT_MS = Number(process.env.GROQ_TIMEOUT_MS) || 25000;

export const iaDisponible = () => Boolean(API_KEY);

const CONtexto_SUNAT = `Eres un asistente experto en facturación electrónica peruana y en las Guías de Remisión Electrónicas (GRE) de SUNAT.

Contexto del sistema:
- La aplicación es un ERP logístico peruano. El usuario es un operador que está creando una Guía de Remisión Electrónica (GRE).
- El tipo de guía que se está enviando es COD_TIP_GUR = "31", es decir una GRE Transportista. Su serie empieza con "V".
- Los campos usan la nomenclatura oficial de SUNAT en MAYÚSCULAS y con guion bajo.
- Catálogos SUNAT relevantes:
  - Catálogo 01 (tipo de documento): 0=None, 1=DNI (exactamente 8 dígitos), 4=Carnet de extranjería, 6=RUC (exactamente 11 dígitos), 7=Pasaporte, A=Documento de identidad sin validez tributaria.
  - Catálogo 03 (unidades de medida): las más usadas son NIU (unidad), KGM (kilogramo), TNE (tonelada), GRM (gramo), LBR (libra), MTM (metro).
  - Catálogo 06 (tipo de documento de identidad del emisor/remitente/destinatario).
  - Catálogo 20 (motivo de traslado) para GRE Remitente.
  - Catálogo 09 (tipo de documento): 01=Factura, 09=Guía de Remisión Remitente.
- Los ubigeos son códigos INEI de 6 dígitos (por ejemplo 150101 = Lima).
- La placa de un vehículo peruano tiene 6 o 7 caracteres alfanuméricos.
- Los códigos de error con prefijo "GRE-0xx" pertenecen al validador interno de la aplicación, no a SUNAT.
- Los códigos de error numéricos (por ejemplo 2017, 2335) y las etiquetas <codigo>/<numero>/<descripcion> provienen del CDR de SUNAT.

Tu tarea: explicar el error en lenguaje claro para un operador que no conoce la norma, y dar los pasos concretos para corregirlo en el formulario de la aplicación.

Reglas estrictas:
- No inventes códigos de error, catálogos ni normas que no estén en los datos recibidos.
- Si la causa no se puede determinar con certeza, dilo explícitamente en "certeza" con el valor "baja" y sugiere cómo verificarla.
- Ajustate a los errores realmente recibidos. No menciones errores que no aparecen.
- Responde SIEMPRE únicamente con un objeto JSON válido, sin texto adicional, sin bloques de código, sin comillas sueltas.`;

const SISTEMA_SALIDA = `Responde con un único objeto JSON con esta forma exacta, y nada más:

{
  "titulo": "titulo corto de max 60 caracteres que resuma el problema",
  "certeza": "alta" | "media" | "baja",
  "razon": "explicacion en 1-3 frases de por que SUNAT o el validador rechazan el documento",
  "solucion": ["paso 1 concreto", "paso 2 concreto", "paso 3 concreto"],
  "campo_principal": "nombre del campo SUNAT a corregir, o cadena vacia si no aplica",
  "vale_intentar_reenviar": true
}

Reglas para "solucion": entre 2 y 4 pasos. Cada paso debe ser una accion concreta y especifica
(por ejemplo: "En el campo Numero de documento del destinatario, escribe el RUC de 11 digitos").
No pongas pasos genericos como "revisa los datos".`;

function recortar(valor, max = 400) {
  const s = typeof valor === 'string' ? valor : JSON.stringify(valor);
  if (!s) return '';
  return s.length > max ? `${s.slice(0, max)}...` : s;
}

function armarContenido({ erroresLocales, erroresSunat, respuestaMiFact, payload, guia }) {
  const partes = [];

  if (erroresLocales?.length) {
    partes.push(`ERRORES DEL VALIDADOR INTERNO DE LA APLICACION:
${erroresLocales.map((e, i) => `${i + 1}. [${e.code}] campo=${e.field} | mensaje=${e.message} | valor recibido=${recortar(e.received, 120)} | regla=${e.rule}`).join('\n')}`);
  }
  if (erroresSunat?.length) {
    partes.push(`ERRORES DEVUELTOS POR SUNAT (desde el CDR):
${erroresSunat.map((e, i) => `${i + 1}. codigo=${e.codigo} numero=${e.numero} | descripcion=${e.descripcion} | campo=${e.campo}`).join('\n')}`);
  }
  if (respuestaMiFact) {
    partes.push(`RESPUESTA DE MIFACT/SUNAT:
estado_documento=${respuestaMiFact.estado_documento} sunat_responsecode=${respuestaMiFact.sunat_responsecode}
sunat_description=${recortar(respuestaMiFact.sunat_description, 500)}
sunat_note=${recortar(respuestaMiFact.sunat_note, 300)}
errors=${recortar(respuestaMiFact.errors, 600)}`);
  }
  if (guia) {
    partes.push(`DATOS DE LA GUIA (relacionados con los errores):
${recortar(guia, 1500)}`);
  }
  if (payload) {
    partes.push(`PAYLOAD ENVIADO A MIFACT (truncado):
${recortar(payload, 1200)}`);
  }

  return partes.length ? partes.join('\n\n') : 'No se recibieron errores detallados.';
}

function extraerJson(texto) {
  const limpio = String(texto || '').trim();
  const fenced = limpio.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidato = fenced ? fenced[1] : limpio;
  const inicio = candidato.indexOf('{');
  const fin = candidato.lastIndexOf('}');
  if (inicio === -1 || fin === -1 || fin <= inicio) return null;
  try { return JSON.parse(candidato.slice(inicio, fin + 1)); } catch { return null; }
}

function normalizarSalida(obj) {
  if (!obj || typeof obj !== 'object') return null;
  const titulo = recortar(obj.titulo, 120) || 'Error al enviar la guia';
  const razon = recortar(obj.razon, 900) || 'SUNAT rechazo el documento.';
  let solucion = Array.isArray(obj.solucion) ? obj.solucion : [];
  solucion = solucion.map((s) => recortar(s, 300)).filter(Boolean).slice(0, 4);
  if (solucion.length === 0) solucion = ['Revisa los campos marcados en la lista de errores de arriba.'];
  const certeza = ['alta', 'media', 'baja'].includes(obj.certeza) ? obj.certeza : 'media';
  return {
    titulo,
    certeza,
    razon,
    solucion,
    campo_principal: recortar(obj.campo_principal, 60),
    vale_intentar_reenviar: obj.vale_intentar_reenviar !== false,
  };
}

export function explicacionVacia(motivo = 'No hay informacion suficiente para explicar el error.') {
  return {
    titulo: 'Error al enviar la guia',
    certeza: 'baja',
    razon: motivo,
    solucion: ['Revisa los errores de SUNAT indicados arriba y corrige los campos marcados.'],
    campo_principal: '',
    vale_intentar_reenviar: true,
  };
}

/**
 * Explica los errores de una GRT usando IA.
 * Nunca lanza: si la IA no esta configurada o falla, devuelve una explicacion generica
 * para que el envio de la guia no se rompa por un problema de la IA.
 */
export async function explicarErrorGuia(contexto) {
  if (!iaDisponible()) {
    return { ...explicacionVacia('El modulo de IA no esta configurado en el servidor (falta GROQ_API_KEY).'), generado_por_ia: false };
  }

  const controlador = new AbortController();
  const timer = setTimeout(() => controlador.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY}`,
      },
      signal: controlador.signal,
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.2,
        max_tokens: 2000,
        response_format: { type: 'json_object' },
        reasoning_effort: 'low',
        messages: [
          { role: 'system', content: `${CONtexto_SUNAT}\n\n${SISTEMA_SALIDA}` },
          { role: 'user', content: `Explica este error de envio de una GRE Transportista (COD_TIP_GUR 31):\n\n${armarContenido(contexto)}` },
        ],
      }),
    });

    if (!res.ok) {
      const detalle = await res.text().catch(() => '');
      console.error(`[ia] Groq respondio ${res.status}: ${detalle.substring(0, 300)}`);
      return { ...explicacionVacia(`La IA no pudo responder (Groq HTTP ${res.status}). Revisa los errores de SUNAT listados arriba.`), generado_por_ia: false };
    }

    const data = await res.json();
    const texto = data?.choices?.[0]?.message?.content || '';
    const salida = normalizarSalida(extraerJson(texto));
    if (!salida) {
      console.error('[ia] Respuesta de Groq no fue JSON valido:', texto.substring(0, 300));
      return { ...explicacionVacia('La IA respondio en un formato no reconocido. Revisa los errores de SUNAT listados arriba.'), generado_por_ia: false };
    }
    return { ...salida, generado_por_ia: true, modelo: MODEL };
  } catch (err) {
    const motivo = err.name === 'AbortError'
      ? `La IA tardo mas de ${TIMEOUT_MS / 1000}s en responder.`
      : `No se pudo contactar a la IA: ${err.message}`;
    console.error('[ia]', motivo);
    return { ...explicacionVacia(`${motivo} Revisa los errores de SUNAT listados arriba.`), generado_por_ia: false };
  } finally {
    clearTimeout(timer);
  }
}
