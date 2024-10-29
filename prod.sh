#!/bin/env bash

esbuild frontend/main.ts --bundle --outfile=static/dist/main.js --minify

HASH=$(sha1sum static/dist/main.js | cut -f 1 -d ' ')

sed "s|dist/main.js|dist/main.js?$HASH|g" static/index.html.template > static/index.html

cd backend
sanic main -p 8914