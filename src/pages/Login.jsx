import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../styles/Login.css';
import { FiMail, FiLock } from 'react-icons/fi';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError('Credenciales inválidas');
    }
  };

  return (
    <div className="login-container">
      {/* Carriles de la pista como fondo */}
      {[...Array(8)].map((_, i) => (
        <div className="track-lane" key={i}>
          <span className="track-lane-number">{i + 1}</span>
        </div>
      ))}

      {/* Login encima de la pista */}
      <div className="login-card">
        <h1 className="login-title">AppAtleta</h1>
        <form className="login-form" onSubmit={handleSubmit}>
          {error && <div className="login-error">{error}</div>}
          <div className="login-field">
            <FiMail className="login-icon" />
            <input
              type="email"
              placeholder="Correo electrónico"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="login-field">
            <FiLock className="login-icon" />
            <input
              type="password"
              placeholder="Contraseña"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="login-button">
            Iniciar sesión
          </button>
        </form>
      </div>
    </div>
  );
}
