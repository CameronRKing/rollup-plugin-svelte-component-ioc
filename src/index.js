import path from 'path';
import { createFilter } from '@rollup/pluginutils';

export default function componentIoc({ include, exclude, root }={}) {
    const filter = createFilter(include, exclude);
    const componentDefinitions = [];

    return {
        name: 'component-ioc',
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
            if (!root) this.error('The option `root` (the root directory from which to relativize file names) is required. Suggested value: __dirname');
            if (!filter(id) || !id.endsWith('.svelte')) return;

            let src = code;
            const replace = (...args) => src = src.replace(...args);

            const idPath = id.replace(root, '').replace('\\', '/');

            replace('<script>', `<script>import __DIS__ from '\0component-ioc:component-store';`);

            // replace imports of svelte components with dependency store injections
            let match;
            while (match = src.match(/import (\w+) from ['"]([^'"]*)\.svelte['"]/)) {
                const [str, cmpName, relativePath] = match;
                const importId = path.posix.resolve(path.dirname(idPath), relativePath);
                componentDefinitions.push(importId);
                replace(str, `$: ${cmpName} = $__DIS__['${importId}']`);
            }

            // replace custom components with dynamic components
            replace(/<([A-Z]\w+)/g, '<svelte:component this={$1}');
            replace(/<\/[A-Z]\w+>/g, '</svelte:component>');

            return {
                code: src,
                map: null
            };
        },
    };
}