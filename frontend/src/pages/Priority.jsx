// frontend/src/pages/Priorities.jsx

import { useEffect, useState } from 'react';

import {
  Plus,
  Flag,
  Pencil,
  Trash2,
  X,
  Save,
  AlertTriangle
} from 'lucide-react';

import './styles/Priority.css';

const Priorities = () => {

  // =====================================================
  // STATES
  // =====================================================

  const [priorities, setPriorities] = useState([]);

  const [isModalOpen, setIsModalOpen] = useState(false);

  const [editingPriority, setEditingPriority] = useState(null);

  const [formData, setFormData] = useState({
    nome: '',
    cor: '#2563eb'
  });

  // =====================================================
  // LOAD PRIORITIES
  // =====================================================

  useEffect(() => {
    loadPriorities();
  }, []);

  const loadPriorities = async () => {
    try {

      const response = await fetch('/api/priorities');

      const data = await response.json();

      setPriorities(data);

    } catch (error) {
      console.error(
        'Erro ao carregar prioridades:',
        error
      );
    }
  };

  // =====================================================
  // OPEN MODAL
  // =====================================================

  const openCreateModal = () => {

    setEditingPriority(null);

    setFormData({
      nome: '',
      cor: '#2563eb'
    });

    setIsModalOpen(true);
  };

  const openEditModal = (priority) => {

    setEditingPriority(priority);

    setFormData({
      nome: priority.nome,
      cor: priority.cor || '#2563eb'
    });

    setIsModalOpen(true);
  };

  // =====================================================
  // CLOSE MODAL
  // =====================================================

  const closeModal = () => {

    setEditingPriority(null);

    setFormData({
      nome: '',
      cor: '#2563eb'
    });

    setIsModalOpen(false);
  };

  // =====================================================
  // HANDLE CHANGE
  // =====================================================

  const handleChange = (e) => {

    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  // =====================================================
  // SAVE PRIORITY
  // =====================================================

  const handleSubmit = async (e) => {

    e.preventDefault();

    try {

      const url = editingPriority
        ? `/api/priorities/${editingPriority.id}`
        : '/api/priorities';

      const method = editingPriority
        ? 'PUT'
        : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        throw new Error('Erro ao salvar prioridade');
      }

      closeModal();

      loadPriorities();

      alert(
        editingPriority
          ? 'Prioridade atualizada!'
          : 'Prioridade criada!'
      );

    } catch (error) {

      console.error(error);

      alert('Erro ao salvar prioridade.');
    }
  };

  // =====================================================
  // DELETE PRIORITY
  // =====================================================

  const handleDelete = async (id) => {

    const confirmDelete = window.confirm(
      'Deseja realmente excluir esta prioridade?'
    );

    if (!confirmDelete) return;

    try {

      const response = await fetch(
        `/api/priorities/${id}`,
        {
          method: 'DELETE'
        }
      );

      if (!response.ok) {
        throw new Error('Erro ao excluir');
      }

      loadPriorities();

      alert('Prioridade removida!');

    } catch (error) {

      console.error(error);

      alert('Erro ao excluir prioridade.');
    }
  };

  // =====================================================
  // RENDER
  // =====================================================

  return (
    <div className="priorities-page">

      {/* HEADER */}

      <div className="priorities-header">

        <div>
          <h1>Prioridades</h1>

          <p>
            Gerencie as prioridades dos chamados.
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

      {/* LIST */}

      <div className="priorities-grid">

        {priorities.map(priority => (

          <div
            className="priority-card"
            key={priority.id}
          >

            <div className="priority-top">

              <div
                className="priority-badge"
                style={{
                  background: priority.cor
                }}
              >
                <Flag size={18} />
              </div>

              <div className="priority-actions">

                <button
                  className="btn-icon edit"
                  onClick={() => openEditModal(priority)}
                >
                  <Pencil size={16} />
                </button>

                <button
                  className="btn-icon delete"
                  onClick={() => handleDelete(priority.id)}
                >
                  <Trash2 size={16} />
                </button>

              </div>

            </div>

            <div className="priority-content">

              <h3>{priority.nome}</h3>

              <span
                className="priority-color"
                style={{
                  background: priority.cor
                }}
              >
                {priority.cor}
              </span>

            </div>

          </div>

        ))}

      </div>

      {/* MODAL */}

      {isModalOpen && (

        <div className="modal-overlay">

          <div className="modal-content">

            {/* HEADER */}

            <div className="modal-header">

              <div>
                <h2>
                  {editingPriority
                    ? 'Editar Prioridade'
                    : 'Nova Prioridade'}
                </h2>

                <p>
                  Configure o nome e a cor da prioridade.
                </p>
              </div>

              <button
                className="btn-close"
                onClick={closeModal}
              >
                <X size={20} />
              </button>

            </div>

            {/* FORM */}

            <form
              className="modal-form"
              onSubmit={handleSubmit}
            >

              {/* NOME */}

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

              {/* COR */}

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

              {/* ACTIONS */}

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