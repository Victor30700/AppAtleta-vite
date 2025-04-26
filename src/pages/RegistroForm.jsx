// src/pages/RegistroForm.jsx
import React, { useEffect, useState, useMemo } from 'react';
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
  // Ahora permitimos elegir la fecha o tomar la de editRecord
  const [fecha, setFecha] = useState(
    editRecord?.fecha || new Date().toISOString().split('T')[0]
  );
  const [plan, setPlan] = useState(editRecord?.plan || '');
  const [gymDone, setGymDone] = useState(editRecord?.gymDone || false);
  const [estadoFisico, setEstadoFisico] = useState(editRecord?.estadoFisico || 5);
  const [animo, setAnimo] = useState(editRecord?.animo || 3);
  const [sensaciones, setSensaciones] = useState(editRecord?.sensaciones || '');
  const [seriesInputs, setSeriesInputs] = useState(editRecord?.series || []);
  const [promedios, setPromedios] = useState(editRecord?.promedios || []);
  const [sleepHours, setSleepHours] = useState(
    editRecord?.sleepHours?.toString() || ''
  );
  const [saving, setSaving] = useState(false);

  const sleepRecommendation = useMemo(() => {
    const h = Number(sleepHours);
    if (isNaN(h) || h < 1) return '';
    if (h <= 3) return 'Crítico: muy pocas horas de sueño.';
    if (h <= 5) return 'Insuficiente: no es ideal para entrenar.';
    if (h <= 7) return 'Aceptable: descanso moderado.';
    if (h === 8) return 'Óptimo: sueño perfecto para recuperación.';
    if (h <= 10) return 'Exceso: posible somnolencia.';
    return '';
  }, [sleepHours]);

  const docControles = user?.email && doc(db, 'controlesPB', user.email);
  const docRegistro = user?.email && doc(db, 'registroEntreno', user.email);

  useEffect(() => {
    if (user) {
      (async () => {
        const snap = await getDoc(docControles);
        setControles(snap.exists() ? snap.data() : {});
      })();
    }
  }, [user]);

  // Cuando editamos, precargamos TODO, incluida la fecha
  useEffect(() => {
    if (editRecord) {
      setFecha(editRecord.fecha);
      setPlan(editRecord.plan || '');
      setGymDone(editRecord.gymDone || false);
      setEstadoFisico(editRecord.estadoFisico || 5);
      setAnimo(editRecord.animo || 3);
      setSensaciones(editRecord.sensaciones || '');
      setSeriesInputs(editRecord.series || []);
      setPromedios(editRecord.promedios || []);
      setSleepHours(editRecord.sleepHours?.toString() || '');
    }
  }, [editRecord]);

  const handleSeriesChange = (idx, field, val) => {
    setSeriesInputs(prev => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: val };
      if (field === 'pruebaKey') {
        const baseValor = getLatestTime(val, controles);
        copy[idx].base = baseValor ?? null;
        copy[idx].sugerido = null;
      }
      return copy;
    });
  };

  const calcularSugerido = idx => {
    setSeriesInputs(prev => {
      const copy = [...prev];
      const e = copy[idx];
      if (e.base == null || !e.porcentaje) return copy;
      const porcentaje = parseFloat(e.porcentaje);
      copy[idx].sugerido = porcentaje
        ? ((e.base * 100) / porcentaje).toFixed(2)
        : null;
      return copy;
    });
  };

  const agregarSerie = () =>
    setSeriesInputs(prev => [
      ...prev,
      { pruebaKey: '', base: null, porcentaje: '', sugerido: null }
    ]);
  const eliminarUltimaSerie = () =>
    setSeriesInputs(prev => prev.slice(0, -1));
  const agregarPromedio = () =>
    setPromedios(prev => [
      ...prev,
      { pruebaKey: '', series: [], promedio: null }
    ]);
  const eliminarUltimoPromedio = () =>
    setPromedios(prev => prev.slice(0, -1));

  const calcularPromedios = () => {
    setPromedios(prev =>
      prev.map(p => {
        const vals = p.series
          .map(s => parseFloat(s))
          .filter(n => !isNaN(n));
        const prom = vals.length
          ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2)
          : null;
        return { ...p, promedio: prom };
      })
    );
  };

  const handleGuardar = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const nuevo = {
        fecha,
        plan: plan.trim(),
        gymDone,
        estadoFisico,
        animo,
        sensaciones: sensaciones.trim() || null,
        sleepHours: sleepHours ? Number(sleepHours) : null,
        sleepRecommendation,
        series: seriesInputs,
        promedios
      };

      const snap = await getDoc(docRegistro);
      const existing = snap.exists() ? snap.data().registros || [] : [];
      const updated = editRecord
        ? existing.map((r, i) => (i === editRecord.index ? nuevo : r))
        : [nuevo, ...existing];
      await setDoc(docRegistro, { registros: updated });
      navigate('/registro');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="registro-container">
      <div className="header">
        <button
          className="btn red back-btn"
          onClick={() => navigate('/registro')}
          disabled={saving}
        >
          Volver
        </button>
        <h2>{editRecord ? 'Editar Registro' : 'Nuevo Registro'}</h2>
      </div>

      {/* Fecha de entrenamiento */}
      <div className="form-group">
        <label>Fecha de entrenamiento</label>
        <input
          type="date"
          value={fecha}
          onChange={e => setFecha(e.target.value)}
          disabled={saving}
        />
      </div>

      {/* Plan de entrenamiento */}
      <div className="form-group">
        <label>Plan de entrenamiento</label>
        <textarea
          value={plan}
          onChange={e => setPlan(e.target.value)}
          disabled={saving}
        />
      </div>

      {/* Gym cumplido */}
      <div className="form-group inline">
        <label>Plan Gym Cumplido</label>
        <input
          type="checkbox"
          checked={gymDone}
          onChange={e => setGymDone(e.target.checked)}
          disabled={saving}
        />
      </div>

      {/* Sensaciones */}
      <div className="form-group">
        <label>Sensaciones (opcional)</label>
        <textarea
          className="textarea-sensaciones"
          placeholder="Describe cómo te sentiste..."
          value={sensaciones}
          onChange={e => setSensaciones(e.target.value)}
          disabled={saving}
        />
      </div>

      {/* Pruebas / Series */}
      <h3>Pruebas / Series</h3>
      {seriesInputs.map((e, i) => (
        <div key={i} className="series-row">
          <select
            value={e.pruebaKey}
            onChange={v => handleSeriesChange(i, 'pruebaKey', v.target.value)}
            disabled={saving}
          >
            <option value="">Selecciona prueba</option>
            {Object.keys(controles).map(key => (
              <option key={key} value={key}>
                {key}
              </option>
            ))}
          </select>
          <span>{e.base ?? '-'}</span>
          <input
            type="number"
            placeholder="Porcentaje %"
            value={e.porcentaje}
            onChange={v => handleSeriesChange(i, 'porcentaje', v.target.value)}
            disabled={saving}
          />
          <button onClick={() => calcularSugerido(i)} disabled={saving}>
            Calcular
          </button>
          <span>{e.sugerido ?? '-'}</span>
        </div>
      ))}
      <div className="button-group-inline">
        <button className="btn" onClick={agregarSerie} disabled={saving}>
          Agregar prueba
        </button>
        <button
          className="btn danger"
          onClick={eliminarUltimaSerie}
          disabled={!seriesInputs.length || saving}
        >
          Eliminar prueba
        </button>
      </div>

      {/* Repeticiones */}
      <h3>Registra tus repeticiones</h3>
      {promedios.map((p, i) => (
        <div key={i} className="promedio-box">
          <input
            type="text"
            placeholder="Prueba"
            value={p.pruebaKey}
            onChange={e => {
              const copy = [...promedios];
              copy[i].pruebaKey = e.target.value;
              setPromedios(copy);
            }}
            disabled={saving}
          />
          {p.series.map((s, j) => (
            <input
              key={j}
              type="number"
              placeholder={`Serie ${j + 1}`}
              value={s}
              onChange={e => {
                const copy = [...promedios];
                copy[i].series[j] = e.target.value;
                setPromedios(copy);
              }}
              disabled={saving}
            />
          ))}
          <button
            onClick={() => {
              const copy = [...promedios];
              copy[i].series.push('');
              setPromedios(copy);
            }}
            disabled={saving}
          >
            + Serie
          </button>
          <button
            onClick={() => {
              const copy = [...promedios];
              copy[i].series = copy[i].series.slice(0, -1);
              setPromedios(copy);
            }}
            disabled={!p.series.length || saving}
          >
            - Serie
          </button>
          <span>Promedio: {p.promedio ?? '-'}</span>
        </div>
      ))}
      <div className="button-group-inline">
        <button className="btn" onClick={agregarPromedio} disabled={saving}>
          Agregar bloque de repes
        </button>
        <button
          className="btn danger"
          onClick={eliminarUltimoPromedio}
          disabled={!promedios.length || saving}
        >
          Eliminar bloque
        </button>
      </div>
      {promedios.length > 0 && (
        <button className="btn" onClick={calcularPromedios} disabled={saving}>
          Calcular Promedios
        </button>
      )}

      {/* Estado físico */}
      <div className="form-group">
        <label>Estado físico: {estadoFisico}</label>
        <input
          type="range"
          min="1"
          max="10"
          value={estadoFisico}
          onChange={e => setEstadoFisico(+e.target.value)}
          disabled={saving}
        />
      </div>

      {/* Ánimo */}
      <div className="form-group">
        <label>Ánimo</label>
        <div className="animo-group">
          {MOODS.map(m => (
            <span
              key={m.value}
              className={animo === m.value ? 'selected' : ''}
              onClick={() => !saving && setAnimo(m.value)}
            >
              {m.icon}
            </span>
          ))}
        </div>
      </div>

      {/* Horas de sueño */}
      <div className="form-group">
        <label>Horas de sueño (1–10)</label>
        <input
          type="number"
          min="1"
          max="10"
          value={sleepHours}
          onChange={e => setSleepHours(e.target.value)}
          disabled={saving}
        />
        {sleepRecommendation && (
          <p className="sleep-msg">{sleepRecommendation}</p>
        )}
      </div>

      {/* Guardar */}
      <div className="button-group">
        <button
          className="btn save"
          onClick={handleGuardar}
          disabled={saving}
        >
          {editRecord ? 'Actualizar Registro' : 'Guardar Registro'}
        </button>
      </div>
    </div>
  );
}
