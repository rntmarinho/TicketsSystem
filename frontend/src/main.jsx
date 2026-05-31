import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { BrowserRouter } from 'react-router-dom'; // Importação necessária aqui

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter> {/* O App precisa estar dentro do BrowserRouter */}
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)