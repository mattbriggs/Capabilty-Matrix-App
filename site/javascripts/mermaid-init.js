let renderingMermaid = false;

async function renderMermaidDiagrams() {
  if (!window.mermaid || renderingMermaid) return;

  window.mermaid.initialize({ startOnLoad: false });
  renderingMermaid = true;
  document.querySelectorAll('pre.mermaid:not([data-processed="true"])').forEach((block) => {
    const diagram = document.createElement('div');
    diagram.className = 'mermaid';
    diagram.textContent = block.textContent;
    block.replaceWith(diagram);
  });
  try {
    await window.mermaid.run({ querySelector: '.mermaid:not([data-processed="true"])' });
  } finally {
    renderingMermaid = false;
  }
}

document$.subscribe(renderMermaidDiagrams);
