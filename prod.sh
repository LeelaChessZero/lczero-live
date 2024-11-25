#!/bin/env bash

esbuild frontend/main.ts --bundle --outfile=static/dist/main.js --minify

JSHASH=$(sha1sum static/dist/main.js | cut -f 1 -d ' ')
CSSHASH=$(sha1sum static/static/style.css | cut -f 1 -d ' ')

cat static/index.template.html | \
sed -e "s|dist/main.js|dist/main.js?$JSHASH|g" | \
sed -e "s|static/style.css|static/style.css?$CSSHASH|g" > static/index.html

cd backend
ulimit -Sn 65536
ulimit -Hn 1048576
sanic main -p 8914