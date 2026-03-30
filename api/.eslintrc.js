module.exports = {
  extends: ['airbnb-base', 'airbnb-typescript/base'],
  parserOptions: { project: ['tsconfig.json'], tsconfigRootDir: __dirname },
  rules: {
    'max-len': [1, 160, 4],
    'object-curly-newline': 'off',
    'newline-per-chained-call': 'off',
    'no-underscore-dangle': 'off',
    'class-methods-use-this': 'off',
    'no-prototype-builtins': 'off',
  },
};
