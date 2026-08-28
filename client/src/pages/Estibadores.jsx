import CrudPage from '../components/CrudPage';
import { api } from '../api';

const columns = [
  { key: 'id_estibador', label: 'ID' },
  { key: 'nombre_completo', label: 'Nombre' },
  { key: 'dni', label: 'DNI' },
];

const formFields = [
  { key: 'nombre_completo', label: 'Nombre Completo', required: true },
  { key: 'dni', label: 'DNI', required: true, placeholder: '8 digitos' },
];

export default function Estibadores() {
  return (
    <CrudPage
      title="Estibadores"
      columns={columns}
      formFields={formFields}
      fetchAll={(s) => api.getEstibadores(s)}
      create={(d) => api.createEstibador(d)}
      update={(id, d) => api.updateEstibador(id, d)}
      remove={(id) => api.deleteEstibador(id)}
      searchPlaceholder="Buscar por nombre o DNI..."
    />
  );
}
