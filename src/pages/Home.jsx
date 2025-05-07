// src/pages/Home.jsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../styles/Home.css';
import { GiFinishLine, GiNotebook, GiArchiveRegister, GiStopwatch, GiWeightLiftingUp, GiCalendar } from 'react-icons/gi';
import backgroundImage from '../assets/pista5.jpg';
import { BiBrain } from 'react-icons/bi';
import { FaHeartbeat } from 'react-icons/fa';
import { MdTrendingUp } from 'react-icons/md';

import Navbar from '../components/NavBar';
import StatusModal from '../components/StatusModal';

import { getAuth } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import Swal from 'sweetalert2';

export default function Home() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [isPremium, setIsPremium] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const auth = getAuth();
  const user = auth.currentUser;

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (err) {
      console.error('Error al cerrar sesión:', err);
    }
  };

  const navigateWithLoading = (path) => {
    setIsLoading(true);
    const timeout = setTimeout(() => {
      navigate(path);
    }, 600);

    // Asegurarse de apagar loading si el usuario navega manualmente
    const stopLoading = () => {
      clearTimeout(timeout);
      setIsLoading(false);
      window.removeEventListener('popstate', stopLoading);
    };
    window.addEventListener('popstate', stopLoading);
  };

  useEffect(() => {
    const fetchUser = async () => {
      if (user) {
        const ref = doc(db, 'users', user.uid);
        const snap = await getDoc(ref);
        if (snap.exists()) setIsPremium(snap.data().isPremium || false);
      }
    };
    fetchUser();
  }, [user]);

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
      <Navbar />
      <StatusModal isOpen={isLoading} message="Cargando..." />

      <header className="home-header">
        <h1 className="home-title">
          Sprinter
          <span className="rayo-icon">
            <svg viewBox="0 0 64 64" className="rayo-svg">
              <path
                d="M30 2 L10 34 H28 L22 62 L54 26 H34 L40 2 Z"
                fill="url(#gold-gradient)"
              />
              <defs>
                <linearGradient id="gold-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#ffd700" />
                  <stop offset="50%" stopColor="#ffa500" />
                  <stop offset="100%" stopColor="#ffcc00" />
                </linearGradient>
              </defs>
            </svg>
          </span>
          App
        </h1>
      </header>

      <div className="menu-grid">
        <div className="menu-card" onClick={() => navigateWithLoading('/partidas')}>
          <GiFinishLine className="menu-icon" />
          <span>Partidas</span>
        </div>
        <div className="menu-card" onClick={() => navigateWithLoading('/registro')}>
          <GiNotebook className="menu-icon" />
          <span>Registro Entreno</span>
        </div>

        <div className="menu-card" onClick={() => navigateWithLoading('/grafica')}>
          <MdTrendingUp className="menu-icon" />
          <span>Rendimiento Deportivo</span>
        </div>
        
        <div className="menu-card" onClick={() => navigateWithLoading('/controles')}>
          <GiStopwatch className="menu-icon" />
          <span>Controles PB</span>
        </div>
        <div className="menu-card" onClick={() => navigateWithLoading('/registro-gym')}>
          <GiWeightLiftingUp className="menu-icon" />
          <span>Registro GYM</span>
        </div>
        <div className="menu-card calendar-card" onClick={() => navigateWithLoading('/calendario-eventos')}>
          <GiCalendar className="menu-icon calendar-icon" />
          <span>Calendario Eventos</span>
        </div>

        <div
          className={`menu-card ia-card ${!isPremium ? 'disabled' : ''}`}
          onClick={() => {
            if (isPremium) navigateWithLoading('/chat');
            else {
              Swal.fire({
                icon: 'info',
                title: 'Suscripción necesaria',
                html: `<p>Para acceder a <strong>Coach Nova</strong>, contáctanos:</p>
                  <a href="https://wa.me/59167679528" target="_blank" class="whatsapp-link">+591 67679528</a>`,
                confirmButtonText: 'Entendido',
              });
            }
          }}
        >
          <BiBrain className="menu-icon ia-icon" />
          <span>Coach Nova</span>
        </div>

        <div className="menu-card health-card" onClick={() => navigateWithLoading('/health-profile')}>
          <FaHeartbeat className="menu-icon health-icon" />
          <span>Perfil de Salud</span>
        </div>
      </div>

      <footer className="home-footer">
        <div className="brand">SprinterApp</div>
        <div className="legal">© 2025 SprinterApp. Todos los derechos reservados.</div>
      </footer>
    </div>
  );
}
