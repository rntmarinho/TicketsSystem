import React, { useState, useEffect } from 'react';
import './styles/ManageCategories.css';
import { Plus, Trash2, Tag } from 'lucide-react';
import { apiFetch } from '../services/api'; // Importação do apiFetch adicionada

const ManageCategories = () => {
  const [categories, setCategories] = useState([]);
  const [newCategory, setNewCategory] = useState('');

  const fetchCategories = async () => {
    try {
      // Correção: apiFetch com barra no final
      const response = await apiFetch('/categories/');
      if (response.ok) {
        const data = await response.json();
        setCategories(data);
      }
    } catch (error) {
      console.error('Erro ao buscar categorias:', error);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!newCategory.trim()) return;

    try {
      // Correção: apiFetch com barra no final
      const response = await apiFetch('/categories/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: newCategory }),
      });

      if (response.ok) {
        setNewCategory('');
        fetchCategories();
      }
    } catch (error) {
      console.error('Erro ao adicionar categoria:', error);
    }
  };

  // Correção: Lógica de exclusão que estava cortada no arquivo original
  const handleDelete = async (id) => {
    if (!window.confirm('Deseja realmente excluir esta categoria?')) return;
    try {
      const response = await apiFetch(`/categories/${id}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        fetchCategories();
      }
    } catch (error) {
      console.error('Erro ao excluir categoria:', error);
    }
  };

  return (
    <div className="category-container">
      <h1><Tag /> Gerenciar Categorias</h1>
      
      <form onSubmit={handleAddCategory} className="add-category-form">
        <input
          type="text"
          value={newCategory}
          onChange={(e) => setNewCategory(e.target.value)}
          placeholder="Nome da nova categoria..."
        />
        <button type="submit"><Plus size={20} /> Adicionar</button>
      </form>

      <div className="category-list">
        {categories.length > 0 ? (
          categories.map((category) => (
            <div key={category.id} className="category-item">
              <span>{category.nome}</span>
              <button 
                onClick={() => handleDelete(category.id)} 
                className="btn-del"
              >
                <Trash2 size={18} />
              </button>
            </div>
          ))
        ) : (
          <p>Nenhuma categoria cadastrada.</p>
        )}
      </div>
    </div>
  );
};

export default ManageCategories;