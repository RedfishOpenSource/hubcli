function escapeHtml(text) {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export function createHtmlDocument({ title, mermaidScriptPath, body, mermaid }) {
  const safeTitle = escapeHtml(title || 'hubcli document');
  const mermaidScripts = mermaid
    ? `
    <script src="${escapeHtml(mermaidScriptPath)}"></script>
    <script>
      const mermaidApi = globalThis.mermaid;
      mermaidApi.initialize({ startOnLoad: false, securityLevel: 'loose', theme: 'default' });
      const blocks = Array.from(document.querySelectorAll('pre code.language-mermaid'));
      for (const block of blocks) {
        const parent = block.parentElement;
        const source = block.textContent ?? '';
        const container = document.createElement('div');
        container.className = 'mermaid';
        container.textContent = source;
        parent.replaceWith(container);
      }
      Promise.resolve(mermaidApi.run({ querySelector: '.mermaid' }))
        .then(() => {
          globalThis.__HUBCLI_MERMAID_READY__ = true;
        })
        .catch((error) => {
          globalThis.__HUBCLI_MERMAID_ERROR__ = String(error);
        });
    </script>`
    : '<script>globalThis.__HUBCLI_MERMAID_READY__ = true;</script>';

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${safeTitle}</title>
    <style>
      :root {
        color-scheme: light;
        font-family: "Segoe UI", "Microsoft YaHei", sans-serif;
      }
      body {
        margin: 0 auto;
        max-width: 920px;
        padding: 32px;
        color: #1f2937;
        line-height: 1.7;
        background: #ffffff;
      }
      h1, h2, h3, h4, h5, h6 {
        color: #111827;
        line-height: 1.25;
        margin-top: 1.6em;
      }
      pre {
        background: #0f172a;
        color: #e5e7eb;
        padding: 16px;
        border-radius: 10px;
        overflow-x: auto;
      }
      code {
        font-family: "Cascadia Code", "JetBrains Mono", monospace;
      }
      blockquote {
        border-left: 4px solid #93c5fd;
        margin: 1.2em 0;
        padding: 0.1em 0 0.1em 1em;
        color: #475569;
        background: #eff6ff;
      }
      table {
        width: 100%;
        border-collapse: collapse;
      }
      th, td {
        border: 1px solid #d1d5db;
        padding: 8px 10px;
      }
      .mermaid {
        margin: 24px 0;
        display: flex;
        justify-content: center;
        background: #ffffff;
      }
    </style>
    ${mermaidScripts}
  </head>
  <body>
    ${body}
  </body>
</html>`;
}
