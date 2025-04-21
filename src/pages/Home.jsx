import React from 'react'; 
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../styles/Home.css';
import { GiFinishLine, GiNotebook, GiArchiveRegister, GiStopwatch, GiWeightLiftingUp } from 'react-icons/gi';
import { FiLogOut } from 'react-icons/fi';
import backgroundImage from '../assets/pista5.jpg'; // ✅ Imagen de fondo
import { BiBrain } from 'react-icons/bi'; // 🧠 Icono IA
import Navbar from '../components/NavBar';

import { getAuth } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import Swal from 'sweetalert2';
import { useEffect, useState } from 'react';


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
  const [isPremium, setIsPremium] = useState(false);
const auth = getAuth();
const user = auth.currentUser;

useEffect(() => {
  const fetchUser = async () => {
    if (user) {
      const ref = doc(db, 'users', user.uid);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        setIsPremium(snap.data().isPremium || false);
      }
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
      <Navbar /> {/* Componente de navegación */}
      {/* Ícono de cerrar sesión */}
      {/* <button className="logout-button" onClick={handleLogout}>
        <FiLogOut className="logout-icon" />
      </button> */}

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
        <div
  className="menu-card ia-card"
  onClick={() => {
    if (isPremium) {
      navigate('/chat');
    } else {
      Swal.fire({
        icon: 'info',
        title: 'Suscripción necesaria',
        html: `
          <p>Para acceder a <strong>Coach Nova</strong>, contáctanos:</p>
          <a href="https://wa.me/59167679528" target="_blank" style="display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 12px; font-size: 1.1rem; color: #25D366; text-decoration: none;">
            <img src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" width="24" height="24" alt="WhatsApp" />
            +591 67679528
          </a>
        `,
        confirmButtonText: 'Entendido',
      });
    }
  }}
>
<BiBrain className="menu-icon ia-icon" />
<span>Coach Nova</span>
</div>
</div>

<footer className="home-footer">
  <div className="brand">SprinterApp</div>
  <div className="legal">© 2025 SprinterApp. Todos los derechos reservados.</div>
</footer>

    </div>
  );
}
