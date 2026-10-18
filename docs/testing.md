# Testing

Public CI runs JavaScript syntax checks plus deterministic package/manifest/privacy checks. It does not install Foundry or execute gameplay. Native tests require a licensed Foundry installation and an isolated world.

The previously playtested gameplay code passed332 native assertions across damage/UI/player/GM and supported bloodline scenarios before public packaging. Historical test fixtures included private character copies, so their harnesses and raw results are not distributed. The runtime code is published without campaign data.

For public0.3.0 packaging, a new empty licensed world with synthetic characters passed309 native assertions:80 damage/UI,222 generalized bloodline and7 separate player/GM checks. No page or console errors occurred. The public manifest was loaded, gameplay source bytes were unchanged, and the private test world was closed afterward. Legacy real-character behavior remains covered by the earlier private validation rather than this synthetic run.

Use synthetic characters and targets to verify:

- Phoenix/Diabolic fire, Undead void, Aesir electricity, all six Elemental choices and Psychopomp living/undead switching.
- Native qualifying spell recognition; nonqualifying spells, cantrips, healing, missing/ambiguous selections and alternate benefits.
- Zero, one and multiple caster targets; designated target included/excluded from selected damage recipients.
- Same-type resistance/weakness/immunity and mixed-damage rolls; preserve already-evaluated dice.
- Full/Half/Double and shift adjustments with the house-rule setting both on and off.
- Shield Block, hardness, shield HP and native Undo for the combined application.
- Crossblooded Evolution/Blood Sovereignty selections and previous Phoenix cards/preferences.
- Actual player casting/targeting followed by GM damage application, main chat and chat popouts.
- Conservative legacy actor support without rewriting source features.
- Unsupported PF2e versions disable automation with a warning.

Run first with only this module, then with the table's module stack. Keep observed core/asset errors distinct from module failures. Do not treat a synthetic test pass as coverage of every third-party module.
