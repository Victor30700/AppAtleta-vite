// src/pages/RegistroGymDiario.jsx

import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../config/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useNavigate, useLocation } from 'react-router-dom';
import ConfirmModal from '../components/ConfirmModal';
import styles from '../styles/RegistroGymDiario.module.css';

// Genera un ID único sencillo
const generateUniqueId = () => `${Date.now()}-${Math.floor(Math.random() * 10000)}`;

export default function RegistroGymDiario() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // ¿Estamos editando un registro existente?
  const editId = new URLSearchParams(location.search).get('id');
  const isEditing = Boolean(editId);

  // Referencia Firestore para este usuario
  const docRef = useMemo(
    () => user?.email && doc(db, 'registroGymDiario', user.email),
    [user?.email]
  );

  // Estados del formulario
  const [recordId, setRecordId] = useState(editId || generateUniqueId());
  const [fecha, setFecha] = useState(new Date().toISOString().substr(0, 10));
  const [zona, setZona] = useState('');
  const [plan, setPlan] = useState('');
  const [unidadPeso, setUnidadPeso] = useState('kg');
  const [ejercicios, setEjercicios] = useState([
    { nombre: '', repeticiones: 1, descanso: 1, descansoSiguiente: 0, pesos: [''] }
  ]);
  const [sleepHours, setSleepHours] = useState('');
  const [showSaveModal, setShowSaveModal] = useState(false);

  // Cargar datos si estamos editando
  useEffect(() => {
    if (!loading && isEditing && docRef) {
      (async () => {
        const snap = await getDoc(docRef);
        if (!snap.exists()) return;
        const regs = snap.data().registros || [];
        const one = regs.find(r => r.id === editId);
        if (!one) return;
        setRecordId(one.id);
        setFecha(one.fecha);
        setZona(one.zona);
        setPlan(one.plan);
        setUnidadPeso(one.unidadPeso);
        setEjercicios(one.ejercicios);
        setSleepHours(one.sleepHours?.toString() || '');
      })();
    }
  }, [loading, isEditing, editId, docRef]);

  // Si salimos de editar, resetea formulario
  useEffect(() => {
    if (!isEditing && !loading) {
      setRecordId(generateUniqueId());
      setFecha(new Date().toISOString().substr(0, 10));
      setZona('');
      setPlan('');
      setUnidadPeso('kg');
      setEjercicios([{ nombre: '', repeticiones: 1, descanso: 1, descansoSiguiente: 0, pesos: [''] }]);
      setSleepHours('');
    }
  }, [loading, isEditing]);

  const handleAddEjercicio = () =>
    setEjercicios(prev => [
      ...prev,
      { nombre: '', repeticiones: 1, descanso: 1, descansoSiguiente: 0, pesos: [''] }
    ]);

  const handleEjercicioChange = (i, field, v) =>
    setEjercicios(prev => {
      const upd = [...prev];
      const ej = { ...upd[i] };
      if (field === 'repeticiones') {
        const reps = Number(v);
        ej.repeticiones = reps;
        ej.pesos = Array(reps).fill('');
      } else if (field.startsWith('peso_')) {
        const idx = Number(field.split('_')[1]);
        ej.pesos = [...ej.pesos];
        ej.pesos[idx] = v;
      } else {
        ej[field] = field === 'nombre' ? v : Number(v);
      }
      upd[i] = ej;
      return upd;
    });

  const confirmGuardar = async () => {
    if (!docRef) return;
    // Validaciones mínimas
    if (!plan.trim()) return alert('La descripción del plan no puede estar vacía.');
    if (!zona) return alert('Selecciona un área principal.');
    const h = Number(sleepHours);
    if (isNaN(h) || h < 1 || h > 10) return alert('Ingresa horas de sueño válidas (1–10).');
    if (ejercicios.some(e => !e.nombre.trim())) return alert('Completa el nombre de todos los ejercicios.');

    // Nuevo objeto de registro
    const nuevoRegistro = { id: recordId, fecha, zona, plan, unidadPeso, ejercicios, sleepHours: h };

    // Lee los existentes
    const snap = await getDoc(docRef);
    const existing = snap.exists() ? snap.data().registros || [] : [];

    // Reconstruye array: si editando, reemplaza sólo ese id; si no, antepone pero sin duplicarlo
    let updated;
    if (isEditing) {
      updated = existing.map(r => (r.id === recordId ? nuevoRegistro : r));
    } else {
      // evita duplicados si por algún motivo ya existe ese id
      if (existing.some(r => r.id === recordId)) {
        updated = existing.map(r => (r.id === recordId ? nuevoRegistro : r));
      } else {
        updated = [nuevoRegistro, ...existing];
      }
    }

    // Un único setDoc con merge
    await setDoc(docRef, { registros: updated }, { merge: true });

    setShowSaveModal(false);
    navigate('/registro-gym');
  };

  if (loading) return <p>Cargando...</p>;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate('/registro-gym')}>
          ← Volver
        </button>
        <h2>{isEditing ? 'Editar Registro Diario' : 'Registro Diario de Entrenamiento'}</h2>
      </div>

      {/* Fecha */}
      <div className={styles.formGroup}>
        <label>Fecha de entrenamiento</label>
        <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} disabled={isEditing}/>
      </div>
      {/* Zona */}
      <div className={styles.formGroup}>
        <label>Área principal trabajada</label>
        <select value={zona} onChange={e => setZona(e.target.value)}>
          <option value="">Selecciona zona</option>
          <option value="Inferior">Tren Inferior</option>
          <option value="Superior">Tren Superior</option>
          <option value="Core">Core / Abdomen</option>
          <option value="Full Body">Full Body</option>
          <option value="Cardio">Cardio</option>
        </select>
      </div>
      {/* Plan */}
      <div className={styles.formGroup}>
        <label>Descripción general del plan</label>
        <textarea
          className={styles.planTextarea}
          rows={4}
          placeholder="Ej: Circuito fuerza explosiva..."
          value={plan}
          onChange={e => setPlan(e.target.value)}
        />
      </div>
      {/* Unidad de peso */}
      <div className={styles.formGroup}>
        <label>Unidad de peso</label>
        <select value={unidadPeso} onChange={e => setUnidadPeso(e.target.value)}>
          <option value="kg">Kilogramos (kg)</option>
          <option value="lb">Libras (lb)</option>
        </select>
      </div>
      {/* Horas de sueño */}
      <div className={styles.formGroup}>
        <label>Horas de sueño</label>
        <input
          type="number"
          min="1"
          max="10"
          placeholder="Horas de sueño (1–10)"
          value={sleepHours}
          onChange={e => setSleepHours(e.target.value)}
        />
      </div>

      {/* Ejercicios */}
      <h3>Ejercicios Detallados</h3>
      <div className={styles.headersRow}>
        <span>Ejercicio</span>
        <span>Reps</span>
        <span>Descanso (min)</span>
        <span>Desc. Sig. (min)</span>
      </div>
      {ejercicios.map((ej, idx) => (
        <div key={idx} className={styles.ejercicioCard}>
          <div className={styles.ejercicioRow}>
            <input
              type="text"
              placeholder="Nombre del ejercicio"
              value={ej.nombre}
              onChange={e => handleEjercicioChange(idx, 'nombre', e.target.value)}
            />
            <input
              type="number"
              min="1"
              placeholder="Reps"
              value={ej.repeticiones}
              onChange={e => handleEjercicioChange(idx, 'repeticiones', e.target.value)}
            />
            <input
              type="number"
              min="0"
              placeholder="Descanso"
              value={ej.descanso}
              onChange={e => handleEjercicioChange(idx, 'descanso', e.target.value)}
            />
            <input
              type="number"
              min="0"
              placeholder="Desc. Sig."
              value={ej.descansoSiguiente}
              onChange={e => handleEjercicioChange(idx, 'descansoSiguiente', e.target.value)}
            />
          </div>
          <div className={styles.pesosContainer}>
            <label>Peso por repetición ({unidadPeso}):</label>
            {ej.pesos.map((p, pIdx) => (
              <input
                key={pIdx}
                type="number"
                min="0"
                placeholder={`Rep ${pIdx + 1}`}
                value={p}
                onChange={e => handleEjercicioChange(idx, `peso_${pIdx}`, e.target.value)}
              />
            ))}
          </div>
        </div>
      ))}
      <button className={styles.addBtn} onClick={handleAddEjercicio}>
        + Agregar ejercicio
      </button>

      {/* Guardar / Actualizar */}
      <ConfirmModal
        isOpen={showSaveModal}
        title={isEditing ? 'Confirmar Actualización' : 'Confirmar Guardado'}
        onConfirm={confirmGuardar}
        onCancel={() => setShowSaveModal(false)}
        confirmText={isEditing ? 'Actualizar Registro' : 'Guardar Registro'}
      >
        <p>
          {isEditing
            ? '¿Deseas actualizar este registro diario?'
            : '¿Deseas guardar este registro diario?'}
        </p>
      </ConfirmModal>
      <button className={styles.saveBtn} onClick={() => setShowSaveModal(true)}>
        {isEditing ? 'Actualizar Registro' : 'Guardar Registro'}
      </button>
    </div>
  );
}
