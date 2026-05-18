/// <reference types="vite/client" />
import { io } from "socket.io-client";

// In production, AI Studio automatically sets APP_URL
export const socket = io(import.meta.env.VITE_APP_URL || window.location.origin, {
  autoConnect: false
});
