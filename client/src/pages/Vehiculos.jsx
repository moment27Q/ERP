import CrudPage from '../components/CrudPage';
import { api } from '../api';
import { IMPORT_CATALOGOS } from '../config/importCatalogos';

const columns = [
  { key: 'id_vehiculo', label: 'ID' },
  { key: 'placa', label: 'Placa' },
  { key: 'constancia_tuc', label: 'Constancia TUC' },
  { key: 'entidad_emisora_aut_vehiculo', label: 'Entidad Emisora' },
  { key: 'nro_autorizacion_especial_vehiculo', label: 'Nro Aut. Especial' },
];

const formFields = [
  { key: 'placa', label: 'Placa', required: true, placeholder: 'Ej: X7I962' },
  { key: 'constancia_tuc', label: 'Constancia Vehicular (TUC)' },
  { key: 'entidad_emisora_aut_vehiculo', label: 'Entidad Emisora Aut. Vehiculo' },
  { key: 'nro_autorizacion_especial_vehiculo', label: 'Nro Autorizacion Especial Vehiculo' },
];

export default function Vehiculos() {
  return (
    <CrudPage
      title="Vehiculos"
      columns={columns}
      formFields={formFields}
      fetchAll={(s) => api.getVehiculos(s)}
      create={(d) => api.createVehiculo(d)}
      update={(id, d) => api.updateVehiculo(id, d)}
      remove={(id) => api.deleteVehiculo(id)}
      importConfig={IMPORT_CATALOGOS.vehiculos}
      searchPlaceholder="Buscar por placa, constancia o entidad..."
    />
  );
}
