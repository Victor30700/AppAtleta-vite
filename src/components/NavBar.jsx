import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuth, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import '../styles/NavBar.css'; // Estilos separados

import logo from '../assets/rayo-icon.png'; // Reemplaza con tu logo real
import { FiLogOut } from 'react-icons/fi';

export default function Navbar() {
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState('');
  const [Prueba, setPrueba] = useState('');
  const auth = getAuth();
  const user = auth.currentUser;

  useEffect(() => {
    const fetchUser = async () => {
      if (user) {
        const ref = doc(db, 'users', user.uid);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const fullName = snap.data().fullName || '';
          setFirstName(fullName.split(' ')[0]);
          setPrueba(snap.data().tipoCorredor || '');
        }
      }
    };

    fetchUser();
  }, [user]);

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  return (
    <nav className="navbar">
      <div className="navbar-section" onClick={() => navigate('/home')}>
      <div className="navbar-center"> SprinterApp</div>
        <img src={logo} alt="Logo" className="navbar-logo" />
      </div>
      
      <div className="navbar-section navbar-right">
      
        <span className="navbar-user" onClick={() => navigate('/editar-usuario')}>
          {firstName}
        </span>
        <span className="navbar-user" onClick={() => navigate('/editar-usuario')}>
          {Prueba}
        </span>
        <button className="navbar-logout" onClick={handleLogout}>
        <FiLogOut className="logout-icon" />
        </button>
      </div>
    </nav>
  );
}
