/**
 * Acceso a localStorage tolerante a fallos (modo privado, almacenamiento bloqueado...).
 * La app sigue funcionando en memoria si el navegador no deja guardar.
 */
import type { StateStorage } from 'zustand/middleware';

const memory = new Map<string, string>();

export const safeStorage: StateStorage = {
  getItem(name) {
    try {
      return window.localStorage.getItem(name);
    } catch {
      return memory.get(name) ?? null;
    }
  },
  setItem(name, value) {
    try {
      window.localStorage.setItem(name, value);
    } catch {
      memory.set(name, value);
    }
  },
  removeItem(name) {
    try {
      window.localStorage.removeItem(name);
    } catch {
      memory.delete(name);
    }
  },
};

export const today = (): string => new Date().toISOString().slice(0, 10);

export const uid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
