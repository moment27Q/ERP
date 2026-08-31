const API = '/api';

function getHeaders() {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function request(url, options = {}) {
  const res = await fetch(`${API}${url}`, { ...options, headers: getHeaders() });
  if (res.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
    throw new Error('Sesion expirada');
  }
  const data = await res.json();
  if (!res.ok) {
    const msg = data.error || 'Error del servidor';
    const detalle = data.detalle || data.errores;
    const final = detalle ? `${msg}: ${typeof detalle === 'string' ? detalle : JSON.stringify(detalle)}` : msg;
    const e = new Error(final);
    e.status = res.status;
    e.data = data;
    throw e;
  }
  return data;
}

export const api = {
  login: (body) => request('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  me: () => request('/auth/me'),

  getChoferes: (search) => request(`/choferes${search ? `?search=${search}` : ''}`),
  getChofer: (id) => request(`/choferes/${id}`),
  createChofer: (body) => request('/choferes', { method: 'POST', body: JSON.stringify(body) }),
  updateChofer: (id, body) => request(`/choferes/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteChofer: (id) => request(`/choferes/${id}`, { method: 'DELETE' }),

  getEstibadores: (search) => request(`/estibadores${search ? `?search=${search}` : ''}`),
  getEstibador: (id) => request(`/estibadores/${id}`),
  createEstibador: (body) => request('/estibadores', { method: 'POST', body: JSON.stringify(body) }),
  updateEstibador: (id, body) => request(`/estibadores/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteEstibador: (id) => request(`/estibadores/${id}`, { method: 'DELETE' }),

  getClientes: (search) => request(`/clientes${search ? `?search=${search}` : ''}`),
  getCliente: (id) => request(`/clientes/${id}`),
  createCliente: (body) => request('/clientes', { method: 'POST', body: JSON.stringify(body) }),
  updateCliente: (id, body) => request(`/clientes/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteCliente: (id) => request(`/clientes/${id}`, { method: 'DELETE' }),
  deleteClienteCascada: (id) => request(`/clientes/${id}?cascada=true`, { method: 'DELETE' }),

  getUsuarios: () => request('/usuarios'),
  getUsuario: (id) => request(`/usuarios/${id}`),
  createUsuario: (body) => request('/usuarios', { method: 'POST', body: JSON.stringify(body) }),
  updateUsuario: (id, body) => request(`/usuarios/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  updatePassword: (id, body) => request(`/usuarios/${id}/password`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteUsuario: (id) => request(`/usuarios/${id}`, { method: 'DELETE' }),

  getRoles: () => request('/roles'),

  getGuias: (params) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/guias${qs ? `?${qs}` : ''}`);
  },
  getGuia: (id) => request(`/guias/${id}`),
  createGuia: (body) => request('/guias', { method: 'POST', body: JSON.stringify(body) }),
  updateGuia: (id, body) => request(`/guias/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteGuia: (id) => request(`/guias/${id}`, { method: 'DELETE' }),
  enviarGuiasMasivo: (ids) => request('/guias/masivo/enviar', { method: 'POST', body: JSON.stringify({ ids }) }),

  getDocumentosCobro: (search) => request(`/documentos-cobro${search ? `?search=${search}` : ''}`),
  getDocumentoCobro: (id) => request(`/documentos-cobro/${id}`),
  getDocumentoCobroPorGuia: (numeroGuia) => request(`/documentos-cobro/por-guia/${numeroGuia}`),
  createDocumentoCobro: (body) => request('/documentos-cobro', { method: 'POST', body: JSON.stringify(body) }),
  updateDocumentoCobro: (id, body) => request(`/documentos-cobro/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteDocumentoCobro: (id) => request(`/documentos-cobro/${id}`, { method: 'DELETE' }),

  enviarFactura: (id) => request(`/mifact/enviar-factura/${id}`, { method: 'POST' }),
  enviarGuia: (id) => request(`/mifact/enviar-guia/${id}`, { method: 'POST' }),
  enviarGuiaGrt: (id) => request(`/mifact/guias/${id}/enviar`, { method: 'POST' }),
  previewGuiaGrt: (id) => request(`/mifact/guias/${id}/preview`),
  estadoFactura: (id) => request(`/mifact/estado-factura/${id}`),
  estadoGuia: (id) => request(`/mifact/estado-guia/${id}`),
  descargarFactura: (id, tipo) => request(`/mifact/descargar-factura/${id}/${tipo}`),
  descargarGuia: (id, tipo) => request(`/mifact/descargar-guia/${id}/${tipo}`),

  descargarGuiasPdf: async (ids) => {
    const token = localStorage.getItem('token');
    const res = await fetch(`${API}/mifact/masivo/descargar-pdfs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ ids }),
    });
    if (!res.ok) {
      let detail = '';
      try { const d = await res.json(); detail = d.error || 'Error del servidor'; } catch { detail = 'Error del servidor'; }
      const e = new Error(detail);
      e.status = res.status;
      throw e;
    }
    return res.blob();
  },
  enviarEmail: (id, email) => request(`/mifact/enviar-email/${id}`, { method: 'POST', body: JSON.stringify({ email }) }),
  anularFactura: (id) => request(`/mifact/anular-factura/${id}`, { method: 'POST' }),

  getEmpresa: () => request('/config/empresa'),
  updateEmpresa: (body) => request('/config/empresa', { method: 'PUT', body: JSON.stringify(body) }),

  getDashboard: () => request('/dashboard'),
};
