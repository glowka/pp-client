const path = require('path');

const HtmlWebpackPlugin = require('html-webpack-plugin');
const CleanWebpackPlugin = require('clean-webpack-plugin');
const webpack = require('webpack');

// app-specific settings (enabled features etc.)
const { appSettings } = require('./config/app-settings');

const localPath = (...args) => path.resolve(__dirname, ...args);

const BUILD_DIR = localPath('dist');
const EXT_DIR = localPath('dist-ext');

const config = (env, argv) => ({
  entry: {
    main: "./src/index.tsx",
    vendor_css: "./src/vendor_css.ts"
  },
  output: {
    path: BUILD_DIR,
    publicPath: '/',
    filename: '[name].bundle.js',
  },
  resolve: {
    extensions: [".ts", ".tsx", ".js", ".json"],
    modules: [
      localPath('src'),
      localPath('node_modules'),
    ]
  },
  optimization: {
    splitChunks: false,
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: [
          {
            loader: "ts-loader",
            options: {
              transpileOnly: true,
            },
          }
        ],
        exclude: /node_modules/,
      },
      {
        /* CSS global styles */
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
      {
        /* SCSS global styles */
        test: /\.scss$/,
        include: [
          localPath('src', 'css'),
          localPath('src', 'browser-extension')
        ],
        use: ['style-loader', 'css-loader', 'sass-loader'],
      },
      {
        /* SCSS modules */
        test: /\.scss$/,
        include: [
          localPath('src', 'components'),
          localPath('src', 'containers'),
        ],
        use: [
          'style-loader',
          {
            loader: 'css-loader',
            options: {
              modules: true,
              camelCase: true,
              localIdentName: '[name]__[local]--[hash:base64:5]',
            },
          },
          {
            loader: 'sass-loader',
            options: {
              includePaths: [
                localPath('src'),
              ],
            },
          }],
      },
      {
        test: /\.(png|jpg|gif|svg)$/,
        loader: 'url-loader',
        options: {
          limit: 10000,
          name: '[path][name].[ext]'
        },
      },
      {
        test: /\.(eot|ttf|woff|woff2)$/,
        loader: 'file-loader',
        options: {
          name: '[name].[ext]',
          outputPath: 'fonts/',
        },
      },
    ],
  },
  plugins: [
    new CleanWebpackPlugin([BUILD_DIR, EXT_DIR]),
    new HtmlWebpackPlugin({
      title: 'Przypis testowa pusta strona',
      template: 'src/test.html',
      filename: 'index.html',
    }),
    new webpack.DefinePlugin({
      // use appropriate (development or production) PP settings
      PP_SETTINGS: JSON.stringify(appSettings[argv.mode]),
    }),
    // JQuery is assumed by semantic ui, so we need to define it
    new webpack.ProvidePlugin({
      jQuery: 'jquery',
      $: 'jquery',
      jquery: 'jquery'
    })
  ],
});

module.exports = {
  config: config,
  BUILD_DIR: BUILD_DIR,
};
