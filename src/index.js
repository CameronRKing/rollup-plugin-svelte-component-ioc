import path from 'path';
import fs from 'fs';
import findit from 'findit'
import { createFilter } from '@rollup/pluginutils';

export default function componentIoc(options = {}) {
    const filter = createFilter(options.include, options.exclude);

    function pathRelativeToRoot(str) {
        return str.replace(options.root, '').replace(/\\/g, '/');
    }

    const componentDefinitions = new Set();
    let dependencyList;
    return {
        name: 'component-ioc',
        buildStart() {
            if (options.dependencies === false) {
                dependencyList = ['svelte/internal'];
            } else {
                const pack = JSON.parse(fs.readFileSync(options.root + '/package.json', 'utf8'));
                dependencyList = Object.keys(pack.dependencies);
                dependencyList.push('svelte/internal');
            }

            const finder = findit(options.root);
            finder.on('file', file => {
                if (pathRelativeToRoot(file).startsWith('/public')) return;
                if (!file.endsWith('.svelte')) return;

                if (options.exposeSource) 
                    this.emitFile({ 
                        type: 'asset',
                        source: fs.readFileSync(file, 'utf8'),
                        fileName: pathRelativeToRoot(file).slice(1) 
                    });                   
                componentDefinitions.add(
                    pathRelativeToRoot(file).replace('.svelte', '')
                );
            });
            return new Promise(resolve => finder.on('end', resolve));
        },
        resolveId(id, importer) {
            if (id.startsWith('\0component-ioc:')) return id;
        },
        load(id) {
            // ??? why must I include the ./src for it to find the file? It makes no sense
            if (id == '\0component-ioc:build-component') return fs.readFileSync('./src/build-component.js', 'utf8');
            if (id !== '\0component-ioc:component-store') return;

            const cmps = Array.from(componentDefinitions).map(path => ({
                path,
                name: path.replace(/\//g, ''),
                file: '.' + path + '.svelte'
            }));
            let depId = 0;
            const imports = [
                ...cmps.map(({ name, file }) => `import ${name} from '${file}';`),
                ...dependencyList.map(dependency => `import * as dep${depId++} from '${dependency}';`)
            ];

            depId = 0;
            const props = [
                ...cmps.map(({ path, name }) => `'${path}': ${name}`),
                ...dependencyList.map(dependency => `'${dependency}': dep${depId++}`)
            ];

            return `import { writable, get } from 'svelte/store';
import buildComponent from '\0component-ioc:build-component';
${imports.join('\n')}
const base = writable({
    ${props.join(',\n    ')}
});
const store = {
    userSourceCode: {},
    subscribe: base.subscribe,
    get: () => get(base),
    replace(name, newCmp) {
        base.update(store => {
            store[name] = newCmp;
            return store;
        });
    },
    async replaceFromSource(name, source) {
        store.userSourceCode[name] = source;
        store.replace(name, await buildComponent(name, source));
    },
    async lookupSource(name) {
        let src = store.userSourceCode[name] || '';
        if (!src) {
            // this lookup path is likely to be an issue in projects with custom setups
            const response = await fetch('/build' + name + '.svelte');
            if (response.ok)
                src = await response.text();
        }
        return src;
    }
};

window.__DIS__ = store;
export default store;
`;
            return storeDefinition;
        },
        transform(code, id) {
            if (!options.root) this.error('The option `root` (the root directory from which to relativize file names) is required. Suggested value: __dirname');
            if (!filter(id) || !id.endsWith('.svelte')) return;


            let src = code;
            const replace = (...args) => src = src.replace(...args);
            const idPath = pathRelativeToRoot(id);

            replace('<script>', `<script>import __DIS__ from '\0component-ioc:component-store';`);

            // replace imports of svelte components with dependency store injections
            let match;
            while (match = src.match(/import (\w+) from ['"]([^'"]*)\.svelte['"]/)) {
                const [str, cmpName, relativePath] = match;
                const importId = path.posix.resolve(path.dirname(idPath), relativePath);
                replace(str, `$: ${cmpName} = $__DIS__['${importId}']`);
            }

            // replace custom components with dynamic components
            replace(/<([A-Z]\w+)/g, '<svelte:component this={$1}');
            replace(/<\/[A-Z]\w+>/g, '</svelte:component>');

            return {
                code: src,
                // should probably return a source map
                map: null
            };
        },
    };
}