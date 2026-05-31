// Localização: frontend/src/pages/ManageCategories.jsx

import React, { useState, useEffect } from 'react';
import './styles/ManageCategories.css';
import { Plus, Trash2, Tag } from 'lucide-react';

const ManageCategories = () => {
  const [categories, setCategories] = useState([]);
  const [newCategory, setNewCategory] = useState('');

  // 1. Função para carregar categorias do servidor
  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/categories');
      if (response.ok) {
        const data = await response.json();
        setCategories(data); // Atualiza o estado com a lista vinda do banco
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
      const response = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: newCategory }),
      });

      if (response.ok) {
        setNewCategory('');
        fetchCategories(); // 2. Recarrega a lista imediatamente após o cadastro bem-sucedido
      }
    } catch (error) {
      console.error('Erro ao adicionar categoria:', error);
    }
  };

  // ... restante do código (handleDelete)

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