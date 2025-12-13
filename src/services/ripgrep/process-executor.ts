/**
 * Ripgrep process execution
 */

import * as childProcess from 'child_process';
import * as readline from 'readline';
import { MAX_RESULTS } from './constants';

/**
 * Execute ripgrep command and return output
 */
export async function execRipgrep(bin: string, args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
        const rgProcess = childProcess.spawn(bin, args);
        const rl = readline.createInterface({
            input: rgProcess.stdout,
            crlfDelay: Infinity,
        });

        let output = '';
        let lineCount = 0;
        const maxLines = MAX_RESULTS * 5;

        rl.on('line', (line) => {
            if (lineCount < maxLines) {
                output += line + '\n';
                lineCount++;
            } else {
                rl.close();
                rgProcess.kill();
            }
        });

        let errorOutput = '';
        rgProcess.stderr.on('data', (data) => {
            errorOutput += data.toString();
        });

        rl.on('close', () => {
            if (errorOutput && output.length === 0) {
                reject(new Error(`ripgrep process error: ${errorOutput}`));
            } else {
                resolve(output);
            }
        });

        rgProcess.on('error', (error) => {
            reject(new Error(`ripgrep process error: ${error.message}`));
        });
    });
}