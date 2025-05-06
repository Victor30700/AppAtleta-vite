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

  // Estado inicial con hora predeterminada 12:00
  const [fecha, setFecha] = useState(() => {
    const defaultDate = new Date();
    defaultDate.setHours(12, 0, 0, 0);
    return defaultDate;
  });
  const [titulo, setTitulo] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [advanceDays, setAdvanceDays] = useState(14);

  if (loading) return <p>Cargando usuario…</p>;
  if (!user) return <Navigate to="/login" replace />;

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
        // Conservar la hora almacenada
        const storedDate = data.date.toDate();
        setFecha(storedDate);
        setTitulo(data.title);
        setMensaje(data.message);
        setAdvanceDays(data.advanceDays);
      } catch (error) {
        console.error("Error cargando evento:", error);
        alert('Error al cargar el evento');
      }
    })();
  }, [id, user.uid, navigate]);

  // Maneja cambios en la fecha conservando la hora actual
  const handleDateChange = (newDate) => {
    const newDateTime = new Date(newDate);
    newDateTime.setHours(
      fecha.getHours(),
      fecha.getMinutes(),
      fecha.getSeconds()
    );
    setFecha(newDateTime);
  };

  // Maneja cambios en la hora
  const handleTimeChange = (e) => {
    const [hours, minutes] = e.target.value.split(':').map(Number);
    const newDate = new Date(fecha);
    newDate.setHours(hours, minutes);
    setFecha(newDate);
  };

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
  <div className={styles.datetimeContainer}>
    <div>
      <label htmlFor="fecha">Fecha del evento</label>
      <Calendar
        onChange={handleDateChange}
        value={fecha}
        className={styles.calendar}
        id="fecha"
        minDate={new Date()}
      />
    </div>

    <div>
      <label htmlFor="hora">Hora de notificación</label>
      <div className={styles.timeInputWrapper}>
        <span className={styles.timeIcon}>⏰</span>
        <input
          id="hora"
          type="time"
          value={`${String(fecha.getHours()).padStart(2, '0')}:${String(fecha.getMinutes()).padStart(2, '0')}`}
          onChange={handleTimeChange}
          className={styles.inputTime}
          required
        />
      </div>
    </div>
  </div> {/* <<< ESTE CIERRE FALTABA COMPADRE */}

  <label htmlFor="titulo">Título del evento</label>
  <input
    id="titulo"
    type="text"
    value={titulo}
    onChange={e => setTitulo(e.target.value)}
    className={styles.input}
    placeholder="Ej: Reunión importante"
    maxLength={50}
    required
  />

  <label htmlFor="mensaje">Mensaje de recordatorio</label>
  <textarea
    id="mensaje"
    value={mensaje}
    onChange={e => setMensaje(e.target.value)}
    className={styles.textarea}
    rows={3}
    placeholder="Ej: No olvides los documentos!"
    maxLength={200}
  />

  <label htmlFor="aviso">Programar notificación</label>
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
    {id ? 'Guardar Cambios' : 'Crear Evento'}
  </button>
</form>

    </div>
  );
}