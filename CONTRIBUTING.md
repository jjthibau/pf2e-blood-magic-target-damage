# Contributing

Reports and fixes for bloodline selection, damage application, compatibility and documentation are welcome. Include the exact Foundry, PF2e and module versions and a synthetic reproduction. Please omit campaign exports, player information and credentials.

Node22+ and Python3.10+ are sufficient for public checks:

```sh
npm test
npm run build
npm run check:release
```

These checks validate JavaScript syntax and the release package. Native gameplay tests require a licensed, isolated Foundry installation; see [testing](docs/testing.md).

Read [architecture](docs/architecture.md) before changing damage handling. Preserve evaluated dice, target identity, IWR, shield Block and Undo. Keep existing IDs/preferences/cards compatible. Do not widen the version guard without native tests. Keep changes focused and discussions respectful.

Development used AI assistance. Contributors must understand and maintain their submissions. Official directory submissions also have Foundry's separate authorship and AI-content requirements.
