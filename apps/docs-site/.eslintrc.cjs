module.exports = {
  root: true,
  extends: ['next/core-web-vitals'],
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
  ignorePatterns: ['node_modules/', '.next/', 'dist/'],
  overrides: [
    {
      files: ['**/_meta.js'],
      rules: {
        'import/no-anonymous-default-export': 'off',
      },
    },
  ],
};

