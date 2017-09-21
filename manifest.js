/* eslint global-require: "off" */
const fs = require('fs');

const DEFAULT_OPTIONS = {
    path: './build/img/favicon/manifest.json',
    replace: {},
};

module.exports = class ManifestPlugin {
    constructor(options) {
        this.options = Object.assign({}, DEFAULT_OPTIONS, options);
    }

    apply(compiler) {
        const { options } = this;
        compiler.plugin('done', () => {
            /* eslint import/no-dynamic-require: "off" */
            if (fs.existsSync(options.path)) {
                const manifestOriginal = require(options.path);
                const manifestReplaced = Object.assign({}, manifestOriginal, options.replace);
                fs.writeFileAsync(options.path, JSON.stringify(manifestReplaced, null, 4));
            }
        });
    }
};
