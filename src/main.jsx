import React from 'react';
import ReactDOM from 'react-dom/client';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './config/firebase';
import { AuthProvider } from './context/AuthContext';
import App from './App';
import { 
  requestNotificationPermission,
  onMessageListener,
  clearNotificationToken
} from './utils/messaging';

// Configuración de mensajes en primer plano
onMessageListener(payload => {
  const { title, body } = payload.notification || {};
  if (title && body) {
    new Notification(title, { 
      body,
      icon: '/logo192.png'
    });
  }
});

// Manejo de autenticación y tokens
const handleAuthStateChange = async (user) => {
  try {
    if (user) {
      const token = await requestNotificationPermission(user);
      if (token) {
        console.log('Notificaciones configuradas para:', user.uid);
      }
    } else {
      await clearNotificationToken();
    }
  } catch (error) {
    console.error('Error en flujo de autenticación:', error);
  }
};

// Inicialización de la app
const initializeApp = () => {
  onAuthStateChanged(auth, handleAuthStateChange);
  
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <AuthProvider>
        <App />
      </AuthProvider>
    </React.StrictMode>
  );
};

// Iniciar aplicación
initializeApp();