import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { db } from '../config/firebase';
import { getAuth } from 'firebase/auth';
import { collection, addDoc, doc, getDoc, updateDoc } from 'firebase/firestore';
import '../styles/RegistroGymForm.css';

export default function RegistroGymForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const registroId = searchParams.get('id');
  const auth = getAuth();
  const user = auth.currentUser;

  const [peso, setPeso] = useState(0);
  const [porcentaje, setPorcentaje] = useState(0);
  const [resultado, setResultado] = useState(0);
  const [contador, setContador] = useState(0);
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [descripcion, setDescripcion] = useState('');

  useEffect(() => {
    const cargarRegistro = async () => {
      if (registroId) {
        try {
          const docRef = doc(db, 'registrosGym', registroId);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.email !== user.email) {
              alert("No tienes permiso para editar este registro.");
              return navigate('/registro-gym');
            }
            setPeso(data.peso || 0);
            setPorcentaje(data.porcentaje || 0);
            setResultado(data.resultado || 0);
            setContador(data.repeticiones || 0);
            setFechaInicio(data.fechaInicio || '');
            setFechaFin(data.fechaFin || '');
            setDescripcion(data.descripcion || '');
          }
        } catch (error) {
          console.error('Error al cargar el registro:', error);
        }
      }
    };

    if (user) {
      cargarRegistro();
    }
  }, [registroId, user, navigate]);

  const calcularPeso = () => {
    const resultado = (peso * porcentaje) / 100;
    setResultado(resultado);
  };

  const handleGuardar = async () => {
    const registro = {
      peso,
      porcentaje,
      resultado,
      repeticiones: contador,
      fechaInicio,
      fechaFin,
      descripcion,
      actualizadoEn: new Date().toISOString(),
      email: user.email,
    };

    try {
      if (registroId) {
        await updateDoc(doc(db, 'registrosGym', registroId), registro);
      } else {
        await addDoc(collection(db, 'registrosGym'), {
          ...registro,
          creadoEn: new Date().toISOString(),
        });
      }
      navigate('/registro-gym');
    } catch (error) {
      console.error('Error al guardar el registro:', error);
    }
  };

  return (
    <div className="lista-container">
      <button
        className="btn back"
        onClick={() => navigate(-1)}
        style={{ position: 'fixed', top: 10, left: 10, zIndex: 999 }}
      >
        Volver
      </button>

      <h2>{registroId ? 'Editar Registro' : 'Nuevo Registro'} de Entrenamiento</h2>

      {/* campos como antes... */}

      <div className="form-group">
        <label>Peso corporal (kg)</label>
        <input type="number" value={peso} onChange={e => setPeso(Number(e.target.value))} />
      </div>

      <div className="form-group">
        <label>Porcentaje (%)</label>
        <input type="number" value={porcentaje} onChange={e => setPorcentaje(Number(e.target.value))} />
      </div>

      <button className="btn" onClick={calcularPeso}>Calcular Peso</button>

      <div className="form-group">
        <label>Peso calculado (kg)</label>
        <input type="text" value={resultado.toFixed(2)} readOnly />
      </div>

      <div className="form-group">
        <label>Marca las veces que cumpliste el plan</label>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn" onClick={() => setContador(c => Math.max(0, c - 1))}>-</button>
          <span style={{ fontSize: '1.5rem', lineHeight: '40px' }}>{contador}</span>
          <button className="btn" onClick={() => setContador(c => c + 1)}>+</button>
        </div>
      </div>

      <div className="form-group">
        <label>Fecha de inicio</label>
        <input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} />
      </div>

      <div className="form-group">
        <label>Fecha de fin</label>
        <input type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)} />
      </div>

      <div className="form-group">
        <label>Descripción del plan</label>
        <textarea
          value={descripcion}
          onChange={e => setDescripcion(e.target.value)}
          style={{ height: 100, overflowY: 'scroll', width: '100%' }}
        />
      </div>

      <button className="btn" onClick={handleGuardar}>
        {registroId ? 'Actualizar' : 'Guardar'}
      </button>
    </div>
  );
}
