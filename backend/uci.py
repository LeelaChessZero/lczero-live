import chess
import chess.engine
from sanic import Sanic
import sanic.config
import asyncio


class UciInteractor:
    config: sanic.config.Config
    task: asyncio.Task
    engine: chess.engine.Protocol

    def __init__(self, queue: asyncio.Queue):
        self.queue = queue
        self.task = None

    @classmethod
    async def create(cls, queue: asyncio.Queue):
        self = cls(queue)
        return self

    async def setup(self, app: Sanic):
        self.config = app.config
        self.transport, self.engine = await chess.engine.popen_uci(
            self.config.UCI_COMMAND_LINE
        )

    async def run(self, command_line: str):
        transport, self.engine = await chess.engine.popen_uci(command_line)
        await self._loop(self.engine)

    async def _loop(self, engine: chess.engine.Protocol): ...

    async def close(self):
        ...
