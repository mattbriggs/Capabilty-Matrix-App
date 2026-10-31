import { organicLayout } from './layout.js';

// Runs layouts off the main thread. The host terminates this worker to cancel an obsolete run.
self.onmessage = (event) => {
  const { id, input } = event.data;
  const started = performance.now();
  const result = organicLayout(input);
  self.postMessage({ id, ...result, ms: performance.now() - started });
};
