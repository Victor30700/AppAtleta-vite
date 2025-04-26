// src/pages/RegistroGymForm.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { db } from '../config/firebase';
import { getAuth } from 'firebase/auth';
import {
  collection,
  addDoc,
  doc,
  getDoc,
  updateDoc
} from 'firebase/firestore';
import '../styles/RegistroGymForm.css';

export default function RegistroGymForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const registroId = searchParams.get('id');
  const auth = getAuth();
  const user = auth.currentUser;

  const [pesocorporal, setPesocorporal] = useState(0);
  const [percentInput, setPercentInput] = useState('');
  const [porcentajesCarga, setPorcentajesCarga] = useState([]);
  const [calculos, setCalculos] = useState([]);
  const [historialReps, setHistorialReps] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [modalEstado, setModalEstado] = useState(5);
  const [modalAnimo, setModalAnimo] = useState('neutral');
  const [plan, setPlan] = useState({ fechaInicio: '', fechaFin: '', descripcion: '' });

  useEffect(() => {
    async function cargarRegistro() {
      if (!registroId || !user) return;
      const docRef = doc(db, 'registrosGym', registroId);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) return;
      const data = docSnap.data();
      const recordEmail = data.metadata?.email || data.email;
      if (recordEmail !== user.email) {
        alert('No tienes permiso para editar este registro.');
        return navigate('/registro-gym');
      }
      setPesocorporal(data.peso || 0);
      setPorcentajesCarga(data.porcentajesCarga ?? data.porcentajes ?? []);
      setCalculos(data.calculos ?? data.calculados ?? []);
      setHistorialReps(data.historialReps ?? data.repHistory ?? []);
      setPlan(
        data.plan
          ? data.plan
          : {
              fechaInicio: data.fechaInicio || '',
              fechaFin: data.fechaFin || '',
              descripcion: data.descripcion || ''
            }
      );
    }
    cargarRegistro();
  }, [registroId, user, navigate]);

  const addPercentage = () => {
    const val = parseFloat(percentInput);
    if (isNaN(val) || val <= 0) return;
    setPorcentajesCarga((p) => [...p, val]);
    setPercentInput('');
  };
  const removePercentage = (idx) => {
    setPorcentajesCarga((p) => p.filter((_, i) => i !== idx));
  };
  const calcularPesos = () => {
    const results = porcentajesCarga.map((p) => ({
      porcentaje: p,
      pesoCalculado: +(pesocorporal * p / 100).toFixed(2)
    }));
    setCalculos(results);
  };

  const handleIncrement = () => setShowModal(true);
  const handleDecrement = () => {
    if (!historialReps.length) return;
    if (window.confirm('¿Seguro que quieres eliminar la última repetición?')) {
      setHistorialReps((h) => h.slice(0, -1));
    }
  };
  const saveModal = () => {
    const now = new Date().toISOString();
    setHistorialReps((h) => [...h, { fecha: now, estadoFisico: modalEstado, animo: modalAnimo }]);
    setShowModal(false);
  };
  const cancelModal = () => setShowModal(false);

  const handleGuardar = async () => {
    const registro = {
      peso: pesocorporal,
      porcentajesCarga,
      calculos,
      historialReps,
      repeticiones: historialReps.length,
      plan,
      metadata: {
        email: user.email,
        actualizadoEn: new Date().toISOString(),
        ...(registroId ? {} : { creadoEn: new Date().toISOString() })
      }
    };
    try {
      if (registroId) {
        await updateDoc(doc(db, 'registrosGym', registroId), registro);
      } else {
        await addDoc(collection(db, 'registrosGym'), registro);
      }
      navigate('/registro-gym');
    } catch (error) {
      console.error('Error al guardar el registro:', error);
    }
  };

  return (
    <div className="gym-form-container">
      <button className="btn back" onClick={() => navigate(-1)}>← Volver</button>
      <h2>{registroId ? 'Editar Registro GYM' : ''}</h2>

      <div className="form-group">
        <label>Peso corporal (kg)</label>
        <input type="number" value={pesocorporal} onChange={(e) => setPesocorporal(Number(e.target.value))} />
      </div>

      <div className="form-group">
        <label>% de carga</label>
        <div className="inline-group">
          <input type="number" placeholder="%" value={percentInput} onChange={(e) => setPercentInput(e.target.value)} />
          <button className="btn small" onClick={addPercentage}>+</button>
        </div>
        <ul className="percentage-list">
          {porcentajesCarga.map((p, i) => (
            <li key={i}>
              {p}% <button className="small-btn" onClick={() => removePercentage(i)}>✕</button>
            </li>
          ))}
        </ul>
      </div>

      <button className="btn full" onClick={calcularPesos}>Calcular pesos</button>

      <div className="form-group">
        <label>Pesos calculados</label>
        <ul className="results-list">
          {calculos.map((r, i) => (
            <li key={i}>{r.porcentaje}% → {r.pesoCalculado} kg</li>
          ))}
        </ul>
      </div>

      <div className="form-group">
        <label>Veces cumpliste el plan: {historialReps.length}</label>
        <div className="inline-group">
          <button className="btn small" onClick={handleDecrement}>–</button>
          <button className="btn small" onClick={handleIncrement}>+</button>
        </div>
      </div>

      <div className="form-group">
        <label>Fecha inicio</label>
        <input type="date" value={plan.fechaInicio} onChange={(e) => setPlan({ ...plan, fechaInicio: e.target.value })} />
      </div>
      <div className="form-group">
        <label>Fecha fin</label>
        <input type="date" value={plan.fechaFin} onChange={(e) => setPlan({ ...plan, fechaFin: e.target.value })} />
      </div>
      <div className="form-group">
        <label>Descripción del plan</label>
        <textarea value={plan.descripcion} onChange={(e) => setPlan({ ...plan, descripcion: e.target.value })} />
      </div>

      <button className="btn save full" onClick={handleGuardar}>{registroId ? 'Actualizar' : 'Guardar'}</button>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Registrar entrenamiento</h3>
            <div className="form-group">
              <label>Estado físico</label>
              <input type="range" min="1" max="10" value={modalEstado} onChange={(e) => setModalEstado(Number(e.target.value))} /> <span>{modalEstado}</span>
            </div>
            <div className="form-group">
              <label>Ánimo</label>
              <select value={modalAnimo} onChange={(e) => setModalAnimo(e.target.value)}>
                <option value="enojado">😠 Enojado</option>
                <option value="triste">😢 Triste</option>
                <option value="neutral">😐 Neutral</option>
                <option value="feliz">😊 Feliz</option>
                <option value="super motivado">🚀 Súper motivado</option>
              </select>
            </div>
            <div className="modal-actions">
              <button className="btn cancel" onClick={cancelModal}>Cancelar</button>
              <button className="btn save" onClick={saveModal}>Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
