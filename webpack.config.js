const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';

  return {
    mode: isProduction ? 'production' : 'development',
    entry: './src/webview/index.tsx',
    output: {
      path: path.resolve(__dirname, 'out/designer/webview'),
      filename: 'webview.js',
      clean: true,
    },
    resolve: {
      extensions: ['.tsx', '.ts', '.js', '.css'],
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: 'ts-loader',
          exclude: /node_modules/,
        },
        {
          test: /\.css$/,
          use: [
            isProduction ? MiniCssExtractPlugin.loader : 'style-loader',
            'css-loader',
          ],
        },
      ],
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: './src/webview/index.html',
        filename: 'index.html',
        inject: 'body',
      }),
      ...(isProduction
        ? [
            new MiniCssExtractPlugin({
              filename: 'styles.css',
            }),
          ]
        : []),
    ],
    devtool: isProduction ? 'source-map' : 'eval-source-map',
    devServer: {
      static: {
        directory: path.join(__dirname, 'out/designer/webview'),
      },
      compress: true,
      port: 3000,
      hot: true,
    },
  };
};
