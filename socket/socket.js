import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import cookie from "cookie";

let io;

export const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: ["http://localhost:4201", "http://localhost:4200"],
      credentials: true,
    },
  });

  io.use((socket, next) => {
    try {
      const rawCookie = socket.handshake.headers.cookie;

      if (!rawCookie) {
        return next(new Error("No cookie"));
      }

      const parsed = cookie.parse(rawCookie);
      const token = parsed.access_token;

      if (!token) {
        return next(new Error("No token"));
      }

      const decoded = jwt.verify(token, process.env.SECRET_KEY);

      socket.user = decoded;

      next();
    } catch (err) {
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    const user = socket.user;

    socket.join(`admin_${user.id}`);

    // room chung admin
    if (user.role === "admin") {
      socket.join("admins");
    }

    console.log("Socket connected:", user.id);

    socket.on("disconnect", () => {});
  });

  return io;
};

export const getIO = () => {
  if (!io) throw new Error("Socket chưa init");
  return io;
};
