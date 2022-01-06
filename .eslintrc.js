module.exports = {
  env: {
    node: true,
    commonjs: true,
    es2021: true
  },
  plugins: ['prettier'],
  extends: ['eslint:recommended', 'plugin:prettier/recommended'],
  parserOptions: {
    ecmaVersion: 13
  },
  rules: {}
}
