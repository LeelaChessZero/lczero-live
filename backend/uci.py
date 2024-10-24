import chess
import chess.engine
from sanic.log import logger
from anyio.streams.memory import MemoryObjectSendStream


class UciInteractor:
    _config: dict
    _engine: chess.engine.Protocol

    @classmethod
    async def create(cls, config: dict):
        self = cls()
        self._config = config
        _, self._engine = await chess.engine.popen_uci(config["command"])
        return self

    async def think(
        self, queue: MemoryObjectSendStream[chess.engine.InfoDict], board: chess.Board
    ):
        with await self._engine.analysis(board=board, multipv=230) as analysis:
            async for info in analysis:
                # if info.get("multipv", 1) == 1:
                #     logger.debug(
                #         f"Got info: d:{info.get('depth')} n:{info.get('nodes')}"
                #     )
                await queue.send(info)

    async def close(self):
        await self._engine.quit()
