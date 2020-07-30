import { expect } from 'chai';
import componentIoc from '..';
import path from 'path';

const root = path.dirname(__dirname);
const plugin = componentIoc({ root });

describe('component-ioc', () => {
    it('builds a component dependency store by looking for svelte components in the given root folder', async () => {
        await plugin.buildStart();
        const storeDefinition = plugin.load('\0component-ioc:component-store');
        expect(storeDefinition).to.include(`import testExample from './test/Example.svelte';`);
        expect(storeDefinition).to.include("'/test/Example': testExample");
    });

    it('includes dependencies found in package.json by default', async () => {
        await plugin.buildStart();
        const storeDefinition = plugin.load('\0component-ioc:component-store');
        expect(storeDefinition).to.include(`import * as dep0 from 'findit';`);
        expect(storeDefinition).to.include(`'findit': dep0`);
    });

    it(`won't include dependencies if the dependencies option is false`, async () => {
        const justCmps = componentIoc({ root, dependencies: false });
        await justCmps.buildStart();
        const storeDefinition = justCmps.load('\0component-ioc:component-store');
        expect(storeDefinition).not.to.include(`import * as dep0 from 'findit';`);
        expect(storeDefinition).not.to.include(`'findit': dep0`);
    })

    it('replaces component imports with reactive resolutions from the dependency store', () => {
        const newSrc = plugin.transform(`<script>import MyCmp from './MyCmp.svelte'</script>`, path.join(root + '/src/OtherCmp.svelte'));
        expect(newSrc.code).to.include(`import __DIS__ from '\0component-ioc:component-store';`);
        expect(newSrc.code).to.include(`$: MyCmp = $__DIS__['/src/MyCmp']`);
        expect(newSrc.code).not.to.include(`import MyCmp from './MyCmp.svelte'`);
    });

    it('transforms component references into dynamic bindings', () => {
        const newSrc = plugin.transform(`<MyCmp attr={not affected}></MyCmp>
            <OtherCmp attr={not affected }/>`, root + '\\src\\DoesntMatterForThisTest.svelte');
        expect(newSrc.code).to.equal(`<svelte:component this={MyCmp} attr={not affected}></svelte:component>
            <svelte:component this={OtherCmp} attr={not affected }/>`);
    });
});