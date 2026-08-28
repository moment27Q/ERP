import CrudPage from '../components/CrudPage';
import { api } from '../api';

const columns = [
  { key: 'id_cliente', label: 'ID' },
  { key: 'ruc', label: 'RUC' },
  { key: 'razon_social', label: 'Razon Social' },
  { key: 'direccion', label: 'Direccion' },
  { key: 'fono', label: 'Telefono' },
];

const formFields = [
  { key: 'ruc', label: 'RUC', required: true, placeholder: '11 digitos' },
  { key: 'razon_social', label: 'Razon Social', required: true },
  { key: 'direccion', label: 'Direccion' },
  { key: 'fono', label: 'Telefono' },
];

export default function Clientes() {
  const handleConfirmDelete = async (id) => {
    const res = await api.deleteCliente(id);
    if (res && res.requiereConfirmacion) {
      const ok = window.confirm(
        `${res.mensaje} Al eliminar este cliente también se eliminarán todas sus guías y sus documentos de cobro. ¿Desea continuar?`
      );
      if (!ok) {
        const e = new Error('cancelado');
        e.message = 'cancelado';
        throw e;
      }
      await api.deleteClienteCascada(id);
      return;
    }
  };

  return (
    <CrudPage
      title="Clientes"
      columns={columns}
      formFields={formFields}
      fetchAll={(s) => api.getClientes(s)}
      create={(d) => api.createCliente(d)}
      update={(id, d) => api.updateCliente(id, d)}
      remove={(id) => api.deleteCliente(id)}
      confirmDelete={handleConfirmDelete}
      searchPlaceholder="Buscar por razon social, RUC o direccion..."
    />
  );
}
