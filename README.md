# rollup-plugin-svelte-component-ioc

Replaces direct references to svelte components with dynamic references fetched from a dependency store.

Svelte websites become editable by end-users by replacing component definitions at runtime.

## Installation

```
npm install --save-dev rollup-plugin-svelte-component-ioc
```

Then, in `rollup.config.js`,

```javascript
import componentIoc from 'rollup-plugin-svelte-component-ioc';

export default {
    plugins: [
        componentIoc({ root: __dirname, exposeSource: true, dependencies: false }),
        svelte({
            dev: !production,
            css: css => {
                css.write('public/build/bundle.css');
            }
        }),
```

## Options

- root: *required*; the directory to use as a base to look for Svelte components
- exposeSource: *optional*, **default: false**; whether to copy Svelte source files into the build folder
- dependencies: *optional*, **default: true**; whether to include dependencies found in package.json in the store

## Runtime usage

Adds a `__DIS__` (**d**ependency **i**njection **s**tore) property to the window, which exposes several interesting properties.

- `subscribe(cb)`: the standard svelte/store subscribe method
- `get()`: the semantics of `get(window.__DIS__)`, but without having to import `svelte/store/get` yourself
- `replace(name, value)`: updates the given definition
- **async** `replaceFromSource(name, source)`: replaces the given definition after building the given source code, *including* transforming component imports to dependency injections
- **async** `lookupSource(name)`: returns source code for the given name if it can, first looking in user-provided code, then checking the build directory (where source files will be if `exposeSource: true`)
- `userSourceCode`: a plain object that maps `[name]: [source]` for user-provided code; mainly for internal use