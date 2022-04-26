#!/usr/bin/env bash
yarn tsup

# If "type": "commonjs" - then we need to adjust the .js ext to .cjs
cp dist/index.js dist/index.cjs
