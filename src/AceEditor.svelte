<script>
import { onMount } from 'svelte';
import { loadScript, replaceComponent } from '\0component-ioc:utils';

let editDiv, editor;
export let path, content;
$: if (editor) editor.setValue(content);

const commands = [
    {
        name: 'Build component',
        bindKey: { win: 'Ctrl-S', mac: 'Command-S' },
        exec: (editor) => replaceComponent(path, editor.getValue())
    }
];

function addCommands(editor, commands) {
    commands.forEach(command => editor.commands.addCommand(command));
}

onMount(async () => {
    if (!window.ace) {
        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/ace/1.4.11/ace.min.js');
    }

    ace.config.set('basePath', 'https://cdnjs.cloudflare.com/ajax/libs/ace/1.4.11/');
    editor = ace.edit(editDiv);
    configure(editor);
    addCommands(editor, commands);
});

function configure(editor) {
    editor.setValue(content);
    // interestingly, ctrl + , opens up an options pane
    // that lets you change all of this during runtime
    editor.setShowPrintMargin(false);
    editor.setTheme('ace/theme/cobalt');
    editor.session.setMode('ace/mode/html');
    editor.setKeyboardHandler('ace/keyboard/sublime');
}

</script>

<div bind:this={editDiv} style="width: 100%; height: 100%;"></div>