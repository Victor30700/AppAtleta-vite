// src/pages/Home.jsx
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../styles/Home.css';
import { GiFinishLine, GiNotebook, GiArchiveRegister, GiStopwatch, GiWeightLiftingUp, GiCalendar } from 'react-icons/gi';
import { FiLogOut } from 'react-icons/fi';
import backgroundImage from '../assets/pista5.jpg';
import { BiBrain } from 'react-icons/bi';
import Navbar from '../components/NavBar';

import { getAuth } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import Swal from 'sweetalert2';

export default function Home() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [isPremium, setIsPremium] = useState(false);

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
        <Link to="" className="menu-card calendar-card">
          <GiCalendar className="menu-icon calendar-icon" />
          <span>Calendario Eventos en Desarrollo</span>
        </Link>
        <div
          className={`menu-card ia-card ${!isPremium ? 'disabled' : ''}`}
          onClick={() => {
            if (isPremium) navigate('/chat');
            else
              Swal.fire({
                icon: 'info',
                title: 'Suscripción necesaria',
                html: `<p>Para acceder a <strong>Coach Nova</strong>, contáctanos:</p>
                  <a href="https://wa.me/59167679528" target="_blank" class="whatsapp-link">+591 67679528</a>`,
                confirmButtonText: 'Entendido',
              });
          }}
        >
          <BiBrain className="menu-icon ia-icon" />
          <span>Coach Nova</span>
        </div>
      </div>

      <footer className="home-footer">
        <div className="brand">SprinterApp</div>
        <div className="legal">© 2025 SprinterApp. Todos los derechos reservados.</div>
      </footer>
    </div>
  );
}
