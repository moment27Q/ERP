import CrudPage from '../components/CrudPage';
import { api } from '../api';

const TIPOS_DOCUMENTO = {
  '1': 'DNI',
  '4': 'Carnet de Extranjeria',
  '6': 'RUC',
};

const columns = [
  { key: 'id_chofer', label: 'ID' },
  { key: 'nombre_completo', label: 'Nombre' },
  {
    key: 'tipo_documento',
    label: 'Tipo Doc',
    render: (v) => TIPOS_DOCUMENTO[v] || 'DNI',
  },
  { key: 'dni', label: 'Documento' },
  { key: 'licencia', label: 'Licencia' },
  { key: 'placa_vehiculo', label: 'Placa' },
  { key: 'fono', label: 'Telefono' },
];

const formFields = [
  { key: 'nombre_completo', label: 'Nombre Completo', required: true },
  {
    key: 'tipo_documento',
    label: 'Tipo de Documento',
    type: 'select',
    required: true,
    default: '1',
    options: [
      { value: '1', label: 'DNI' },
      { value: '4', label: 'Carnet de Extranjeria' },
      { value: '6', label: 'RUC' },
    ],
  },
  { key: 'dni', label: 'Numero de Documento', required: true, placeholder: 'DNI (8), CE (9) o RUC (11)' },
  { key: 'licencia', label: 'Licencia' },
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
      searchPlaceholder="Buscar por nombre, documento o placa..."
    />
  );
}