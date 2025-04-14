import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import audio1 from '../assets/audio1.mp3';
import audio2 from '../assets/audio2.mp3';
import audio3 from '../assets/audio3.mp3';
import '../styles/Partidas.css';

export default function Partidas() {
  const navigate = useNavigate();
  const [tiempo1, setTiempo1] = useState(2);
  const [tiempo2, setTiempo2] = useState(3);
  const [tiempo3, setTiempo3] = useState(1.5);
  const [estado, setEstado] = useState('Esperando');
  const [customPistola, setCustomPistola] = useState(null);
  const [secuenciaActiva, setSecuenciaActiva] = useState(false);

  const audioRef1 = useRef(null);
  const audioRef2 = useRef(null);
  const audioRef3 = useRef(null);
  const timeouts = useRef([]);

  const iniciarSecuencia = () => {
    if (secuenciaActiva) return; // prevenir múltiples inicios
    setSecuenciaActiva(true);
    setEstado('Preparando...');

    const timeout1 = setTimeout(() => {
      setEstado('A sus marcas...');
      reproducir(audioRef1);

      const timeout2 = setTimeout(() => {
        setEstado('Listo...');
        reproducir(audioRef2);

        const timeout3 = setTimeout(() => {
          setEstado('¡YA!');
          if (customPistola) {
            customPistola.currentTime = 0;
            customPistola.play();
          } else {
            reproducir(audioRef3);
          }

          const timeout4 = setTimeout(() => {
            setEstado('Secuencia finalizada');
            setSecuenciaActiva(false);
          }, 2000);

          timeouts.current.push(timeout4);
        }, tiempo3 * 1000);

        timeouts.current.push(timeout3);
      }, tiempo2 * 1000);

      timeouts.current.push(timeout2);
    }, tiempo1 * 1000);

    timeouts.current.push(timeout1);
  };

  const cancelarSecuencia = () => {
    timeouts.current.forEach(clearTimeout);
    timeouts.current = [];

    detener(audioRef1);
    detener(audioRef2);
    detener(audioRef3);
    if (customPistola) {
      customPistola.pause();
      customPistola.currentTime = 0;
    }

    setEstado('Esperando');
    setSecuenciaActiva(false);
  };

  const reproducir = (audioRef) => {
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
    audioRef.current.play();
  };

  const detener = (audioRef) => {
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
  };

  const handleAudioUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const customAudio = new Audio(URL.createObjectURL(file));
      setCustomPistola(customAudio);
    }
  };

  return (
    <div className="partida-background">
      <div className="partida-container">
        <button className="btn-home" onClick={() => navigate('/')}>
          ⬅ Volver al Inicio
        </button>

        <h2>Simulación de Partida 100m</h2>

        <div className="form-group">
          <label>Tiempo antes de "A sus marcas" (segundos):</label>
          <input type="number" value={tiempo1} min="0" step="0.1" onChange={e => setTiempo1(parseFloat(e.target.value))} />
        </div>

        <div className="form-group">
          <label>Tiempo entre "A sus marcas" y "Listo":</label>
          <input type="number" value={tiempo2} min="0" step="0.1" onChange={e => setTiempo2(parseFloat(e.target.value))} />
        </div>

        <div className="form-group">
          <label>Tiempo entre "Listo" y Pistola:</label>
          <input type="number" value={tiempo3} min="0" step="0.1" onChange={e => setTiempo3(parseFloat(e.target.value))} />
        </div>

        <div className="form-group">
          <label>Reemplazar sonido de la pistola:</label>
          <input type="file" accept="audio/*" onChange={handleAudioUpload} />
        </div>

        <div className="btn-group">
  <button className="btn-start" onClick={iniciarSecuencia} disabled={secuenciaActiva}>
    Iniciar Secuencia
  </button>

  {secuenciaActiva && (
    <button className="btn-cancel" onClick={cancelarSecuencia}>
      Cancelar
    </button>
  )}
</div>

        <h3>Estado: {estado}</h3>

        <audio ref={audioRef1} src={audio1} />
        <audio ref={audioRef2} src={audio2} />
        <audio ref={audioRef3} src={audio3} />
      </div>
    </div>
  );
}
