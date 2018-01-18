const path = require('path');
const slash = require('slash');
const loaderUtils = require('loader-utils');
const validateOptions = require('schema-utils');
const nunjucks = require('nunjucks');
const frontMatter = require('front-matter');
const deepAssign = require('deep-assign');
const weblog = require('webpack-log');
const posthtml = require('posthtml');
const posthtmlRender = require('posthtml-render');
const SVGO = require('svgo');
const svgoConfig = require('./svgo.config.js');
const deasync = require('deasync');

const logger = weblog({ name: 'loader-html' });

const DEFAULT_OPTIONS = {
    context: {},
    environment: {
        autoescape: true,
        trimBlocks: true,
        lstripBlocks: false,
        watch: false,
    },
    noCache: true,
    requireTags: {
        img: ['src', 'data-src', 'lowsrc', 'srcset', 'data-srcset'],
        source: ['srcset', 'data-srcset'],
    },
    requireIgnore: /^(\w+[:]|\/\/)/i,
    requireReplace: {},
    searchPath: './source',
    svgo: svgoConfig,
    svgoEnabled: true,
};

const OPTIONS_SCHEMA = {
    type: 'object',
    additionalProperties: false,
    properties: {
        context: { type: 'object' },
        environment: { type: 'object' },
        noCache: { type: 'boolean' },
        requireTags: {
            type: 'object',
            properties: {
                prop: {
                    type: 'object',
                    properties: {
                        prop: { type: 'string' },
                    },
                },
            },
        },
        requireIgnore: { instanceof: 'RegExp' },
        requireReplace: { type: 'object' },
        searchPath: { type: 'string' },
        svgo: { type: 'object' },
        svgoEnabled: { type: 'boolean' },
    },
};

const SRC_SEPARATOR = /\s+/;
const SRCSET_SEPARATOR = /\s*,\s*/;
const IDENT_PATTERN = /xxxHTMLLINKxxx[0-9\\.]+xxx/g;
const randomIdent = () => `xxxHTMLLINKxxx${Math.random()}${Math.random()}xxx`;

function processHtml(html, options, loaderCallback) {
    const parser = posthtml();
    if (options.requireTags && Object.keys(options.requireTags).length) {
        parser.use((tree) => {
            tree.match(Object.keys(options.requireTags).map(tag => ({ tag })), (node) => {
                options.requireTags[node.tag].forEach((attr) => {
                    if (!(attr in node.attrs) || ('data-link-ignore' in node.attrs)) return;

                    if (attr === 'srcset' || attr === 'data-srcset') {
                        node.attrs[attr] = node.attrs[attr].split(SRCSET_SEPARATOR).map((src) => {
                            if (options.requireIgnore.test(src)) return src;

                            const [url, size] = src.split(SRC_SEPARATOR, 2);
                            return `${options.requireIdent(url)} ${size}`;
                        }).join(', ');
                    } else if (!options.requireIgnore.test(node.attrs[attr])) {
                        node.attrs[attr] = options.requireIdent(node.attrs[attr]);
                    }
                });
                return node;
            });
            return tree;
        });
    }
    if (options.svgoEnabled) {
        const svgoInstance = new SVGO(options.svgo);
        parser.use((tree) => {
            tree.match({ tag: 'svg' }, (node) => {
                if ('data-svgo-ignore' in node.attrs) return node;

                let minifiedSvg;
                const originalSvg = posthtmlRender(node);
                svgoInstance.optimize(originalSvg).then((result) => {
                    minifiedSvg = result;
                }).catch((error) => {
                    minifiedSvg = { data: originalSvg };
                    return loaderCallback(error);
                });
                deasync.loopWhile(() => minifiedSvg === undefined);

                node.attrs = {};
                node.content = minifiedSvg.data;
                node.tag = false;

                return node;
            });
            return tree;
        });
    }
    parser.process(html).then((result) => {
        let exportString = `export default ${JSON.stringify(result.html)};`;
        if (options.requireReplace && Object.keys(options.requireReplace).length) {
            exportString = exportString.replace(IDENT_PATTERN, (match) => {
                if (!options.requireReplace[match]) return match;
                const url = loaderUtils.urlToRequest(options.requireReplace[match], options.searchPath);
                return `"+require(${JSON.stringify(url)})+"`;
            });
        }
        loaderCallback(null, exportString);
    }).catch(loaderCallback);
}

module.exports = function HtmlLoader(source) {
    const loaderContext = this;
    const loaderCallback = loaderContext.async();

    const options = deepAssign({}, DEFAULT_OPTIONS, loaderUtils.getOptions(loaderContext));
    validateOptions(OPTIONS_SCHEMA, options, 'loader-html');

    const nunjucksLoader = new nunjucks.FileSystemLoader(options.searchPath, { noCache: options.noCache });
    const nunjucksEnvironment = new nunjucks.Environment(nunjucksLoader, options.environment);

    options.requireIdent = (url) => {
        let ident;
        do {
            ident = randomIdent();
        } while (options.requireReplace[ident]);
        options.requireReplace[ident] = url;
        return ident;
    };
    nunjucksEnvironment.addFilter('require', options.requireIdent);
    nunjucksEnvironment.addGlobal('require', options.requireIdent);

    const publicPath = ((options.context.APP || {}).PUBLIC_PATH || path.sep);
    const resourcePath = path.sep + path.relative(options.searchPath, loaderContext.resourcePath);

    const template = frontMatter(source);
    const templateContext = {
        APP: options.context,
        PAGE: {
            ...template.attributes,
            PUBLIC_PATH: slash(path.normalize(publicPath + resourcePath)),
            RESOURCE_PATH: slash(path.normalize(resourcePath)),
        },
    };

    logger.info(`processing '${loaderContext.resourcePath}'`);
    nunjucksEnvironment.renderString(template.body, templateContext, (error, result) => {
        if (error) {
            if (error.message) {
                error.message = error.message.replace(/^\(unknown path\)/, `(${loaderContext.resourcePath})`);
            }
            loaderCallback(error);
        } else {
            processHtml(result, options, loaderCallback);
        }
    });
};
