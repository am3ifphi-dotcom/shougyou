# User asset overrides

Any file here whose name matches the basename of a manifest `local_path`
is used instead of the downloaded asset, with no code change. Examples:

    assets/user/PirataOne-Regular.ttf
    assets/user/warrior_s0.png
    assets/user/dungeon.ogg

Run `python3 tools/fetch_assets.py --report` afterwards so `index.json` is
refreshed - the game reads that index to know which overrides exist, so it
never probes for missing files.
