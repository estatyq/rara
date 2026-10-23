import { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { token, user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [activeAlert, setActiveAlert] = useState(null);

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

    s.on('connect', () => {
      // Connected
    });

    s.on('dose:due', (data) => {
      setActiveAlert({
        type: 'dose',
        title: 'Waktunya Minum Obat! 💊',
        message: `Jadwal obat: ${data.medication}`,
        time: new Date().toLocaleTimeString(),
      });
    });

    setSocket(s);

    return () => {
      s.disconnect();
    };
  }, [token, user]);

  return (
    <SocketContext.Provider value={{ socket, activeAlert, clearAlert: () => setActiveAlert(null) }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) throw new Error('useSocket must be used within a SocketProvider');
  return context;
}
