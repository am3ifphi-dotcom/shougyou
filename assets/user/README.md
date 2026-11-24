# User asset overrides

For any manifest `id`, place a replacement file at `assets/user/<id>` (exact, no
extension) or `assets/user/<id>.<ext>` using the original extension, then add
that id to `assets/user/index.json`. The runtime reads the index once and only
probes declared override paths before the checked-in asset or the upstream URL.

Examples:
  assets/user/bgm_title
  assets/user/bgm_title.ogg
  assets/user/portrait-mie.png

`assets/user/index.json` itself is committed so the loader never emits dozens
of intentional 404 requests. The override binaries are local-only and ignored
by Git. A `COMMERCIAL_BUILD=true` build still excludes every manifest entry
marked `noncommercial_only: true`, even if an override is declared.
