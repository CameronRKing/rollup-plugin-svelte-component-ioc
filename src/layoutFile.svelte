<script>
import { onMount } from 'svelte';
import svelte from 'svelte/compiler';
import App from './App.svelte';
import buildComponent from '\0component-ioc:build-component';

window.buildComponent = buildComponent;
window.replaceSource = async (fileName, src) => window.__DIS__.replace(fileName, await buildComponent(fileName, src));

function svelteComponent(name, CmpClass) {
    return [name, function(container, componentState) {
        return new CmpClass({
            target: container.getElement()[0],
            props: componentState
        });
    }];
}

function loadScript(src) {
    return new Promise(resolve => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        document.head.appendChild(script);
    });
}

function loadCss(href) {
    return new Promise(resolve => {
        const link = document.createElement('link');
        link.type = 'text/css';
        link.rel = 'stylesheet';
        link.href = href;
        link.onload = resolve;
        document.head.appendChild(link);
    });
}

let layout;
onMount(() => {
    const config = {
        content: [{
            type: 'row',
            content:[{
                type: 'column',
                content:[{
                    type: 'component',
                    componentName: 'App',
                    componentState: $$restProps
                }]
            }]
        }]
    };

    Promise.all([
        loadScript('http://code.jquery.com/jquery-1.11.1.min.js'),
        loadScript('https://golden-layout.com/files/latest/js/goldenlayout.min.js'),
        loadCss('https://golden-layout.com/files/latest/css/goldenlayout-base.css'),
        loadCss('https://golden-layout.com/files/latest/css/goldenlayout-light-theme.css')
    ]).then(() => {
        layout = new GoldenLayout(config);

        layout.registerComponent(...svelteComponent('App', App));

        setTimeout(() => layout.init(), 100);
        setTimeout(() => {
            const header = document.querySelector('.lm_header'),
                content = document.querySelector('.lm_content'),
                base = document.querySelector('.lm_goldenlayout');
            const contentBg = content.style.background,
                baseBg = base.style.background;

            window.stopEditing = () => {
                header.style.display = 'none';
                content.style.background = 'transparent';
                base.style.background = 'transparent';
            }

            window.editPage = () => {
                header.style.display = 'block';
                content.style.background = contentBg;
                base.style.background = baseBg;
            };

            window.stopEditing();
        }, 300);
    });

});

</script>