import CrudPage from '../components/CrudPage';
import { api } from '../api';

const columns = [
  { key: 'id_chofer', label: 'ID' },
  { key: 'nombre_completo', label: 'Nombre' },
  { key: 'dni', label: 'DNI' },
  { key: 'licencia', label: 'Licencia' },
  { key: 'placa_vehiculo', label: 'Placa' },
  { key: 'fono', label: 'Telefono' },
];

const formFields = [
  { key: 'nombre_completo', label: 'Nombre Completo', required: true },
  { key: 'dni', label: 'DNI', required: true, placeholder: '8 digitos' },
  { key: 'licencia', label: 'Licencia' },
  { key: 'placa_vehiculo', label: 'Placa del Vehiculo' },
  { key: 'fono', label: 'Telefono' },
];

export default function Choferes() {
  return (
    <CrudPage
      title="Choferes"
      columns={columns}
      formFields={formFields}
      fetchAll={(s) => api.getChoferes(s)}
      create={(d) => api.createChofer(d)}
      update={(id, d) => api.updateChofer(id, d)}
      remove={(id) => api.deleteChofer(id)}
      searchPlaceholder="Buscar por nombre, DNI o placa..."
    />
  );
}
