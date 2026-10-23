import { Server } from 'socket.io';
import { config } from './config.js';
import { isStaff, userFromToken } from './auth.js';

let io = null;

export function initRealtime(httpServer) {
  io = new Server(httpServer, {
    path: '/socket.io',
    cors: { origin: config.corsOrigins, credentials: true },
  });

  io.use(async (socket, next) => {
    try {
      socket.data.user = await userFromToken(socket.handshake.auth?.token);
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const user = socket.data.user;
    socket.join(`user:${user.id}`);
    if (isStaff(user)) socket.join('staff');
    if (user.patient) socket.join(`patient:${user.patient.id}`);

    socket.on('typing', ({ patientId } = {}) => {
      const pid = user.patient?.id || patientId;
      if (!pid || (!isStaff(user) && pid !== user.patient?.id)) return;
      socket.to(`patient:${pid}`).to('staff').emit('typing', { patientId: pid, userId: user.id, name: user.name });
    });
  });

  return io;
}

/** Emits an event to everybody who participates in a patient's conversation. */
export function emitToPatient(patientId, event, payload) {
  io?.to(`patient:${patientId}`).to('staff').emit(event, payload);
}

export function emitToUser(userId, event, payload) {
  io?.to(`user:${userId}`).emit(event, payload);
}
