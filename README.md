# rollup-plugin-svelte-component-ioc

Replaces direct references to svelte components with dynamic references fetched from a dependency store.

Svelte websites become editable by end-users by replacing component definitions at runtime.

Why? Because I believe users should have full control over their digital experience.

Watch a demo video at https://www.youtube.com/watch?v=ZDhJLdhSvGs

Also see:
+ https://github.com/CameronRKing/rollup-plugin-layout-intercept
    + wraps the root component in a Lumino widget for better runtime layout manipulation
+ https://github.com/CameronRKing/rollup-plugin-ioc-editing-tools
    + packages a small editor including a text editor, component inspector, Mocha test runner, and Markdown renderer

## Installation

This is an unpublished prototype library. You'll have to install it manually.
In `package.json`, add, `"rollup-plugin-svelte-component-ioc": "git+https://github.com/CameronRKing/rollup-plugin-svelte-component-ioc.git"`

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
