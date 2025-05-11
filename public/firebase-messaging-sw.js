// public/firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

// Configuración estática o URL para obtener la configuración
const firebaseConfig = {
  apiKey: self.__FIREBASE_CONFIG__.apiKey,
  authDomain: self.__FIREBASE_CONFIG__.authDomain,
  projectId: self.__FIREBASE_CONFIG__.projectId,
  storageBucket: self.__FIREBASE_CONFIG__.storageBucket,
  messagingSenderId: self.__FIREBASE_CONFIG__.messagingSenderId,
  appId: self.__FIREBASE_CONFIG__.appId,
  measurementId: self.__FIREBASE_CONFIG__.measurementId
};


const app = firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging(app);

// Manejo de mensajes en segundo plano
messaging.onBackgroundMessage((payload) => {
  console.log('[SW] Mensaje en segundo plano:', payload);
  const notification = payload.notification;
  
  self.registration.showNotification(
    notification?.title || 'Nuevo recordatorio',
    {
      body: notification?.body || 'Tienes un evento próximo',
      icon: notification?.icon || '/favicon.ico',
      data: payload.data
    }
  );
});

// Manejo de clic en notificaciones
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(clientList => {
      const url = new URL('/calendario-eventos', self.location.origin).href;
      
      for (const client of clientList) {
        if (client.url === url && 'focus' in client) {
          return client.focus();
        }
      }
      
      return clients.openWindow(url);
    })
  );
});