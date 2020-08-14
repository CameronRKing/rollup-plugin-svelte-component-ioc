import path from 'path';
import fs from 'fs';
import findit from 'findit'
import { createFilter } from '@rollup/pluginutils';


export default function componentIoc(options = {}) {
    const filter = createFilter(options.include, options.exclude);

    function pathRelativeToRoot(str) {
        return str.replace(options.root, '').replace(/\\/g, '/');
    }

    // these can probably be combined, but I'll leave them alone for now
    // in case it's every useful to know where a dependency came from
    const componentDefinitions = new Set();
    let dependencyList;
    return {
        name: 'component-ioc',
        buildStart() {
            if (options.includeDependencies === false) {
                dependencyList = ['svelte/internal', 'svelte'];
            } else {
                const pack = JSON.parse(fs.readFileSync(options.root + '/package.json', 'utf8'));
                dependencyList = Object.keys(pack.dependencies);
                dependencyList.push('svelte/internal');
                dependencyList.push('svelte');
            }

            const finder = findit(options.root);
            finder.on('file', file => {
                if (options.ignore && options.ignore.some(toIgnore => pathRelativeToRoot(file).startsWith(toIgnore))) return;
                
                if (!file.endsWith('.svelte')) return;

                // source files to be exposed from the `extraDependencies` option will be emitted in transform(),
                // since we don't know where the source may be coming from
                if (options.exposeSource) 
                    this.emitFile({ 
                        type: 'asset',
                        source: fs.readFileSync(file, 'utf8'),
                        fileName: pathRelativeToRoot(file).slice(1) // ignore starting slash
                    });

                componentDefinitions.add(pathRelativeToRoot(file));
            });
            return new Promise(resolve => finder.on('end', resolve));
        },
        resolveId(id, importer) {
            if (id.startsWith('\0component-ioc:')) return id;
        },
        load(id) {
            if (id == '\0component-ioc:build-component') return fs.readFileSync(path.resolve(__dirname, './build-component.js'), 'utf8');
            if (id !== '\0component-ioc:component-store') return;

            const cmps = Array.from(componentDefinitions).map(path => ({
                path,
                name: path.replace(/[/-]/g, '').replace('.svelte', ''),
                file: '.' + path
            }));

            const extraDeps = options.extraDependencies || {};
            const importedExtras = Object.keys(extraDeps)
                .filter(key => extraDeps[key].type == 'import')
                .map(key => [key, extraDeps[key]]);
            const literalExtras = Object.keys(extraDeps)
                .filter(key => extraDeps[key].type == 'code')
                .map(key => [key, extraDeps[key]]);

            let depId = 0;
            const imports = [
                ...cmps.map(({ name, file }) => `import ${name} from '${file}';`),
                ...dependencyList.map(dependency => `import * as dep${depId++} from '${dependency}';`),
                ...importedExtras.map(([_, { path, defaultOnly }]) => `import ${defaultOnly ? '' : '* as '}dep${depId++} from '${path}';`),
            ];

            depId = 0;
            const props = [
                ...cmps.map(({ path, name }) => `'${path}': ${name}`),
                ...dependencyList.map(dependency => `'${dependency}': dep${depId++}`),
                ...importedExtras.map(([key]) => `'${key}': dep${depId++}`),
                ...literalExtras.map(([key, { code }]) => `'${key}': ${code}`)
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
    buildComponent,
    async replaceComponent(name, source) {
        store.userSourceCode[name] = source;
        store.replace(name, await buildComponent(name, source));
    },
    async lookupSource(name) {
        let src = store.userSourceCode[name] || '';
        if (!src) {
            // this lookup path is likely to be an issue in projects with custom setups
            const response = await fetch('/build' + (name.startsWith('/') ? '' : '/') + name);
            if (response.ok)
                src = await response.text();
        }
        if (!src && typeof store.get()[name] == 'function') {
            return store.get()[name].toString();
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

            if (!filter(id)) return;

            const extraDeps = options.extraDependencies;
            if (extraDeps && Object.values(extraDeps).some(dep => dep.type == 'import' && dep.path == id)) {
                this.emitFile({
                    type: 'asset',
                    fileName: id,
                    source: code
                });
            }

            if (!id.endsWith('.svelte')) return;


            let src = code;
            const replace = (...args) => src = src.replace(...args);
            const idPath = pathRelativeToRoot(id);

            replace('<script>', `<script>import __DIS__ from '\0component-ioc:component-store'; const __dis_src__ = '${idPath}';`);

            // replace imports of svelte components with dependency store injections
            let match;
            while (match = src.match(/(?<!\/\*\* @ioc-ignore \*\/\s*)import (\w+) from ['"]([^'"]*)\.svelte['"]/)) {
                const [str, cmpName, relativePath] = match;
                let importId;
                // this bit is a little magical
                // getting rollup-plugin-related import names to properly resolve is proving to be troublesome
                if (idPath.startsWith('/'))
                    importId = path.posix.resolve(path.dirname(idPath), relativePath);
                else
                    importId = path.posix.resolve('/' + path.dirname(idPath), relativePath).slice(1);
                replace(str, `$: ${cmpName} = $__DIS__['${importId}.svelte']`);
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