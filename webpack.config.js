const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
    mode: 'development',  // or 'production' depending on your environment
    entry: './src/main.ts',
    module: {
        rules: [
        {
            test: /\.ts$/,
            use: 'ts-loader',
            exclude: /node_modules/,
        },
        ],
    },
    resolve: {
        extensions: ['.ts', '.js'],
    },
    output: {
        filename: 'bundle.js',
        path: path.resolve(__dirname, 'dist'),
        clean: true,  // Ensure the dist folder is cleaned before each build
    },
    devServer: {
        static: {
        directory: path.join(__dirname, 'dist'),
        },
        compress: true,
        port: 8080,
    },
    plugins: [
        new HtmlWebpackPlugin({
        template: 'index.html',  // Path to your index.html
        }),
        new CopyWebpackPlugin({
            patterns: [
              { from: 'assets', to: 'assets' } // Copies 'assets' to 'dist/assets'
            ]
        }),
    ],
};
