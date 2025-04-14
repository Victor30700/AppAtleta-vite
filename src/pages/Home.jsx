import React from 'react'; 
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../styles/Home.css';
import { GiFinishLine, GiNotebook, GiArchiveRegister, GiStopwatch, GiWeightLiftingUp } from 'react-icons/gi';
import { FiLogOut } from 'react-icons/fi';
import backgroundImage from '../assets/pista4.jpg'; // ✅ Imagen de fondo
import { BiBrain } from 'react-icons/bi'; // 🧠 Icono IA

export default function Home() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (err) {
      console.error('Error al cerrar sesión:', err);
    }
  };

  return (
    <div
      className="home-container"
      style={{
        backgroundImage: `url(${backgroundImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      {/* Ícono de cerrar sesión */}
      <button className="logout-button" onClick={handleLogout}>
        <FiLogOut className="logout-icon" />
      </button>

      <header className="home-header">
        <h1 className="home-title">SprinterApp</h1>
      </header>

      <div className="menu-grid">
        <Link to="/partidas" className="menu-card">
          <GiFinishLine className="menu-icon" />
          <span>Partidas</span>
        </Link>
        <Link to="/registro" className="menu-card">
          <GiNotebook className="menu-icon" />
          <span>Registro Entreno</span>
        </Link>
        <Link to="/lista" className="menu-card">
          <GiArchiveRegister className="menu-icon" />
          <span>Lista Entrenos</span>
        </Link>
        <Link to="/controles" className="menu-card">
          <GiStopwatch className="menu-icon" />
          <span>Controles PB</span>
        </Link>
        <Link to="/registro-gym" className="menu-card">
          <GiWeightLiftingUp className="menu-icon" />
          <span>Registro GYM</span>
        </Link>
        <div className="menu-card ia-card disabled">
  <BiBrain className="menu-icon ia-icon" />
  <span>IA (Próximamente)</span>
</div>

        
      </div>
    </div>
  );
}
