// Arquivo: frontend/src/pages/Priority.jsx

import { useEffect, useState } from 'react';
import {
  Plus,
  Flag,
  Pencil,
  Trash2,
  X,
  Save,
  Clock
} from 'lucide-react';

import {
  getPriorities,
  createPriority,
  updatePriority,
  deletePriority
} from '../services/priorityService';

import './styles/Priority.css';

const Priorities = () => {
  const [priorities, setPriorities] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPriority, setEditingPriority] = useState(null);

  const initialFormState = {
    name: '',
    sla: '',
    color: '#2563eb'
  };

  const [formData, setFormData] = useState(initialFormState);

  useEffect(() => {
    loadPriorities();
  }, []);

  const loadPriorities = async () => {
    try {
      const data = await getPriorities();

      setPriorities(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Erro ao carregar prioridades:', error);
      setPriorities([]);
    }
  };

 const openCreateModal = () => {
    setEditingPriority(null);
    setFormData({ name: '', sla: '', color: '#2563eb' });
    setIsModalOpen(true);
  };

  const openEditModal = (priority) => {
    setEditingPriority(priority);
    setFormData({ name: priority.name, sla: priority.sla, color: priority.color || '#2563eb' });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setEditingPriority(null);
    setFormData(initialFormState);
    setIsModalOpen(false);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const payload = {
        name: formData.name.trim(),
        sla: Number(formData.sla),
        color: formData.color
      };

      if (editingPriority) {
        await updatePriority(editingPriority.id, payload);
      } else {
        await createPriority(payload);
      }

      await loadPriorities();

      closeModal();

      alert(
        editingPriority
          ? 'Prioridade atualizada com sucesso!'
          : 'Prioridade criada com sucesso!'
      );
    } catch (error) {
      console.error(error);
      alert('Erro ao salvar prioridade.');
    }
  };

  const handleDelete = async (id) => {
    const confirmDelete = window.confirm(
      'Deseja realmente excluir esta prioridade?'
    );

    if (!confirmDelete) return;

    try {
      await deletePriority(id);

      await loadPriorities();

      alert('Prioridade removida com sucesso.');
    } catch (error) {
      console.error(error);
      alert('Erro ao remover prioridade.');
    }
  };

  return (
    <div className="priorities-page">
      <div className="priorities-header">
        <div>
          <h1>Prioridades</h1>
          <p>
            Gerenciamento das prioridades utilizadas nos chamados.
          </p>
        </div>

        <button
          className="btn-new-priority"
          onClick={openCreateModal}
        >
          <Plus size={18} />
          Nova Prioridade
        </button>
      </div>

      <div className="priorities-grid">
        {priorities.length > 0 ? (
          priorities.map((priority) => (
            <div
              className="priority-card"
              key={priority.id}
            >
              <div className="priority-top">
                <div
                  className="priority-badge"
                  style={{
                    backgroundColor:
                      priority.color || '#2563eb'
                  }}
                >
                  <Flag size={18} />
                </div>

                <div className="priority-actions">
                  
                  <button
                    className="btn-icon delete"
                    onClick={() =>
                      handleDelete(priority.id)
                    }
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <div className="priority-content">
                <h3>{priority.name}</h3>

                <div className="priority-info">
                  <div className="priority-sla">
                    <Clock size={14} />
                    <span>
                      SLA: {priority.sla} horas
                    </span>
                  </div>

                  <span
                    className="priority-color"
                    style={{
                      backgroundColor:
                        priority.color || '#2563eb'
                    }}
                  >
                    {priority.color}
                  </span>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="empty-state">
            Nenhuma prioridade cadastrada.
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <div>
                <h2>
                  {editingPriority
                    ? 'Editar Prioridade'
                    : 'Nova Prioridade'}
                </h2>

                <p>
                  Configure os parâmetros da prioridade.
                </p>
              </div>

              <button
                className="btn-close"
                onClick={closeModal}
              >
                <X size={20} />
              </button>
            </div>

            <form
              className="modal-form"
              onSubmit={handleSubmit}
            >
              <div className="form-group">
                <label>Nome da Prioridade</label>

                <input
                  type="text"
                  name="name"
                  placeholder="Ex.: Crítica"
                  value={formData.name}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label>SLA (Horas)</label>

                <input
                  type="number"
                  name="sla"
                  min="1"
                  placeholder="Ex.: 4"
                  value={formData.sla}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label>Cor</label>

                <div className="color-picker-wrapper">
                  <input
                    type="color"
                    name="color"
                    value={formData.color}
                    onChange={handleChange}
                  />

                  <span>{formData.color}</span>
                </div>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={closeModal}
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="btn-save"
                >
                  <Save size={16} />
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Priorities;