#!/usr/bin/env python3
from app import App
from api import api
from tortoise.contrib.sanic import register_tortoise
from tortoise import Tortoise

import sanic


app = sanic.Sanic("LCZeroLive")

app.update_config("./config.py")

register_tortoise(
    app,
    db_url=app.config.DB_PATH,
    modules=app.config.DB_MODULES,
)
app.ctx.app = App(app)
app.static("/", "../static/index.html", name="index")
app.static("/style.css", "../static/style.css", name="style")
app.static("/dist", "../static/dist")
app.blueprint(api)


@app.before_server_start
async def setup(app, loop):
    await Tortoise.generate_schemas()
    app.add_task(app.ctx.app.run)


@app.after_server_stop
async def shutdown(app, loop):
    await app.ctx.app.shutdown(app)
