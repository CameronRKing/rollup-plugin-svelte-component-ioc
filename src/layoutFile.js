export default `<script>
import GoldenLayout from 'golden-layout';
import { onMount } from 'svelte';
import App from './App.svelte';

function svelteComponent(name, CmpClass) {
    return [name, function(container, componentState) {
        return new CmpClass({
            target: container.getElement()[0],
            props: componentState
        });
    }];
}

let container, layout;
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

    layout = new GoldenLayout(config);

    layout.registerComponent(...svelteComponent('App', App));

    setTimeout(() => { layout.init(); }, 100);
});

</script>

<div bind:this={container}></div>`;