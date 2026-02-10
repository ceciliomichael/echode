const esbuild = require("esbuild");

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

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
		external: ['vscode', 'better-sqlite3', 'sharp'],
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
