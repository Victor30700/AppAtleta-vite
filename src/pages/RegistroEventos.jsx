// src/pages/RegistroEventos.jsx
import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../config/firebase';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  setDoc,
  Timestamp
} from 'firebase/firestore';
import { useNavigate, useParams, Navigate } from 'react-router-dom';
import Calendar from 'react-calendar';
import styles from '../styles/RegistroEventos.module.css';

export default function RegistroEventos() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();

  const [fecha, setFecha] = useState(new Date());
  const [titulo, setTitulo] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [advanceDays, setAdvanceDays] = useState(14);

  if (loading) return <p>Cargando usuario…</p>;
  if (!user) return <Navigate to="/login" replace />;

  // Referencias corregidas usando UID
  const userEventsRef = collection(db, 'userEvents', user.uid, 'events');

  useEffect(() => {
    if (!id) return;
    
    (async () => {
      try {
        const docRef = doc(db, 'userEvents', user.uid, 'events', id);
        const snap = await getDoc(docRef);
        
        if (!snap.exists()) {
          alert('Evento no encontrado');
          return navigate('/calendario-eventos');
        }
        
        const data = snap.data();
        setFecha(data.date.toDate());
        setTitulo(data.title);
        setMensaje(data.message);
        setAdvanceDays(data.advanceDays);
      } catch (error) {
        console.error("Error cargando evento:", error);
        alert('Error al cargar el evento');
      }
    })();
  }, [id, user.uid, navigate]);

  const handleSubmit = async e => {
    e.preventDefault();
    if (!titulo.trim()) return alert('El título es obligatorio');
    
    try {
      const payload = {
        title: titulo.trim(),
        message: mensaje.trim(),
        date: Timestamp.fromDate(fecha),
        advanceDays,
        userId: user.uid,
        notificationSent: false,
        createdAt: Timestamp.now()
      };

      if (id) {
        await setDoc(doc(db, 'userEvents', user.uid, 'events', id), payload);
      } else {
        await addDoc(userEventsRef, payload);
      }
      
      navigate('/calendario-eventos');
    } catch (error) {
      console.error("Error detallado:", error);
      alert(`Error al guardar: ${error.message}`);
    }
  };

  return (
    <div className={styles.container}>
      <button
        className={styles.btnBack}
        onClick={() => navigate(-1)}
      >
        ← Volver
      </button>

      <h2>📅 {id ? 'Editar Evento' : 'Nuevo Evento'}</h2>

      <form onSubmit={handleSubmit} className={styles.form}>
        <label htmlFor="fecha">Selecciona la fecha</label>
        <Calendar
          onChange={setFecha}
          value={fecha}
          className={styles.calendar}
          id="fecha"
          minDate={new Date()} // Evitar fechas pasadas
        />

        <label htmlFor="titulo">Título</label>
        <input
          id="titulo"
          type="text"
          value={titulo}
          onChange={e => setTitulo(e.target.value)}
          className={styles.input}
          placeholder="Breve título"
          maxLength={50}
        />

        <label htmlFor="mensaje">Mensaje</label>
        <textarea
          id="mensaje"
          value={mensaje}
          onChange={e => setMensaje(e.target.value)}
          className={styles.textarea}
          rows={3}
          placeholder="Mensaje de recordatorio"
          maxLength={200}
        />

        <label htmlFor="aviso">Notificar días antes</label>
        <select
          id="aviso"
          value={advanceDays}
          onChange={e => setAdvanceDays(Number(e.target.value))}
          className={styles.input}
        >
          <option value={14}>2 semanas antes</option>
          <option value={7}>1 semana antes</option>
          <option value={5}>5 días antes</option>
          <option value={4}>4 días antes</option>
          <option value={3}>3 días antes</option>
          <option value={2}>2 días antes</option>
          <option value={1}>1 día antes</option>
        </select>

        <button type="submit" className={styles.btnAdd}>
          {id ? 'Guardar Cambios' : 'Guardar Evento'}
        </button>
      </form>
    </div>
  );
}