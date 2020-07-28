import buildComponent from '\0component-ioc:build-component';

const userSourceCode = {};

export async function findSourceCode(path) {
    let src;
    src = userSourceCode[path];
    if (!src)
        src = (await fetch('/build' + path + '.svelte')).text();
    if (!src)
        src = '<script>\n\n</script>';
    return src;
}

export async function replaceComponent(fileName, src) {
    userSourceCode[fileName] = src;
    window.__DIS__.replace(fileName, await buildComponent(fileName, src));
}

export function loadScript(src) {
    return new Promise(resolve => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        document.head.appendChild(script);
    });
}

export function loadCss(href) {
    return new Promise(resolve => {
        const link = document.createElement('link');
        link.type = 'text/css';
        link.rel = 'stylesheet';
        link.href = href;
        link.onload = resolve;
        document.head.appendChild(link);
    });
}