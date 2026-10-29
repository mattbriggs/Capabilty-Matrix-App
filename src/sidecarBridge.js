import { invoke, isTauri } from '@tauri-apps/api/core';
import { createDesktopRepository, createSessionRepository } from './storage/repository';

export const isDesktop = () => isTauri();

// Python is the desktop validation boundary. In the browser preview there is no sidecar; callers rely on
// the browser validator, which shares the schema and fixture contract with Python.
export async function runSidecar(operation, payload = {}) {
  if (!isTauri()) return null;
  const raw = await invoke('process_data', { operation, payload: JSON.stringify({ operation, ...payload }) });
  return JSON.parse(raw);
}

export const createRepository = () => (isTauri() ? createDesktopRepository(invoke) : createSessionRepository());

export async function printPage() {
  if (isTauri()) await invoke('print_page');
  else window.print();
}
