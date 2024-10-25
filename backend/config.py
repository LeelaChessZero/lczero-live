from typing import Iterable
from types import ModuleType
import datetime

DB_PATH = "sqlite://../.db/lczero_live.db"
# DB_PATH = "sqlite://:memory:"
DB_MODULES: dict[str, Iterable[str | ModuleType]] = {"lc0live": ["db"]}
UCI_ANALYZERS = [
    {
        "command": [
            "/home/crem/dev/lc0/build/release/lc0",
            "--backend=trivial",
            # "--backend=multiplexing",
            # "--backend-opts=a(backend=demux,(backend=cuda-fp16,gpu=0),(backend=cuda-fp16,gpu=1),(backend=cuda-fp16,gpu=2),(backend=cuda-fp16,gpu=3)),b(backend=demux,(backend=cuda-fp16,gpu=4),(backend=cuda-fp16,gpu=5),(backend=cuda-fp16,gpu=6),(backend=cuda-fp16,gpu=7))",
            # '--backend-opts=backend=cuda-fp16,(gpu=6),(gpu=7)',
            "--minibatch-size=768",
            # WCCC/WCCSC
            "--threads=3",
            "--ramlimit-mb=1000",
            # "--nncache=50000000",
            "--show-wdl",
            "--show-movesleft",
            (
                "--logfile=/tmp/lc0-"
                f'{datetime.datetime.now().strftime("%Y%m%d-%H%M%S")}.log'
            ),
            "--per-pv-counters",
            "--preload",
            "--score-type=Q",
        ]
    }
]


OAS = False
