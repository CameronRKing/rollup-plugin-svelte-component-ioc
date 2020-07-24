const path = require('path');

export default function componentIoc() {
    const componentDefinitions = [];

    return {
        name: 'component-ioc',
        buildStart() {
            // storeRefId = this.emitFile({ type: 'asset', name: '__component-store' });
        },
        resolveId(id) {
            if (id !== 'component-store') return;
            return '\0component-ioc:component-store';
        },
        load(id) {
            if (id !== '\0component-ioc:component-store') return;

            const cmps = componentDefinitions.map(path => ({
                path,
                name: path.replace(/\//g, ''),
                file: '.' + path + '.svelte'
            }));
            const imports = cmps.map(({ name, file }) => `import ${name} from '${file}';`);
            const props = cmps.map(({ path, name }) => `'${path}': ${name}`);

            return `import { writable } from 'svelte/store';
${imports.join('\n')}
const base = writable({
    ${props.join(',\n    ')}
});
const store = {
    subscribe: base.subscribe,
    replace(name, newCmp) {
        base.update(store => {
            store[name] = newCmp;
            return store;
        });
    }
};

window.__dis__ = store;
export default store;
`;
            return storeDefinition;
        },
        transform(code, id) {
            if (!id.endsWith('.svelte')) return;

            let src = code;
            const replace = (...args) => src = src.replace(...args);

            const idPath = id.replace(__dirname, '').replace('\\', '/');

            replace('<script>', `<script>import __DIS__ from 'component-store'`);


            // replace imports of svelte components with dependency store injections
            let match;
            while (match = src.match(/import (\w+) from ['"](.*)\.svelte['"]/)) {
                const [str, cmpName, relativePath] = match;
                const containingDir = path.dirname(idPath);
                const importId = path.posix.resolve(path.dirname(idPath), relativePath);
                componentDefinitions.push(importId);
                replace(str, `$: ${cmpName} = $__DIS__['${importId}']`);
            }

            replace(/<([A-Z]\w+)/g, '<svelte:component this={$1}');
            replace(/<\/[A-Z]\w+>/g, '</svelte:component>');

            return {
                code: src,
                map: null
            };
        },
    };
}