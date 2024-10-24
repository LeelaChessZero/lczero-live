import chess
import chess.engine
import asyncio
from typing import Optional
from sanic.log import logger


class UciInteractor:
    _config: dict
    _engine: chess.engine.Protocol
    _transport: asyncio.SubprocessTransport
    _task: Optional[asyncio.Task]

    @classmethod
    async def create(cls, config: dict):
        self = cls()
        self._config = config
        self._transport, self._engine = await chess.engine.popen_uci(config["command"])
        self._task = None
        return self

    async def think(self, queue: asyncio.Queue, board: chess.Board):
        if self._task:
            self._task.cancel()
            await self._task

        async def run():
            try:
                with await self._engine.analysis(board=board, multipv=230) as analysis:
                    async for info in analysis:
                        if info.get("multipv", 1) == 1:
                            logger.debug(
                                f"Got info: d:{info.get('depth')} n:{info.get('nodes')}"
                            )
                        await queue.put(info)
            except asyncio.CancelledError:
                logger.debug("Cancelling the UCI task.")
                await queue.put(None)

        self.task = asyncio.create_task(run())

    async def close(self):
        await self._engine.quit()
        self._transport.close()
