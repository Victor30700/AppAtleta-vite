import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../config/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getLatestTime } from '../utils/controlesUtils';
import { useNavigate, useLocation } from 'react-router-dom';
import '../styles/RegistroEntrenamiento.css';

const MOODS = [
  { value: 1, icon: '😢', label: 'Triste' },
  { value: 2, icon: '😠', label: 'Enojado' },
  { value: 3, icon: '😐', label: 'Neutral' },
  { value: 4, icon: '🙂', label: 'Feliz' },
  { value: 5, icon: '🤩', label: 'Súper' },
];

export default function RegistroForm() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const editRecord = location.state?.editRecord || null;

  const [controles, setControles] = useState({});
  const [plan, setPlan] = useState('');
  const [gymDone, setGymDone] = useState(false);
  const [estadoFisico, setEstadoFisico] = useState(5);
  const [animo, setAnimo] = useState(3);
  const [sensaciones, setSensaciones] = useState('');
  const [seriesInputs, setSeriesInputs] = useState([]);
  const [promedios, setPromedios] = useState([]);

  const docControles = user?.email && doc(db, 'controlesPB', user.email);
  const docRegistro = user?.email && doc(db, 'registroEntreno', user.email);

  useEffect(() => {
    const loadControles = async () => {
      const snap = await getDoc(docControles);
      setControles(snap.exists() ? snap.data() : {});
    };
    if (user) loadControles();
  }, [user]);

  useEffect(() => {
    if (editRecord) {
      setPlan(editRecord.plan || '');
      setGymDone(editRecord.gymDone || false);
      setEstadoFisico(editRecord.estadoFisico || 5);
      setAnimo(editRecord.animo || 3);
      setSensaciones(editRecord.sensaciones || '');
      setSeriesInputs(editRecord.series || []);
      setPromedios(editRecord.promedios || []);
    }
  }, [editRecord]);

  const handleSeriesChange = (idx, field, val) => {
    setSeriesInputs(prev => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: val };
      if (field === 'distancia') {
        const base = getLatestTime(val, controles);
        copy[idx].base = base;
        copy[idx].sugerido = null;
      }
      return copy;
    });
  };

  const calcularSugerido = idx => {
    setSeriesInputs(prev => {
      const copy = [...prev];
      const e = copy[idx];
      if (!e.base || !e.porcentaje) return copy;
      copy[idx].sugerido = ((e.base * 100) / parseFloat(e.porcentaje)).toFixed(2);
      return copy;
    });
  };

  const agregarSerie = () => {
    setSeriesInputs(prev => [...prev, { distancia: '', base: null, porcentaje: '', sugerido: null }]);
  };

  const agregarPromedio = () => {
    setPromedios(prev => [...prev, { distancia: '', series: [], promedio: null }]);
  };

  const calcularPromedios = () => {
    setPromedios(prev =>
      prev.map(p => {
        const tiempos = p.series.map(s => parseFloat(s)).filter(n => !isNaN(n));
        const prom = tiempos.length > 0
          ? (tiempos.reduce((a, b) => a + b, 0) / tiempos.length).toFixed(2)
          : null;
        return { ...p, promedio: prom };
      })
    );
  };

  const handleGuardar = async () => {
    const nuevo = {
      fecha: editRecord?.fecha || new Date().toISOString().split('T')[0],
      plan,
      gymDone,
      series: seriesInputs.map(e => ({
        distancia: e.distancia,
        base: e.base,
        porcentaje: parseFloat(e.porcentaje),
        sugerido: e.sugerido,
      })),
      promedios,
      estadoFisico,
      animo,
      sensaciones: sensaciones.trim() || null,
    };

    const snap = await getDoc(docRegistro);
    const existing = snap.exists() ? snap.data().registros || [] : [];

    let updated;
    if (editRecord) {
      updated = existing.map((r, i) => (i === editRecord.index ? nuevo : r));
    } else {
      updated = [nuevo, ...existing];
    }

    await setDoc(docRegistro, { registros: updated });
    navigate('/registro');
  };

  return (
    <div className="registro-container">
      <div className="header">
        <button className="btn red back-btn" onClick={() => navigate('/registro')}>
          Volver
        </button>
        <h2>{editRecord ? 'Editar Registro de Entrenamiento' : 'Nuevo Registro de Entrenamiento'}</h2>
      </div>

      <div className="form-group">
        <label>Plan de entrenamiento</label>
        <textarea value={plan} onChange={e => setPlan(e.target.value)} />
      </div>

      <div className="form-group inline">
        <label>Plan Gym Cumplido</label>
        <input
          type="checkbox"
          checked={gymDone}
          onChange={e => setGymDone(e.target.checked)}
        />
      </div>

      <h3>Distancia a correr</h3>
      {seriesInputs.map((e, i) => (
        <div key={i} className="series-row">
          <select
            value={e.distancia}
            onChange={v => handleSeriesChange(i, 'distancia', v.target.value)}
          >
            <option value="">Selecciona distancia</option>
            {Object.keys(controles).map(key => (
              <option key={key} value={key}>{key}</option>
            ))}
          </select>
          <span>{e.base ? `${e.base}s` : '-'}</span>
          <input
            type="number"
            placeholder="Porcentaje%"
            value={e.porcentaje}
            onChange={v => handleSeriesChange(i, 'porcentaje', v.target.value)}
          />
          <button onClick={() => calcularSugerido(i)}>Calcular</button>
          <span>{e.sugerido ? `${e.sugerido}s` : '-'}</span>
        </div>
      ))}
      <button className="btn" onClick={agregarSerie}> Agregar distancia</button>

      <h3>Registra tus series</h3>
      {promedios.map((p, i) => (
        <div key={i} className="promedio-box">
          <input
            type="text"
            placeholder="Distancia"
            value={p.distancia}
            onChange={e => {
              const copy = [...promedios];
              copy[i].distancia = e.target.value;
              setPromedios(copy);
            }}
          />
          {p.series.map((s, j) => (
            <input
              key={j}
              type="number"
              placeholder={`reps ${j + 1}`}
              value={s}
              onChange={e => {
                const copy = [...promedios];
                copy[i].series[j] = e.target.value;
                setPromedios(copy);
              }}
            />
          ))}
          <button
            onClick={() => {
              const copy = [...promedios];
              copy[i].series.push('');
              setPromedios(copy);
            }}
          >
            + reps
          </button>
          <span>Promedio: {p.promedio ? `${p.promedio}s` : '-'}</span>
        </div>
      ))}
      <button className="btn" onClick={agregarPromedio}> Agregar + series</button>
      {promedios.length > 0 && (
        <button className="btn" onClick={calcularPromedios}>Calcular Promedios</button>
      )}

      <div className="form-group">
        <label>Estado físico: {estadoFisico}</label>
        <input
          type="range"
          min="1"
          max="10"
          value={estadoFisico}
          onChange={e => setEstadoFisico(+e.target.value)}
        />
      </div>

      <div className="form-group">
        <label>Ánimo</label>
        <div className="animo-group">
          {MOODS.map(m => (
            <span
              key={m.value}
              className={animo === m.value ? 'selected' : ''}
              onClick={() => setAnimo(m.value)}
            >
              {m.icon}
            </span>
          ))}
        </div>
      </div>

      <div className="form-group">
        <label>Comentarios (opcional)</label>
        <textarea value={sensaciones} onChange={e => setSensaciones(e.target.value)} />
      </div>

      <div className="button-group">
        <button className="btn save" onClick={handleGuardar}>
          Guardar Registro
        </button>
      </div>
    </div>
  );
}
