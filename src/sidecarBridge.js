import { invoke, isTauri } from '@tauri-apps/api/core';

export async function runSidecar(operation, capabilities) {
  if (!isTauri()) return { ok: true, mode: 'browser-preview' };
  const raw = await invoke('process_data', {
    operation,
    payload: JSON.stringify({ operation, capabilities }),
  });
  return JSON.parse(raw);
}

export async function loadDesktopYaml() {
  return isTauri() ? invoke('load_yaml') : null;
}

export async function saveDesktopYaml(yamlText) {
  if (isTauri()) await invoke('save_yaml', { yamlText });
}
