import React, { useState, useEffect } from 'react';
import './styles/ManageCategories.css';
import { Plus, Trash2, Tag } from 'lucide-react';
import { apiFetch } from '../services/api';

const ManageCategories = () => {
  const [categories, setCategories] = useState([]);
  const [priorities, setPriorities] = useState([]); // Novo estado para armazenar as prioridades
  const [newCategoryName, setNewCategoryName] = useState('');
  const [selectedPriorityId, setSelectedPriorityId] = useState(''); // Novo estado para seleção

  // Agrupamento das requisições para carregamento inicial
  const fetchData = async () => {
    try {
      const categoriesResponse = await apiFetch('/categories/');
      if (categoriesResponse.ok) {
        setCategories(await categoriesResponse.json());
      }

      // Consumo do endpoint de prioridades para preenchimento do formulário
      const prioritiesResponse = await apiFetch('/priorities/');
      if (prioritiesResponse.ok) {
        setPriorities(await prioritiesResponse.json());
      }
    } catch (error) {
      console.error('Erro de comunicação estrutural:', error);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!newCategoryName.trim() || !selectedPriorityId) {
      alert("A inserção do nome e a seleção da prioridade são mandatórias.");
      return;
    }

    try {
      const response = await apiFetch('/categories/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Transmissão consolidada dos atributos requeridos pelo backend
        body: JSON.stringify({ 
          name: newCategoryName, 
          priority_id: parseInt(selectedPriorityId) 
        }),
      });

      if (response.ok) {
        setNewCategoryName('');
        setSelectedPriorityId('');
        fetchData();
      } else {
        const errorData = await response.json();
        alert(`Falha na inserção: ${errorData.message}`);
      }
    } catch (error) {
      console.error('Falha na persistência da categoria:', error);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Deseja efetivamente proceder com a exclusão desta categoria?')) return;
    try {
      const response = await apiFetch(`/categories/${id}`, { method: 'DELETE' });
      if (response.ok) fetchData();
    } catch (error) {
      console.error('Falha na operação de deleção:', error);
    }
  };

  return (
    <div className="category-container">
      <h1><Tag /> Gerenciar Categorias</h1>
      
      <form onSubmit={handleAddCategory} className="add-category-form">
        <input
          type="text"
          value={newCategoryName}
          onChange={(e) => setNewCategoryName(e.target.value)}
          placeholder="Nome da nova categoria..."
          required
        />
        {/* Elemento de seleção vinculado ao conjunto de prioridades ativas */}
        <select 
          value={selectedPriorityId} 
          onChange={(e) => setSelectedPriorityId(e.target.value)}
          required
        >
          <option value="">Selecione uma Prioridade</option>
          {priorities.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <button type="submit"><Plus size={20} /> Adicionar</button>
      </form>

      <div className="category-list">
        {categories.length > 0 ? (
          categories.map((category) => (
            <div key={category.id} className="category-item">
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontWeight: 'bold' }}>{category.name}</span>
                {/* Renderização da hierarquia da prioridade */}
                <span style={{ fontSize: '0.85em', color: '#666' }}>
                  Prioridade base: {category.priority_name || 'Não atribuída'}
                </span>
              </div>
              <button 
                onClick={() => handleDelete(category.id)} 
                className="btn-del"
              >
                <Trash2 size={18} />
              </button>
            </div>
          ))
        ) : (
          <p>Não há registros cadastrais na base de dados.</p>
        )}
      </div>
    </div>
  );
};

export default ManageCategories;