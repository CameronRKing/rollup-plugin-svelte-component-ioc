import { get } from 'svelte/store';
import svelte from 'svelte/compiler';

export default function buildComponent(fileName, code) {
    const transformed = transformComponent(fileName, code);    
    return compileComponent(fileName, transformed);
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

function compileComponent(filename, src) {
    const { js } = svelte.compile(src, { format: 'cjs', filename });

    let code = js.code;
    code = code.replace(/ require\(/g, ' await require(');
    code = code.replace('exports.default =', 'return');

    const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
    // 'require' indicates that this constructed function accepts a single argument so named
    const fn = new AsyncFunction('require', code);

    // our 'require' definition tries to resolve dependencies out of the store
    // before handing them off to ES6 browser import
    return fn(toImport => {
        const dep = get(window.__DIS__)[toImport];
        if (dep) return dep;
        return import(toImport);
    });
}