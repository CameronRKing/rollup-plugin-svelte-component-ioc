import { expect } from 'chai';
import componentIoc from '..';
import path from 'path';

const root = path.dirname(__dirname);
const plugin = componentIoc({ root });

describe('component-ioc', () => {
    it.only('generates a new file containing a store that links paths to imported component definitions', () => {
        const newSrc = plugin.transform(`<script>import MyCmp from './MyCmp.svelte'</script>`, root + '\\src\\OtherCmp.svelte');
        expect(newSrc.code).to.include("import __DIS__ from '\0component-ioc:component-store';");
        expect(newSrc.code).to.include("$: MyCmp = $__DIS__['/src/MyCmp']");
        expect(newSrc.code).not.to.include("import MyCmp from './MyCmp.svelte'");

        const storeDefinition = plugin.load('\0component-ioc:component-store');
        expect(storeDefinition).to.include("'/src/MyCmp': srcMyCmp");
        expect(storeDefinition).not.to.include("'/src/OtherCmp': srcOtherCmp");
    });

    it('transforms component imports into dependency injections', () => {
        
    });

    it('transforms component references into dynamic bindings', () => {

    });
});