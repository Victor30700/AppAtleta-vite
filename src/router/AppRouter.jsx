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
import ChatGPTPage from '../pages/ChatGPTPage';

// Nuevas páginas para Registro de Gym
import RegistroGymList from '../pages/RegistroGymList';
import RegistroGymForm from '../pages/RegistroGymForm';
// ———> Importa tu nuevo componente:
import RegistroGymDiario from '../pages/RegistroGymDiario';

import EditarPerfil from '../pages/EditarPerfil';

//
import PrivatePremiumRoute from '../components/PrivatePremiumRoute';

//import RouteChangeLoader from '../components/RouteChangeLoader';
import CrearUsuario from '../pages/CrearUsuario';
import  RegistroLesion from '../pages/RegistroLesion';
import RegistroPesoCorporal from '../pages/RegistroPesoCorporal';
import HealthProfilePage from '../pages/HealthProfilePage';

export default function AppRouter() {
  const { user, loading } = useAuth();

  if (loading) return <LoadingScreen />;

  return (
    <BrowserRouter>
      <Routes>
        {/* Ruta raíz */}
        <Route
          path="/"
          element={
            user
              ? <Navigate to="/home" replace />
              : <Navigate to="/login" replace />
          }
        />


        {/* Auth */}
        <Route
          path="/login"
          element={!user ? <Login /> : <Navigate to="/home" replace />}
        />

        {/* Privadas */}
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

<Route
  path="/editar-usuario"
  element={user ? <EditarPerfil /> : <Navigate to="/login" replace />}
/>

<Route
  path="/crear-usuario"
  element={!user ? <CrearUsuario /> : <Navigate to="/home" replace />}
/>


        {/* Rutas para registro de gym mensual */}
        <Route
          path="/registro-gym"
          element={user ? <RegistroGymList /> : <Navigate to="/login" replace />}
        />
        <Route
          path="/registro-gym/nuevo"
          element={user ? <RegistroGymForm /> : <Navigate to="/login" replace />}
        />
        <Route
          path="/registro-gym/editar"
          element={user ? <RegistroGymForm /> : <Navigate to="/login" replace />}
        />

        {/* ———> Nueva ruta para registro diario */}
        <Route
          path="/registro-gym/diario"
          element={user ? <RegistroGymDiario /> : <Navigate to="/login" replace />}
        />
        {/* Perfil de Salud: aquí solo exponemos la “página contenedora” */}
        <Route
           path="/health-profile"
           element={user ? <HealthProfilePage /> : <Navigate to="/login" replace />}
        />
        {/* Sub-ruta Peso y Altura */}
        <Route
          path="/health-profile/peso-altura"
          element={user ? <RegistroPesoCorporal /> : <Navigate to="/login" replace />}
        />
        {/* Sub-ruta Lesiones */}
        <Route
          path="/health-profile/lesiones"
          element={user ? <RegistroLesion /> : <Navigate to="/login" replace />}    
        />
        {/* Chat GPT */}
        {/* <Route path="/chat" element={<ChatGPTPage />} /> */}
        <Route
  path="/chat"
  element={
    <PrivatePremiumRoute>
      <ChatGPTPage />
    </PrivatePremiumRoute>
  }
/>


        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

    </BrowserRouter>
  );
}
