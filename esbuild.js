const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

/**
 * Copy mermaid library to dist/vendor for offline use in webview panels
 * Mermaid is a devDependency to avoid TypeScript type issues (d3 types require DOM lib)
 */
function copyMermaidLibrary() {
	const srcPath = path.join(__dirname, 'node_modules', 'mermaid', 'dist', 'mermaid.min.js');
	const destDir = path.join(__dirname, 'dist', 'vendor');
	const destPath = path.join(destDir, 'mermaid.min.js');

	// Create vendor directory if it doesn't exist
	if (!fs.existsSync(destDir)) {
		fs.mkdirSync(destDir, { recursive: true });
	}

	// Copy the file
	if (fs.existsSync(srcPath)) {
		fs.copyFileSync(srcPath, destPath);
		console.log('[build] Copied mermaid.min.js to dist/vendor/');
	} else {
		console.warn('[build] Warning: mermaid.min.js not found in node_modules');
		console.warn('[build] Run "npm install" first');
	}
}

/**
 * @type {import('esbuild').Plugin}
 */
const esbuildProblemMatcherPlugin = {
	name: 'esbuild-problem-matcher',

	setup(build) {
		build.onStart(() => {
			console.log('[watch] build started');
		});
		build.onEnd((result) => {
			result.errors.forEach(({ text, location }) => {
				console.error(`✘ [ERROR] ${text}`);
				console.error(`    ${location.file}:${location.line}:${location.column}:`);
			});
			console.log('[watch] build finished');
		});
	},
};

async function main() {
	// Copy mermaid library for offline webview use
	copyMermaidLibrary();

	// Main extension bundle
	const ctx = await esbuild.context({
		entryPoints: [
			'src/extension.ts'
		],
		bundle: true,
		format: 'cjs',
		minify: production,
		sourcemap: !production,
		sourcesContent: false,
		platform: 'node',
		outfile: 'dist/extension.js',
		external: ['vscode', 'better-sqlite3'],
		logLevel: 'silent',
		plugins: [
			esbuildProblemMatcherPlugin,
		],
	});

	// Standalone scanner script (no vscode dependency)
	const scannerCtx = await esbuild.context({
		entryPoints: [
			'src/scripts/scan-large-files.ts'
		],
		bundle: true,
		format: 'cjs',
		minify: production,
		sourcemap: false,
		platform: 'node',
		outfile: 'dist/scripts/scan-large-files.js',
		logLevel: 'silent',
	});

	if (watch) {
		await ctx.watch();
		await scannerCtx.watch();
	} else {
		await ctx.rebuild();
		await scannerCtx.rebuild();
		await ctx.dispose();
		await scannerCtx.dispose();
	}
}

main().catch(e => {
	console.error(e);
	process.exit(1);
});
