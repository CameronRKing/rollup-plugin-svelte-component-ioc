# rollup-plugin-svelte-component-ioc

Replaces direct references to svelte components with dynamic references fetched from a dependency store.

Svelte websites become editable by end-users by replacing component definitions at runtime.

Adds `__DIS__` (**d**ependency **i**njection **s**tore) property to the window, which exposes three functions.

- subscribe: the standard svelte/store subscribe method
- get: the semantics of `get(window.__DIS__)`, but without having to import `get()` into the global scope
- replace(name, componentConstructor): updates the given component definition

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