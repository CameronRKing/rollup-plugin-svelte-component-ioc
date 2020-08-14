import * as svelte from 'svelte/compiler';

export default function buildComponent(fileName, code, opts={}) {
    const transformed = transformComponent(fileName, code);    
    return compileComponent(fileName, transformed, opts);
}

function transformComponent(fileName, code) {
    let src = code;
    const replace = (...args) => src = src.replace(...args);

    replace('<script>', '<script>const __DIS__ = window.__DIS__;');

    // replace imports of svelte components with dependency store injections
    let match;
    while (match = src.match(/import (\w+) from ['"]([^'"]*)\.svelte['"]/)) {
        let [_, cmpName, importPath] = match;
        if (!importPath.startsWith('/')) importPath = resolveRelativePath(fileName, importPath);
        replace(str, `$: ${cmpName} = $__DIS__['${importPath}']`);
    }

    // replace custom components with dynamic components
    replace(/<([A-Z]\w+)/g, '<svelte:component this={$1}');
    replace(/<\/[A-Z]\w+>/g, '</svelte:component>');

    return src;
}

function resolveRelativePath(root, relative) {
    const baseUrl = 'http://doesntmatter.io';
    const rootUrl = new URL(root, baseUrl);
    const relativeUrl = new URL(relative, rootUrl);
    return relativeUrl.href.replace(baseUrl, ''); 
}

async function compileComponent(filename, src, opts={}) {
    if (opts.preprocess) {
        for (plugin of opts.preprocess) {
            src = await svelte.preprocess(src, plugin);
        }
    }

    const { js } = svelte.compile(src, { format: 'cjs', filename });

    let code = js.code;
    code = code.replace(/ require\(/g, ' await require(');
    code = code.replace('exports.default =', 'return');

    const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
    const fn = new AsyncFunction('require', code);

    return fn(toImport => {
        const dep = window.__DIS__.get()[toImport];
        if (dep) return dep;
        return import(toImport);
    });
}