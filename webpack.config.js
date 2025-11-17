const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';

  return {
    mode: isProduction ? 'production' : 'development',
    entry: './src/webview/index.tsx',
    output: {
      path: path.resolve(__dirname, 'out/designer/webview'),
      filename: isProduction ? '[name].[contenthash].js' : 'webview.js',
      chunkFilename: isProduction ? '[name].[contenthash].chunk.js' : '[name].chunk.js',
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
              filename: '[name].[contenthash].css',
            }),
            // 可选：用于分析包大小的插件
            // new BundleAnalyzerPlugin(),
          ]
        : []),
    ],
    devtool: isProduction ? 'source-map' : 'eval-source-map',
    optimization: {
      usedExports: true, // 启用 Tree Shaking
      minimize: isProduction,
      minimizer: [
        new TerserPlugin({
          terserOptions: {
            compress: {
              drop_console: isProduction, // 生产环境删除console.log
            },
          },
        }),
      ],
      // VS Code Webview 中禁用代码分割
      // 原因：所有资源必须通过 webview.asWebviewUri() 转换，SplitChunks 自动插入的 vendor 引用会报错 403
      splitChunks: false,
    },
    performance: {
      maxAssetSize: 600000, // 提高资产大小限制到600KB
      maxEntrypointSize: 900000, // 提高入口点大小限制到900KB
      hints: isProduction ? 'warning' : false, // 开发环境不显示警告
    },
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
