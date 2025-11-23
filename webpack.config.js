const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';

  return {
    mode: isProduction ? 'production' : 'development',
    
    // 禁用缓存机制，避免调试过程中的风险
    // Webpack 5 默认启用文件系统缓存，这可能导致修改后的代码不生效
    cache: false,
    
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
      modules: ['node_modules', path.resolve(__dirname, 'src')],
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: [
            {
              loader: 'ts-loader',
              options: {
                transpileOnly: !isProduction, // 开发环境下提高编译速度
                compilerOptions: {
                  noEmitOnError: isProduction, // 生产环境下严格检查错误
                },
              },
            },
          ],
          exclude: /node_modules/,
        },
        {
          test: /\.css$/,
          use: [
            isProduction ? MiniCssExtractPlugin.loader : 'style-loader',
            {
              loader: 'css-loader',
              options: {
                modules: false, // 保持原有的CSS处理方式
                sourceMap: !isProduction, // 开发环境下启用sourcemap
              },
            },
          ],
        },
      ],
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: './src/webview/index.html',
        filename: 'index.html',
        inject: 'body',
        minify: isProduction,
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
              drop_debugger: isProduction,
              pure_funcs: isProduction ? ['console.log', 'console.debug', 'console.warn', 'console.info'] : [],
              // 注意: console.error 保留用于错误报告
            },
            format: {
              comments: false,
            },
          },
          parallel: true, // 并行压缩
          include: /\.js$/,
        }),
      ],
      // VS Code Webview 中禁用代码分割
      // 原因：所有资源必须通过 webview.asWebviewUri() 转换，SplitChunks 自动插入的 vendor 引用会报错 403
      splitChunks: false,
      moduleIds: 'deterministic', // 减少输出文件名中的哈希长度
    },
    performance: {
      maxAssetSize: 800000, // 提高资产大小限制到800KB
      maxEntrypointSize: 1000000, // 提高入口点大小限制到1MB
      hints: isProduction ? 'warning' : false, // 开发环境不显示警告
    },
    
    // 错误处理优化
    stats: {
      errorDetails: true,
      colors: true,
      modules: false,
      entrypoints: false,
    },
    
    // 开发环境优化
    watchOptions: {
      ignored: /node_modules/,
      aggregateTimeout: 300,
      poll: 1000,
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
