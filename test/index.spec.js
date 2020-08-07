import fs from 'fs';
import { expect } from 'chai';
import componentIoc from '../src/index.js';
import path from 'path';
import * as rollup from 'rollup';
import svelte from 'rollup-plugin-svelte';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

const root = path.dirname(__dirname);
const plugin = componentIoc({ root });

describe('build transformations', () => {
    async function getStore(ioc) {
        await ioc.buildStart();
        return ioc.load('\0component-ioc:component-store');
    }

    it('builds a component dependency store by looking for svelte components in the given root folder', async () => {
        const storeDefinition = await getStore(plugin);
        expect(storeDefinition).to.include(`import testExample from './test/Example.svelte';`);
        expect(storeDefinition).to.include("'/test/Example.svelte': testExample");
    });

    it('includes dependencies found in package.json by default', async () => {
        const storeDefinition = await getStore(plugin);
        expect(storeDefinition).to.include(`import * as dep0 from 'findit';`);
        expect(storeDefinition).to.include(`'findit': dep0`);
    });

    it('includes dependencies passed in through the `extraDependencies` option', async () => {
        const extraDependencies = {
            'extra/0': { type: 'import', path: 'extra-dep' },
            'extra/1': { type: 'import', path: 'other-dep', defaultOnly: true },
            'extra/2': { type: 'code', code: '() => console.log("I work!")' }
        };
        const extras = componentIoc({ root, extraDependencies, includeDependencies: false });
        const storeDefinition = await getStore(extras);
        expect(storeDefinition).to.include(`import * as dep1 from 'extra-dep'`);
        expect(storeDefinition).to.include(`import dep2 from 'other-dep'`);
        expect(storeDefinition).to.include(`'extra/0': dep1`);
        expect(storeDefinition).to.include(`'extra/1': dep2`);
        expect(storeDefinition).to.include(`'extra/2': () => console.log("I work!")`);
    });

    it(`won't include dependencies if the dependencies option is false`, async () => {
        const justCmps = componentIoc({ root, includeDependencies: false });
        const storeDefinition = await getStore(justCmps);
        expect(storeDefinition).not.to.include(`import * as dep0 from 'findit';`);
        expect(storeDefinition).not.to.include(`'findit': dep0`);
    })

    it('replaces component imports with reactive resolutions from the dependency store', () => {
        const newSrc = plugin.transform(`<script>import MyCmp from './MyCmp.svelte'</script>`, path.join(root + '/src/OtherCmp.svelte'));
        expect(newSrc.code).to.include(`import __DIS__ from '\0component-ioc:component-store';`);
        expect(newSrc.code).to.include(`$: MyCmp = $__DIS__['/src/MyCmp.svelte']`);
        expect(newSrc.code).not.to.include(`import MyCmp from './MyCmp.svelte'`);
    });

    it('transforms component references into dynamic bindings', () => {
        const newSrc = plugin.transform(`<MyCmp attr={not affected}></MyCmp>
            <OtherCmp attr={not affected }/>`, root + '\\src\\DoesntMatterForThisTest.svelte');
        expect(newSrc.code).to.equal(`<svelte:component this={MyCmp} attr={not affected}></svelte:component>
            <svelte:component this={OtherCmp} attr={not affected }/>`);
    });

    it('ignores imports that are marked with /** @ioc-ignore */ (but still transforms the component references)', async () => {
        const newSrc = plugin.transform(`<script>
/** @ioc-ignore */
import MyCmp from './MyCmp.svelte';
import TransformMe from './TransformMe.svelte';
</script>

<MyCmp />
<TransformMe />`, root + '\\Cmp.svelte');

        expect(newSrc.code).to.include(`import MyCmp from './MyCmp.svelte';`);
        expect(newSrc.code).to.include(`<svelte:component this={MyCmp} />`);
    });

    it('exposes source files in the build if `exposeSource` is set to true', async () => {
        const bundle = await rollup.rollup({
            input: 'test/basic-rollup-input.js',
            plugins: [componentIoc({ root: __dirname, exposeSource: true, includeDependencies: false })]
        });

        const { output } = await bundle.generate({ format: 'es' });

        const containsSource = output.some(chunk =>
            chunk.fileName == 'Example.svelte'
            && chunk.source == fs.readFileSync('./test/Example.svelte', 'utf8')
        )
        expect(containsSource).to.be.true;
    });

    it('also exposes the source of extraDependencies is `exposeSource` is set to true', async function() {
        this.timeout(5000);
        const extraDependencies = {
            'example': { type: 'import', path: 'test/Example.js', defaultOnly: true }
        };
        const exampleSrc = 'export default "It works!";';

        const bundle = await rollup.rollup({
            input: 'test/store-rollup-input.js',
            plugins: [
                {
                    resolveId(id) {
                        if (id == 'test/Example.js') return id;
                    },
                    load(id) {
                        if (id !== 'test/Example.js') return;
                        return exampleSrc;
                    }
                },
                componentIoc({ root: path.dirname(__dirname), exposeSource: true, includeDependencies: false, extraDependencies }),
                svelte(),
                resolve(),
                commonjs(),
            ]
        });

        const { output } = await bundle.generate({ format: 'es' });

        const containsSource = output.some(chunk =>
            chunk.fileName == 'test/Example.js'
            && chunk.source == exampleSrc
        )
        expect(containsSource).to.be.true;
    });

    it('excludes source files from the build by default', async () => {
        const bundle = await rollup.rollup({
            input: 'test/basic-rollup-input.js',
            plugins: [componentIoc({ root: __dirname, includeDependencies: false })]
        });

        const { output } = await bundle.generate({ format: 'es' });

        const containsSource = output.some(chunk =>
            chunk.fileName == 'Example.svelte'
            && chunk.source == fs.readFileSync('./test/Example.svelte', 'utf8')
        )
        expect(containsSource).to.be.false;
    });
});

describe('browser behavior', function() {
    let store, doFetch;
    let wwindow = {};

    this.timeout(10000);

    before(async () => {
        const bundle = await rollup.rollup({
            input: 'test/store-rollup-input.js',
            plugins: [
                componentIoc({ root: path.dirname(__dirname), includeDependencies: false }),
                svelte(),
                resolve(),
                commonjs(),
            ]
        });
        const { output } = await bundle.generate({ format: 'iife' });

        let self = {};
        let fetch = (arg) => { return doFetch(arg); };
        // sure, it's a little hacky, but it gives me confidence that my code works
        new Function('self', 'window', 'fetch', output[0].code)(self, wwindow, fetch);
    });

    it('adds a __DIS__ property to the window', () => {
        expect(wwindow.__DIS__).to.be.an('object');
    });

    it('exposes a store subscribe method', async (done) => {
        const unsub = wwindow.__DIS__.subscribe(val => {
            expect(val).to.be.an('object');
            done();
        });
        unsub();
    });

    it('exposes a store get method', () => {
        expect(wwindow.__DIS__.get()).to.be.an('object');
    });

    it('replaces a component definition with whatever is given', () => {
        wwindow.__DIS__.replace('/Example.svelte', 'a string');
        expect(wwindow.__DIS__.get()['/Example.svelte']).to.equal('a string');
    });

    it('replaces a component definition from source code', async () => {
        const oldCmp = wwindow.__DIS__.get()['/Example.svelte'];
        const exampleSrc = '<script>console.log("New component");</script>';
        await wwindow.__DIS__.replaceComponent('/Example.svelte', exampleSrc);
        expect(wwindow.__DIS__.userSourceCode['/Example.svelte']).to.equal(exampleSrc);
        expect(wwindow.__DIS__.get()['/Example.svelte']).not.to.equal(oldCmp);
    });

    it('looks up source code for a component definition, finding it if `exposeSource: true` is set', async () => {
        doFetch = (arg) => { 
            expect(arg).to.equal('/build/NotReal.svelte');
            return { ok: true, text: () => Promise.resolve('source found!') };
        };
        expect(await wwindow.__DIS__.lookupSource('/NotReal.svelte')).to.equal('source found!');
    });

    it('looks up source code for a component definition, returning user-provided code if it exists', async () => {
        wwindow.__DIS__.userSourceCode['/Example.svelte'] = 'user source found!';
        expect(await wwindow.__DIS__.lookupSource('/Example.svelte')).to.equal('user source found!');
    });

    it('looks up source code for a component definition, returning an empty string if no source is available', async () => {
        doFetch = () => ({ ok: false, text: () => Promise.resolve('shouldnt see this') });
        expect(await wwindow.__DIS__.lookupSource('/CantFind.svelte')).to.equal('');
    });

    it('looks up source code for a store definition, returning fn.toString() if the definition is a function', async () => {
        wwindow.__DIS__.replace('/fn-example', () => 'the function has been stringified');
        expect(await wwindow.__DIS__.lookupSource('/fn-example')).to.equal(`() => 'the function has been stringified'`);
    });
});