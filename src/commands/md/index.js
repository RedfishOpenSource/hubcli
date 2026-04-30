import path from 'node:path';
import { mkdir, mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import os from 'node:os';
import { marked } from 'marked';
import { chromium } from 'playwright';
import pc from 'picocolors';
import { assertReadableFile, ensureOutputExtension, resolveInputPath, resolveOutputPath } from '../../core/paths.js';
import { getMermaidScriptPath, hasBundledBrowsers, isPackagedRuntime } from '../../core/runtime-paths.js';
import { createHtmlDocument } from '../../render/html-template.js';
import { startStaticServer } from '../../render/temp-server.js';

const MERMAID_SCRIPT_SOURCE = getMermaidScriptPath();
const IMAGE_TAG_PATTERN = /<img\b([^>]*?)\bsrc=(['"])(.*?)\2([^>]*)>/gi;

function isRewritableImageSource(source) {
  if (!source) {
    return false;
  }

  if (/^[a-zA-Z]:[\\/]/.test(source) || source.startsWith('\\\\')) {
    return true;
  }

  if (source.startsWith('#') || source.startsWith('//') || source.startsWith('/')) {
    return false;
  }

  return !/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(source);
}

function rewriteImageSources(html) {
  return html.replace(IMAGE_TAG_PATTERN, (match, before, quote, source, after) => {
    if (!isRewritableImageSource(source)) {
      return match;
    }

    const rewrittenSource = `/__hubcli_asset__?path=${encodeURIComponent(source)}`;
    return `<img${before}src=${quote}${rewrittenSource}${quote}${after}>`;
  });
}

export default {
  name: 'md',
  description: 'Convert a Markdown file to PDF with Mermaid support.',
  runtime: 'hybrid',
  pythonCommand: 'md',
  arguments: [
    { name: 'input', syntax: '<input>', description: 'source markdown file path' },
    { name: 'output', syntax: '<output>', description: 'target PDF file path' }
  ],
  async prepare({ input, output }) {
    const inputPath = resolveInputPath(input);
    const outputPath = ensureOutputExtension(resolveOutputPath(output), '.pdf');

    return {
      inputPath,
      outputPath
    };
  },
  async validate(args) {
    await assertReadableFile(args.inputPath, '.md');
    await mkdir(path.dirname(args.outputPath), { recursive: true });
  },
  getPythonArgs(args) {
    return {
      inputPath: args.inputPath
    };
  },
  async runNode(args, prepared) {
    const htmlBody = rewriteImageSources(marked.parse(prepared.markdown));
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'hubcli-'));
    const htmlPath = path.join(tempDir, 'document.html');
    const mermaidScriptPath = '/mermaid.min.js';
    const html = createHtmlDocument({
      title: prepared.title,
      body: htmlBody,
      mermaid: prepared.containsMermaid,
      mermaidScriptPath
    });

    try {
      await writeFile(htmlPath, html, 'utf8');
      if (prepared.containsMermaid) {
        const mermaidScriptContents = await readFile(MERMAID_SCRIPT_SOURCE, 'utf8');
        await writeFile(path.join(tempDir, 'mermaid.min.js'), mermaidScriptContents, 'utf8');
      }

      const server = await startStaticServer(tempDir, {
        assetRootDirectory: path.dirname(args.inputPath)
      });
      let browser;
      try {
        browser = await chromium.launch({ headless: true });
        const page = await browser.newPage();
        await page.goto(`${server.baseUrl}/document.html`, { waitUntil: 'networkidle' });
        if (prepared.containsMermaid) {
          await page.waitForFunction(() => globalThis.__HUBCLI_MERMAID_READY__ === true || Boolean(globalThis.__HUBCLI_MERMAID_ERROR__), null, { timeout: 15000 });
          const mermaidError = await page.evaluate(() => globalThis.__HUBCLI_MERMAID_ERROR__ ?? null);
          if (mermaidError) {
            throw new Error(`Mermaid render failed: ${mermaidError}`);
          }
        }
        await page.pdf({
          path: args.outputPath,
          format: 'A4',
          printBackground: true,
          margin: {
            top: '18mm',
            right: '14mm',
            bottom: '18mm',
            left: '14mm'
          }
        });
      } catch (error) {
        if (error instanceof Error && error.message.includes("Executable doesn't exist")) {
          if (isPackagedRuntime() || await hasBundledBrowsers()) {
            throw new Error('Bundled Chromium was not found in this release package. Reinstall hubcli or rebuild the release artifact.');
          }
          throw new Error('Playwright Chromium is not installed. Run `npx playwright install chromium` before using `hubcli md`.');
        }
        throw error;
      } finally {
        await browser?.close();
        await server.close();
      }
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }

    console.log(pc.green(`PDF written to ${args.outputPath}`));
  }
};
