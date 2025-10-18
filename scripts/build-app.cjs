#!/usr/bin/env node
const fs = require('fs/promises');
const path = require('path');
const postcss = require('postcss');
const tailwindcss = require('tailwindcss');
const autoprefixer = require('autoprefixer');
const esbuild = require('esbuild');

if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'production';
}

const projectRoot = path.resolve(__dirname, '..');
const outDir = path.join(projectRoot, 'dist');
const assetsDir = path.join(outDir, 'assets');

async function ensureCleanOutput() {
  await fs.rm(outDir, { recursive: true, force: true });
  await fs.mkdir(assetsDir, { recursive: true });
}

function createEnvDefines() {
  const define = {
    'process.env.NODE_ENV': JSON.stringify('production'),
    'import.meta.env.MODE': JSON.stringify(process.env.NODE_ENV || 'production'),
    'import.meta.env.BASE_URL': JSON.stringify('/'),
    'import.meta.env.PROD': 'true',
    'import.meta.env.DEV': 'false',
  };

  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith('VITE_')) {
      define[`import.meta.env.${key}`] = JSON.stringify(value);
    }
  }

  return define;
}

function tailwindPlugin() {
  return {
    name: 'tailwind-postcss',
    setup(build) {
      build.onLoad({ filter: /\.css$/ }, async (args) => {
        const source = await fs.readFile(args.path, 'utf8');
        const result = await postcss([
          tailwindcss({ config: path.join(projectRoot, 'tailwind.config.js') }),
          autoprefixer(),
        ]).process(source, {
          from: args.path,
          map: { inline: false },
        });

        return {
          contents: result.css,
          loader: 'css',
          resolveDir: path.dirname(args.path),
          warnings: result.warnings().map((warning) => ({
            text: warning.text,
            location:
              warning.node && warning.node.source
                ? {
                    file: warning.node.source.input.file,
                    line: warning.line,
                    column: warning.column,
                  }
                : undefined,
          })),
          watchFiles: result.messages
            .filter((message) => message.type === 'dependency' && message.file)
            .map((message) => message.file),
        };
      });
    },
  };
}

async function bundleWithEsbuild() {
  return esbuild.build({
    entryPoints: [path.join(projectRoot, 'src/main.jsx')],
    outdir: assetsDir,
    bundle: true,
    splitting: true,
    format: 'esm',
    sourcemap: true,
    jsx: 'automatic',
    target: 'esnext',
    define: createEnvDefines(),
    plugins: [tailwindPlugin()],
    entryNames: '[name]',
    chunkNames: 'chunks/[name]-[hash]',
    assetNames: 'assets/[name]-[hash]',
    logLevel: 'info',
  });
}

async function writeHtml() {
  const htmlPath = path.join(projectRoot, 'index.html');
  const html = await fs.readFile(htmlPath, 'utf8');
  const updated = html.replace(
    /<script\s+type="module"\s+src="\/src\/main\.jsx"><\/script>/,
    '<script type="module" src="/assets/main.js"></script>'
  );
  await fs.writeFile(path.join(outDir, 'index.html'), updated, 'utf8');
}

async function copyStatic() {
  const publicDir = path.join(projectRoot, 'public');
  try {
    const entries = await fs.readdir(publicDir, { withFileTypes: true });
    for (const entry of entries) {
      const srcPath = path.join(publicDir, entry.name);
      const destPath = path.join(outDir, entry.name);
      if (entry.isDirectory()) {
        await fs.cp(srcPath, destPath, { recursive: true });
      } else {
        await fs.copyFile(srcPath, destPath);
      }
    }
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
}

async function build() {
  await ensureCleanOutput();
  await bundleWithEsbuild();
  await writeHtml();
  await copyStatic();
}

build().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
