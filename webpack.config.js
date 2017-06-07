const util = require("util"), path = require("path");
const webpack = require("webpack");

const IS_PROD = process.argv.indexOf("-p") !== -1;
const NODE_ENV = IS_PROD ? "production" : "development";
const SOURCE_MAP = !IS_PROD;

console.log("Config enviroment: " + NODE_ENV);
console.log("Source maps: " + (SOURCE_MAP ? "enabled" : "disabled"));

const extractPlugin = new (require("extract-text-webpack-plugin"))({
    filename: "./assets/app.min.css"
});

const banner = new String;
banner.toString = () => {
    return util.format("Generated by Intecmedia.Webpack: %s | %s | [file]?v=[chunkhash]", new Date().toISOString(), NODE_ENV);
};

module.exports = {

    entry: {
        vendor: [
            "jquery",
            "./app/vendor.js"
        ],
        app: "./app/app.js"
    },

    output: {
        path: __dirname,
        filename: "./assets/app.min.js"
    },

    performance: {
        hints: IS_PROD ? "error" : false,
        maxAssetSize: 512 * 1024,
        maxEntrypointSize: 256 * 1024
    },

    plugins: (IS_PROD ? [
        // prod-only
        new webpack.EnvironmentPlugin({
            NODE_ENV: "production",
            DEBUG: false
        }),
        new webpack.DefinePlugin({
            "NODE_ENV": JSON.stringify("production"),
            "process.env": {
                "NODE_ENV": "production"
            }
        }),
        new webpack.optimize.UglifyJsPlugin({
            banner: banner,
            beautify: false,
            comments: false
        })
    ] : [
        // dev-only
        new webpack.EnvironmentPlugin({
            NODE_ENV: "development",
            DEBUG: true
        }),
        new webpack.DefinePlugin({
            "NODE_ENV": JSON.stringify("development"),
            "process.env": {
                "NODE_ENV": "development"
            }
        })
    ]).concat([
        // dev-and-prod
        new webpack.optimize.CommonsChunkPlugin({
            name: "vendor",
            filename: "./assets/vendor.min.js"
        }),
        extractPlugin,
        new webpack.BannerPlugin({
            banner: banner
        }),
        new webpack.ProvidePlugin({
            $: "jquery",
            jQuery: "jquery"
        })
    ]),

    devtool: (SOURCE_MAP ? "eval-source-map" : ""),

    module: {
        rules: [
            // javascript loaders
            {
                test: /\.js$/,
                include: /node_modules/,
                loader: "imports-loader",
                options: {
                    "$": "jquery",
                    "jQuery": "jquery"
                }
            },
            {
                test: /\.js$/,
                exclude: /node_modules/,
                loader: "babel-loader",
                options: {
                    presets: ["env"],
                    forceEnv: NODE_ENV,
                    cacheDirectory: !IS_PROD
                }
            },
            // image loaders
            {
                test: /\.(jpe?g|png|gif|svg)$/i,
                exclude: /fonts/,
                loaders: [
                    {
                        loader: "url-loader",
                        options: {
                            limit: 32 * 1024
                        }
                    },
                    {
                        loader: "file-loader",
                        options: {
                            name: "assets/img/[name].[ext]?v=[hash]"
                        }
                    },
                    {
                        loader: "image-webpack-loader",
                        options: {
                            bypassOnDebug: !IS_PROD
                        }
                    }
                ]
            },
            // font loaders
            {
                test: /\.(eot|woff|woff2|ttf|svg)(\?v=.+)?$/,
                loaders: [
                    {
                        loader: "file-loader",
                        options: {
                            name: "assets/fonts/[name].[ext]?v=[hash]"
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
                            loader: "style-loader",
                            options: {
                                sourceMap: SOURCE_MAP
                            }
                        }
                    ],
                    use: [
                        {
                            loader: "css-loader",
                            options: {
                                importLoaders: 2, // index of 'sass-loader'
                                sourceMap: SOURCE_MAP
                            }
                        },
                        {
                            loader: "postcss-loader",
                            options: {
                                sourceMap: SOURCE_MAP ? "inline" : false,
                                plugins: [
                                    // dev-and-prod
                                    require("postcss-cssnext")({
                                        features: {
                                        }
                                    }),
                                ].concat(IS_PROD ? [
                                    // prod-only
                                    require("css-mqpacker")({
                                        sort: true
                                    }),
                                    require("cssnano")({
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
                            loader: "sass-loader",
                            options: {
                                data: "$NODE_ENV: " + NODE_ENV + ";",
                                indentWidth: 4,
                                sourceMap: SOURCE_MAP ? "inline" : false,
                                sourceMapEmbed: SOURCE_MAP,
                                sourceMapContents: SOURCE_MAP,
                                sourceComments: SOURCE_MAP
                            }
                        }
                    ]
                })
            }
        ]
    }

};