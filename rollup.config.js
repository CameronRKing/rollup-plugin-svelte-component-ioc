import resolve from '@rollup/plugin-node-resolve';
import commonJs from '@rollup/plugin-commonjs';
import fs from 'fs';
import path from 'path';

import pkg from './package.json';

function copyFile(self, name) {
    self.emitFile({
        type: 'asset',
        fileName: name,
        source: fs.readFileSync(path.resolve(__dirname, `./src/${name}`), 'utf8')
    });
}

export default {
    input: 'src/index.js',
    plugins: [
        resolve(),
        commonJs(),
        {
            buildStart() {
                copyFile(this, 'build-component.js');
            }
        }
    ],
    external: ['path', 'fs', 'events'],
    output: [
        { format: 'cjs', file: pkg.main, exports: 'auto' },
        { format: 'esm', file: pkg.module }
    ]
};