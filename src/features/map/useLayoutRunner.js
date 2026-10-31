import { useCallback, useEffect, useRef, useState } from 'react';
import { organicLayout } from './layout.js';

// Run layouts in a Web Worker. A new run cancels the previous one (the worker is terminated), and only
// the latest result is committed. Falls back to a synchronous run where workers are unavailable.
export function useLayoutRunner() {
  const worker = useRef(null);
  const sequence = useRef(0);
  const pending = useRef(null);
  const [running, setRunning] = useState(false);
  const stop = useCallback(() => {
    worker.current?.terminate();
    worker.current = null;
    if (pending.current) { pending.current.resolve({ cancelled: true, positions: {} }); pending.current = null; }
    setRunning(false);
  }, []);
  useEffect(() => stop, [stop]);
  const run = useCallback((input) => {
    stop();
    const id = sequence.current += 1;
    if (typeof Worker === 'undefined') return Promise.resolve(organicLayout(input));
    setRunning(true);
    return new Promise((resolve) => {
      pending.current = { resolve };
      const instance = new Worker(new URL('./layout.worker.js', import.meta.url), { type: 'module' });
      worker.current = instance;
      instance.onmessage = (event) => {
        if (event.data.id !== id) return;
        instance.terminate();
        if (worker.current === instance) worker.current = null;
        pending.current = null;
        setRunning(false);
        resolve(event.data);
      };
      instance.onerror = () => { instance.terminate(); pending.current = null; setRunning(false); resolve(organicLayout(input)); };
      instance.postMessage({ id, input });
    });
  }, [stop]);
  return { run, cancel: stop, running };
}
