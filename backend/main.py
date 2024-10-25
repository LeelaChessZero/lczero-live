#!/usr/bin/env python3
import sanic
from api import api
from app import App
from tortoise import Tortoise
from tortoise.contrib.sanic import register_tortoise

app = sanic.Sanic("LCZeroLive")
app.update_config("./config.py")

register_tortoise(
    app,
    db_url=app.config.DB_PATH,
    modules=app.config.DB_MODULES,
)
app.ctx.app = App(app)
app.static("/", "../static/index.html", name="index")
app.static("/static/", "../static/static/", name="static_dir")
app.static("/dist", "../static/dist")
app.blueprint(api)


@app.before_server_start
async def setup(app, loop):
    await Tortoise.generate_schemas()
    app.add_task(app.ctx.app.run)


@app.after_server_stop
async def shutdown(app, loop):
    await app.ctx.app.shutdown(app)
