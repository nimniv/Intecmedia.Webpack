/* eslint global-require: "off" */
const path = require('path')
const webpack = require('webpack')

/* eslint no-process-env: "off" */
const DEBUG = 'DEBUG' in process.env && parseInt(process.env.DEBUG, 10) > 0
const PROD = process.argv.indexOf('-p') !== -1
const NODE_ENV = PROD ? 'production' : 'development'
const USE_SOURCE_MAP = DEBUG
const USE_LINTERS = DEBUG

/* eslint no-console: "off" */
console.log(`Enviroment: ${NODE_ENV}`)
console.log(`Debug: ${DEBUG ? 'enabled' : 'disabled'}`)
console.log(`Source maps: ${USE_SOURCE_MAP ? 'enabled' : 'disabled'}`)
console.log('---')

const extractPlugin = new (require('extract-text-webpack-plugin'))({
    filename: './assets/app.min.css'
})

const banner = ''
banner.toString = () => {
    const now = new Date()
    return `Generated by Intecmedia.Webpack: ${now.toISOString()} | ${NODE_ENV} | [file]?v=[chunkhash]`
}

module.exports = {

    entry: {
        vendor: [
            'jquery',
            './app/vendor.js'
        ],
        app: './app/app.js'
    },

    output: {
        path: __dirname,
        filename: './assets/app.min.js'
    },

    performance: {
        hints: PROD && !DEBUG ? 'error' : false,
        maxAssetSize: 512000,
        maxEntrypointSize: 256000
    },

    plugins: (PROD ? [
        // prod-only
        new webpack.EnvironmentPlugin({
            NODE_ENV: 'production',
            DEBUG: false
        }),
        new webpack.DefinePlugin({
            NODE_ENV: JSON.stringify('production'),
            'process.env': {
                NODE_ENV: 'production'
            }
        }),
        new webpack.optimize.UglifyJsPlugin({
            banner,
            beautify: false,
            comments: false
        })
    ] : [
        // dev-only
        new webpack.EnvironmentPlugin({
            NODE_ENV: 'development',
            DEBUG: true
        }),
        new webpack.DefinePlugin({
            NODE_ENV: JSON.stringify('development'),
            'process.env': {
                NODE_ENV: 'development'
            }
        })
    ]).concat([
        // dev-and-prod
        new webpack.optimize.CommonsChunkPlugin({
            name: 'vendor',
            filename: './assets/vendor.min.js'
        }),
        extractPlugin,
        new webpack.BannerPlugin({
            banner
        }),
        new webpack.ProvidePlugin({
            $: 'jquery',
            jQuery: 'jquery'
        })
    ]),

    devtool: USE_SOURCE_MAP ? 'eval-source-map' : '',

    module: {
        rules: [
            // javascript loaders
            {
                test: /\.js$/,
                include: /node_modules/,
                loader: 'imports-loader',
                options: {
                    $: 'jquery',
                    jQuery: 'jquery'
                }
            },
            {
                test: /\.js$/,
                exclude: /node_modules/,
                loaders: [
                    {
                        loader: 'babel-loader',
                        options: {
                            presets: ['env'],
                            forceEnv: NODE_ENV,
                            cacheDirectory: !PROD
                        }
                    }
                ].concat(USE_LINTERS ? [
                    {
                        loader: 'eslint-loader',
                        options: {
                            fix: true,
                            cache: PROD ? false : path.resolve(__dirname, '.cache')
                        }
                    }
                ] : [])
            },
            // image loaders
            {
                test: /\.(jpe?g|png|gif|svg)$/i,
                exclude: /fonts/,
                loaders: [
                    {
                        loader: 'url-loader',
                        options: {
                            limit: 32000
                        }
                    },
                    {
                        loader: 'file-loader',
                        options: {
                            name: `assets/img/[name].[ext]${PROD ? '?v=[hash]' : ''}`
                        }
                    },
                    {
                        loader: 'image-webpack-loader',
                        options: {
                            bypassOnDebug: !PROD
                        }
                    }
                ]
            },
            // font loaders
            {
                test: /\.(eot|woff|woff2|ttf|svg)(\?v=.+)?$/,
                loaders: [
                    {
                        loader: 'file-loader',
                        options: {
                            name: `assets/fonts/[name].[ext]${PROD ? '?v=[hash]' : ''}`
                        }
                    }
                ]
            },
            // css loaders
            {
                test: /\.s?css$/,
                loader: extractPlugin.extract({
                    fallback: [
                        {
                            loader: 'style-loader',
                            options: {
                                sourceMap: USE_SOURCE_MAP
                            }
                        }
                    ],
                    use: [
                        {
                            loader: 'css-loader',
                            options: {
                                importLoaders: 2, // index of 'sass-loader'
                                sourceMap: USE_SOURCE_MAP
                            }
                        },
                        {
                            loader: 'postcss-loader',
                            options: {
                                sourceMap: USE_SOURCE_MAP ? 'inline' : false,
                                plugins: [
                                    // dev-and-prod
                                    require('postcss-cssnext')({
                                        features: {}
                                    })
                                ].concat(PROD ? [
                                    // prod-only
                                    require('css-mqpacker')({
                                        sort: true
                                    }),
                                    require('cssnano')({
                                        autoprefixer: false,
                                        discardComments: {
                                            removeAll: true
                                        }
                                    })
                                ] : [
                                    // dev-only
                                ])
                            }
                        },
                        {
                            loader: 'sass-loader',
                            options: {
                                data: `$NODE_ENV: ${NODE_ENV};`,
                                indentWidth: 4,
                                sourceMap: USE_SOURCE_MAP ? 'inline' : false,
                                sourceMapEmbed: USE_SOURCE_MAP,
                                sourceMapContents: USE_SOURCE_MAP,
                                sourceMapRoot: '.',
                                sourceComments: USE_SOURCE_MAP
                            }
                        }
                    ]
                })
            }
        ]
    }

}
