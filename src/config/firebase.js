// src/config/firebase.js

// Importa las funciones que necesitas
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

// Tu configuración de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyBHyzMEsaV4ckCqdBWQSIqmagZv_hO0LWw",
  authDomain: "tareasfirebase-6ee19.firebaseapp.com",
  projectId: "tareasfirebase-6ee19",
  storageBucket: "tareasfirebase-6ee19.appspot.com",  // corregido dominio
  messagingSenderId: "72131834476",
  appId: "1:72131834476:web:5b81047782e6f2f7afde49",
  measurementId: "G-MC7WMKEFYF"
};

// Inicializa Firebase
const app = initializeApp(firebaseConfig);

// Inicializa servicios que vas a usar
export const auth = getAuth(app);
export const db = getFirestore(app);
export const analytics = getAnalytics(app);
