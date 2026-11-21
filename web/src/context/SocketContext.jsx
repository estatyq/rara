import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { useLanguage } from '../i18n/LanguageContext';

const SocketContext = createContext(null);

export function playAlarmChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.16);
      gain.gain.setValueAtTime(0.001, ctx.currentTime + idx * 0.16);
      gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + idx * 0.16 + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.16 + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + idx * 0.16);
      osc.stop(ctx.currentTime + idx * 0.16 + 0.3);
    });
  } catch {
    // Ignore autoplay restrictions before user interaction
  }
}

export function SocketProvider({ children }) {
  const { token, user } = useAuth();
  const { t, dateLocale } = useLanguage();
  const [socket, setSocket] = useState(null);
  const [activeAlert, setActiveAlert] = useState(null);
  const tRef = useRef(t);
  const dateLocaleRef = useRef(dateLocale);
  tRef.current = t;
  dateLocaleRef.current = dateLocale;

  const triggerAlarm = useCallback((payload) => {
    playAlarmChime();
    setActiveAlert({
      type: payload.type || 'dose',
      doseId: payload.doseId || null,
      medication: payload.medication || 'Medication',
      title: payload.title || tRef.current.alarm.pushHeader,
      message: payload.message || `${payload.medication || ''}${payload.dosage ? ` • ${payload.dosage}` : ''}`,
      dosage: payload.dosage || null,
      instructions: payload.instructions || null,
      time: new Date().toLocaleTimeString(dateLocaleRef.current, { hour: '2-digit', minute: '2-digit', hour12: false }),
    });
  }, []);

  useEffect(() => {
    if (!token || !user) {
      if (socket) socket.disconnect();
      setSocket(null);
      return;
    }

    const s = io('/', {
      auth: { token },
      path: '/socket.io',
      transports: ['websocket', 'polling'],
    });

    s.on('dose:due', (data) => {
      triggerAlarm({
        type: 'dose',
        doseId: data.doseId,
        medication: data.medication,
        dosage: data.dosage,
        instructions: data.instructions,
        title: tRef.current.alarm.pushHeader,
        message: `${data.medication}${data.dosage ? ` • ${data.dosage}` : ''}`,
      });
    });

    s.on('checkup:due', (data) => {
      triggerAlarm({
        type: 'checkup',
        medication: data.title,
        title: tRef.current.health.checkupsTitle,
        message: `${data.title}${data.location ? ` — ${data.location}` : ''}`,
      });
    });

    setSocket(s);

    return () => {
      s.disconnect();
    };
  }, [token, user, triggerAlarm]);

  const snoozeAlert = useCallback((minutes = 10) => {
    if (!activeAlert) return;
    const saved = { ...activeAlert };
    setActiveAlert(null);
    setTimeout(() => {
      triggerAlarm({
        ...saved,
        title: tRef.current.alarm.snoozedTitle,
      });
    }, minutes * 60 * 1000);
  }, [activeAlert, triggerAlarm]);

  return (
    <SocketContext.Provider
      value={{
        socket,
        activeAlert,
        clearAlert: () => setActiveAlert(null),
        snoozeAlert,
        triggerAlarm,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) throw new Error('useSocket must be used within a SocketProvider');
  return context;
}
