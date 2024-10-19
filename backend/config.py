# DB_PATH = "sqlite://../.db/lczero_live.db"
DB_PATH = "sqlite://:memory:"
DB_MODULES = {"lc0live": ["db"]}


PGN_FEED = {
    "url": "https://lichess.org/api/stream/broadcast/round/fTfD1GmN.pgn",
    "filters": {
        # "Event": "FIDE World Championship Match 2023",
        # "Site": "Astana KAZ",
        # "Date": "2023.04.23",
        "Round": "2.8",
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
