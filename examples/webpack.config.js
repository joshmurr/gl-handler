const path = require('path')
const HtmlWebpackPlugin = require('html-webpack-plugin')

module.exports = {
  mode: 'development',
  entry: {
    // pointSphere: './ts/point-sphere.ts',
    // renderToTexture: './ts/render-to-texture.ts',
    // simpleFluid: './ts/simple-fluid.ts',
    // shaderToy: './ts/shaderToy.ts',
    // audio: './ts/audio.ts',
    /* cameraControls: './ts/camera-control.ts', */
    simpleTexture: './ts/simple-texture.ts'
  },
  devtool: 'inline-source-map',
  devServer: {
    static: './dist',
  },
  output: {
    filename: '[name].bundle.js',
    path: path.resolve(__dirname, 'dist'),
    clean: true,
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        exclude: /node_modules/,
        use: {
          loader: 'ts-loader',
          options: {
            // disable type checker - we will use it in fork plugin
            transpileOnly: true,
          },
        },
      },
      {
        test: /\.mp3$/,
        loader: 'file-loader',
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
  },
  plugins: [
    new HtmlWebpackPlugin({
      title: 'GL-Handler',
      template: './index.html',
    }),
  ],
}
