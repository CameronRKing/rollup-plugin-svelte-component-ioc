export default function componentIoc() {
    const storeRefId = this.emitFile({ type: 'asset', fileName: 'component-store.js' });
    // EmittedAsset
    // {
    //   type: 'asset',
    //   name?: string,
    //   fileName?: string,
    //   source?: string | Uint8Array
    // }

    // needed?
    function storeUrl() {
        return `import.meta.ROLLUP_FILE_URL_${storeRefId}`;
    }

    const componentDefinitions = {};

    return {
        name: 'component-ioc',
        transform(code, id) {
            let src = code;
            const replace = (...args) => src = src.replace(...args);

            replace('<script>', '<script>import DIS from ' + /* how do I find the dependency store location? */);

            // this line won't work with relative imports
            // the same file might be attached to multiple names (not great, but workable)
            // different files might be attached to the same relative path (not workable)
                // once I figure out how the component paths should be constructed,
                // I also need to save them so I can populate the store
            replace(/import (\w+) from ['"](.*)\.svelte['"]/g, '$: $1 = $DIS["$2"]');

            replace(/<([A-Z]\w+)/g, '<svelte:component this={$1}');
            replace(/<\/[A-Z]\w+>/g, '</svelte:component>');
            return src;
        },
        buildEnd() {
            const storeDefinition = `// import svelte writeable store
// import all component definitions
// define the store, first as a writeable,
// then exposing a custom store with only subscribe() and replace(name, newCmp)
`
            this.setAssetSource(storeRefId, storeDefinition);
        }
    };
}