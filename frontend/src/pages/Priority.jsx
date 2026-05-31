import { useEffect, useState } from 'react';
import { Plus, Flag, Pencil, Trash2, X, Save } from 'lucide-react';
import { apiFetch } from '../services/api'; // Importação do apiFetch adicionada
import './styles/Priority.css';

const Priorities = () => {
  const [priorities, setPriorities] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPriority, setEditingPriority] = useState(null);
  const [formData, setFormData] = useState({ nome: '', cor: '#2563eb' });

  useEffect(() => {
    loadPriorities();
  }, []);

  const loadPriorities = async () => {
    try {
      // Correção: apiFetch com barra no final
      const response = await apiFetch('/priorities/');
      const data = await response.json();
      setPriorities(data);
    } catch (error) {
      console.error('Erro ao carregar prioridades:', error);
    }
  };

  const openCreateModal = () => {
    setEditingPriority(null);
    setFormData({ nome: '', cor: '#2563eb' });
    setIsModalOpen(true);
  };

  const openEditModal = (priority) => {
    setEditingPriority(priority);
    setFormData({ nome: priority.nome, cor: priority.cor || '#2563eb' });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setEditingPriority(null);
    setFormData({ nome: '', cor: '#2563eb' });
    setIsModalOpen(false);
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // Correção: Controle condicional do Endpoint
      const url = editingPriority ? `/priorities/${editingPriority.id}` : '/priorities/';
      const method = editingPriority ? 'PUT' : 'POST';

      const response = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (!response.ok) throw new Error('Erro ao salvar prioridade');

      closeModal();
      loadPriorities();
      alert(editingPriority ? 'Prioridade atualizada!' : 'Prioridade criada!');
    } catch (error) {
      console.error(error);
      alert('Erro ao salvar prioridade.');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Deseja realmente excluir esta prioridade?')) return;
    try {
      const response = await apiFetch(`/priorities/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Erro ao excluir');

      loadPriorities();
      alert('Prioridade removida!');
    } catch (error) {
      console.error(error);
      alert('Erro ao excluir prioridade.');
    }
  };

  return (
    <div className="priorities-page">
      <div className="priorities-header">
        <div>
          <h1>Prioridades</h1>
          <p>Gerencie as prioridades dos chamados.</p>
        </div>
        <button className="btn-new-priority" onClick={openCreateModal}>
          <Plus size={18} /> Nova Prioridade
        </button>
      </div>

      <div className="priorities-grid">
        {priorities.map(priority => (
          <div className="priority-card" key={priority.id}>
            <div className="priority-top">
              <div className="priority-badge" style={{ background: priority.cor }}>
                <Flag size={18} />
              </div>
              <div className="priority-actions">
                <button className="btn-icon edit" onClick={() => openEditModal(priority)}>
                  <Pencil size={16} />
                </button>
                <button className="btn-icon delete" onClick={() => handleDelete(priority.id)}>
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
            <div className="priority-content">
              <h3>{priority.nome}</h3>
              <span className="priority-color" style={{ background: priority.cor }}>
                {priority.cor}
              </span>
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <div>
                <h2>{editingPriority ? 'Editar Prioridade' : 'Nova Prioridade'}</h2>
                <p>Configure o nome e a cor da prioridade.</p>
              </div>
              <button className="btn-close" onClick={closeModal}><X size={20} /></button>
            </div>
            <form className="modal-form" onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Nome da Prioridade</label>
                <input
                  type="text"
                  name="nome"
                  placeholder="Ex: Alta"
                  value={formData.nome}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="form-group">
                <label>Cor</label>
                <div className="color-picker-wrapper">
                  <input
                    type="color"
                    name="cor"
                    value={formData.cor}
                    onChange={handleChange}
                  />
                  <span>{formData.cor}</span>
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={closeModal}>Cancelar</button>
                <button type="submit" className="btn-save"><Save size={16} /> Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Priorities;