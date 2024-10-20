# DB_PATH = "sqlite://../.db/lczero_live.db"
DB_PATH = "sqlite://:memory:"
DB_MODULES = {"lc0live": ["db"]}


PGN_FEED = {
    "url": "https://lichess.org/api/stream/broadcast/round/VGV9PrtG.pgn",
    "filters": {
        # "Event": "FIDE World Championship Match 2023",
        # "Site": "Astana KAZ",
        # "Date": "2023.04.23",
        "Round": "5.1",
        # "White": "Ding, Liren",
        # "Black": "Nepomniachtchi, Ian",
        # "Result": "1/2-1/2",
        # "WhiteElo": "2788",
        # "WhiteTitle": "GM",
        # "WhiteFideId": "8603677",
        # "BlackElo": "2795",
        # "BlackTitle": "GM",
        # "BlackFideId": "4168119",
    },
}


UCI_COMMAND_LINE = [
    "/home/crem/dev/lc0/build/release/lc0",
    "--backend=trivial",
    # "--backend=multiplexing",
    # "--backend-opts=a(backend=demux,(backend=cuda-fp16,gpu=0),(backend=cuda-fp16,gpu=1),(backend=cuda-fp16,gpu=2),(backend=cuda-fp16,gpu=3)),b(backend=demux,(backend=cuda-fp16,gpu=4),(backend=cuda-fp16,gpu=5),(backend=cuda-fp16,gpu=6),(backend=cuda-fp16,gpu=7))",
    #'--backend-opts=backend=cuda-fp16,(gpu=6),(gpu=7)',
    "--minibatch-size=768",
    # WCCC/WCCSC
    #'--cpuct=1.9', # WCCC
    # '--cpuct=1.8', # WCCC
    "--cpuct=1.75",  # WCCSC, tie breaks and armageddon
    "--cpuct-base=45669",
    "--cpuct-factor=3.973",
    "--fpu-value=0.25",
    "--policy-softmax-temp=1.15",
    # "--weights=/home/wccc/book-gen/lczero-book-maker/784139",
    "--threads=3",
    # "--syzygy-paths=/home/wccc/syzygy",
    "--ramlimit-mb=90000",
    "--nncache=50000000",
    "--show-wdl",
    "--show-movesleft",
    # f'--logfile={os.path.abspath(".")}/logs/lc0-{datetime.datetime.now().strftime("%Y%m%d-%H%M%S")}.log',
    "--per-pv-counters",
    "--preload",
    "--score-type=Q",
]
