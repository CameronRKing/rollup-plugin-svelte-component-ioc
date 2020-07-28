<script>
import { createEventDispatcher } from 'svelte';
const dispatch = createEventDispatcher();

$: deps = Object.keys($__DIS__).sort();

</script>

<ul>
    {#each deps as path}
    <li on:click={e => dispatch('open', { path, newTab: e.ctrlKey })}>{ path }</li>
    {/each}
</ul>