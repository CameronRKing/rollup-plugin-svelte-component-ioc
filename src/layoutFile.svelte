<script>
import { onMount } from 'svelte';
import svelte from 'svelte/compiler';
import StoreList from '../StoreList.svelte';
import AceEditor from '../AceEditor.svelte';
import App from './App.svelte';
import buildComponent from '\0component-ioc:build-component';
import { loadScript, loadCss, replaceComponent, findSourceCode } from '\0component-ioc:utils';

window.buildComponent = buildComponent;
window.replaceComponent = replaceComponent;

function registerSvelteComponent(name, CmpClass, callbacks={}) {
    return [name, function(container, componentState) {
        if (componentState.lm_title) {
            container.setTitle(componentState.lm_title);
        }
        const cmp = new CmpClass({
            target: container.getElement()[0],
            props: componentState
        });

        Object.keys(callbacks).forEach(event => cmp.$on(event, callbacks[event]));

        return cmp;
    }];
}

async function openFile({ detail: { path, newTab } }) {
    const content = await findSourceCode(path);

    const baseRow = layout.root.contentItems[0];

    const aceItem = {
        type: 'component',
        componentName: 'AceEditor',
        componentState: { content, path, lm_title: path }
    };

    if (baseRow.contentItems.length < 3) {
        baseRow.addChild({
            type: 'column',
            content: [aceItem]
        }, 1)
    } else {
        if (newTab)
            baseRow.contentItems[1].addChild(aceItem);
        else
            baseRow.contentItems[1].replaceChild(baseRow.contentItems[1].contentItems[0], aceItem);
    }
}

let layout;
let storeListOnPage = false;
$: window.l = layout;
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

        layout.registerComponent(...registerSvelteComponent('App', App));
        layout.registerComponent(...registerSvelteComponent('StoreList', StoreList, { open: openFile }));
        layout.registerComponent(...registerSvelteComponent('AceEditor', AceEditor));

        setTimeout(() => layout.init(), 100);
        setTimeout(() => {
            const header = document.querySelector('.lm_header'),
                content = document.querySelector('.lm_content'),
                base = document.querySelector('.lm_goldenlayout');
            const contentBg = content.style.background,
                baseBg = base.style.background;

            window.stopEditing = () => {
                const baseRow = layout.root.contentItems[0];

                while (baseRow.contentItems.length > 1) {
                    baseRow.removeChild(baseRow.contentItems[0]);
                }

                storeListOnPage = false;
                header.style.display = 'none';
                content.style.background = 'transparent';
                base.style.background = 'transparent';
            }

            window.editPage = () => {
                if (!storeListOnPage) {
                    const storeColDef = {
                        type: 'column',
                        content: [{
                            type: 'component',
                            componentName: 'StoreList'
                        }]
                    }
                    layout.root.contentItems[0].addChild(storeColDef, 0);
                    storeListOnPage = true;
                }
                header.style.display = 'block';
                content.style.background = contentBg;
                base.style.background = baseBg;
            };

            window.stopEditing();
        }, 300);
    });

});

</script>