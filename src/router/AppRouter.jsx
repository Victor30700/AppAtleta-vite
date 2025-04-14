import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Páginas
import Login from '../pages/Login';
import Home from '../pages/Home';
import Partidas from '../pages/Partidas';
import RegistroEntrenamiento from '../pages/RegistroEntrenamiento';
import ListaEntrenamientos from '../pages/ListaEntrenamientos';
import ControlesPB from '../pages/ControlesPB';
import RegistroForm from '../pages/RegistroForm';
import LoadingScreen from '../components/LoadingScreen';

// Nuevas páginas para Registro de Gym
import RegistroGymList from '../pages/RegistroGymList';
import RegistroGymForm from '../pages/RegistroGymForm';

export default function AppRouter() {
  const { user, loading } = useAuth();

  if (loading) return <LoadingScreen />;

  return (
    <BrowserRouter>
      <Routes>
        {/* Ruta raíz redirige según user */}
        <Route
          path="/"
          element={user ? <Navigate to="/home" replace /> : <Navigate to="/login" replace />}
        />

        {/* Login */}
        <Route
          path="/login"
          element={!user ? <Login /> : <Navigate to="/home" replace />}
        />

        {/* Rutas privadas */}
        <Route
          path="/home"
          element={user ? <Home /> : <Navigate to="/login" replace />}
        />
        <Route
          path="/partidas"
          element={user ? <Partidas /> : <Navigate to="/login" replace />}
        />
        <Route
          path="/registro"
          element={user ? <RegistroEntrenamiento /> : <Navigate to="/login" replace />}
        />
        <Route
          path="/registro/nuevo"
          element={user ? <RegistroForm /> : <Navigate to="/login" replace />}
        />

        <Route
          path="/lista"
          element={user ? <ListaEntrenamientos /> : <Navigate to="/login" replace />}
        />
        <Route
          path="/controles"
          element={user ? <ControlesPB /> : <Navigate to="/login" replace />}
        />

        {/* Rutas para registro de gym */}
        <Route
          path="/registro-gym"
          element={user ? <RegistroGymList /> : <Navigate to="/login" replace />}
        />
        <Route
          path="/registro-gym/nuevo"
          element={user ? <RegistroGymForm /> : <Navigate to="/login" replace />}
        />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
