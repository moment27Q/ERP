import { getEmpresaActiva } from './configEmpresa.js';

export const ESTADOS_INTERNOS = [
  'BORRADOR',
  'VALIDANDO',
  'LISTA_PARA_ENVIAR',
  'ENVIADA',
  'EN_PROCESO',
  'ACEPTADA',
  'ACEPTADA_CON_OBSERVACIONES',
  'RECHAZADA',
  'ANULADA',
];

export function estadoInternoDeRespuesta(result) {
  const code = String(result.sunat_responsecode || '');
  const estadoDoc = String(result.estado_documento || '');
  const errors = String(result.errors || '');

  if (code === '0' || estadoDoc === '102') return 'ACEPTADA';
  if (code === '98' || estadoDoc === '103') return 'ACEPTADA_CON_OBSERVACIONES';
  if (code === '99' || estadoDoc === '104' || estadoDoc === '105') return 'RECHAZADA';
  if (estadoDoc === '101') return 'EN_PROCESO';
  if (code === '98' || errors) return 'RECHAZADA';
  if (errors) return 'RECHAZADA';

  return 'ENVIADA';
}

export function estadoParaDocumento(result) {
  const interno = estadoInternoDeRespuesta(result);
  const map = {
    ACEPTADA: 'aceptado',
    ACEPTADA_CON_OBSERVACIONES: 'observado',
    RECHAZADA: 'rechazado',
    EN_PROCESO: 'en_proceso',
  };
  return map[interno] || 'error';
}

export function mensajeErrorEntendible(result, prefix = '') {
  const problemas = {
    UBI_PARTIDA: 'El ubigeo de partida no es valido.',
    UBI_LLEGADA: 'El ubigeo de llegada no es valido.',
    NUM_NIF_REMITENTE: 'El documento del remitente no es valido.',
    NUM_NIF_DEST: 'El documento del destinatario no es valido.',
  };

  const errs = String(result.errors || result.sunat_description || '');
  if (errs.includes('ya existe')) {
    return { tipo: 'duplicado', mensaje: 'El documento ya existe en MiFact con ese correlativo.' };
  }

  if (result.sunat_responsecode && result.sunat_responsecode !== '0') {
    let campo = 'Desconocido';
    let problema = String(result.sunat_description || 'Error de SUNAT').substring(0, 300);
    for (const [k, v] of Object.entries(problemas)) {
      if (result.errors && result.errors.includes(k)) { campo = k; problema = v; break; }
    }
    return { tipo: 'sunat', campo, problema, accion: 'Revise el campo indicado y reintente.' };
  }

  if (errs) {
    return { tipo: 'error', campo: 'Documento', problema: errs.substring(0, 300), accion: 'Corrija los datos e intente nuevamente.' };
  }

  return null;
}

export async function getEmisorParaDoc() {
  try { return await getEmpresaActiva(); } catch { return null; }
}
