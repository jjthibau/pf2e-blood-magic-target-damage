# PF2e Blood Magic Target Damage

[![Release](https://img.shields.io/github/v/release/jjthibau/pf2e-blood-magic-target-damage)](https://github.com/jjthibau/pf2e-blood-magic-target-damage/releases/latest)
[![CI](https://github.com/jjthibau/pf2e-blood-magic-target-damage/actions/workflows/ci.yml/badge.svg)](https://github.com/jjthibau/pf2e-blood-magic-target-damage/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Merge sorcerer Blood Magic bonus damage into one targeted creature's native PF2e spell damage, preserving resistances, weaknesses, shield Block and Undo.

**Compatibility:** Foundry **14.369**, generation **14**, and **exactly PF2e8.6.0**. Automation disables itself on other PF2e versions until reviewed. English UI; no required add-on modules.

Version **0.3.0** generalizes the merged-damage workflow to the six PF2e 8.6.0 bloodlines with an immediate spell-rank damage option. Module ID stays `pf2e-blood-magic-target-damage`, preserving existing world enablement, settings and Phoenix preferences.

| Bloodline | Bonus type | Alternate choice |
| --- | --- | --- |
| Phoenix | Fire | Temp HP |
| Diabolic | Fire | +2 Deception |
| Undead | Void | Temp HP |
| Aesir | Electricity | +2 Reflex saves |
| Elemental | Native selected element's damage type | +2 Intimidation |
| Psychopomp | Void against living targets; vitality against undead | +2 Fortitude saves |

Elemental reads the native ChoiceSet's stored damage type: air slashing, earth/water/wood bludgeoning, fire fire, metal piercing. No guessing from spell names or English descriptions. Unknown or unresolved profiles produce no automatic bonus. Nondamage bloodlines and delayed retaliation such as Hag use PF2e's existing effects.

Older bloodline items can lack current PF2e toggles and tags. If exactly one unambiguous supported legacy bloodline supplies PF2e's stored bloodline spell table, the module uses that table to recognize its listed slotted/focus spells and adds a selector on Spellcasting. It does not replace or rewrite the old item. Mixed ambiguous legacy/native configurations do not receive an inferred selection.

The alternate choice **disables automatic bonus damage**. Apply its actual effect with PF2e's native effect link; selecting it does not automatically grant temporary HP or a skill/save modifier. This retains the original module's alternate-benefit scope.

## Install

1. Open Foundry Setup ? Add-on Modules ? Install Module.
2. Paste this Manifest URL:

```text
https://github.com/jjthibau/pf2e-blood-magic-target-damage/releases/latest/download/module.json
```

3. Launch your PF2e world and enable **PF2e Blood Magic Target Damage** under Manage Modules, then reload clients.
4. Review the **bonus before damage multipliers** house-rule setting described below. It is enabled by default.

The direct URL works before official directory approval. Existing0.3.0 users keep the same module ID, settings and cards. Blood Magic and Hidden Enemy Spells install and update independently.

## Use

1. On Spellcasting, choose the native Blood Magic bloodline, then its Damage / alternate-benefit selector.
2. Cast a spell PF2e identifies with its native `blood-magic-spell` tag and roll damage.
3. Keep exactly one intended enemy targeted on the casting user's client.
4. The GM selects recipients and clicks the native Damage, Half or Double button. Block is a toggle followed by the damage amount.
5. Only the designated scene token receives the spell-rank bonus. It is merged with matching initial damage before IWR, shield hardness and HP. Native Undo reverses the combined application.

Zero/multiple targets, a target outside the selected recipients, healing, failed spell attacks, non-bloodline spells, and alternate-benefit cards receive no bonus. The module preserves evaluated dice, other recipients, native contextual actors, shift adjustments, main chat/popouts, shield HP and native Undo.

New cards snapshot selected benefits, damage types, rank and casting user. Choices are independent per bloodline, and changing a choice later does not change old cards. Phoenix cards from 0.2.x and the original Phoenix preference flag remain supported without migrating campaign data.

Crossblooded Evolution can use its selected native Blood Magic. A secondary damage benefit also requires PF2e's Blood Sovereignty option. Two distinct selected damage benefits merge into one application on the same single designated target; choosing different targets for the two effects is outside this single-target workflow. Blood Rising's separate reaction is not automated.

## Half / Double setting

**Configure Settings → PF2e Blood Magic Target Damage → Blood Magic bonus before damage multipliers (house rule)** defaults **on**. The bonus is merged into the original evaluated roll before native multipliers and rounding. Example: 10 fire + rank 3 gives Half 6 or Double 26 before IWR; other recipients receive Half 5 / Double 20. Native shift adjustments are preserved.

[Blood Magic's published rule](https://2e.aonprd.com/Bloodlines.aspx) requires a hit or failed save against a foe. The bloodlines specify combining matching damage before IWR without explicitly specifying multiplication of this separate effect. Applying the bonus on a successful basic save is a house rule. Turn this setting off to preserve 0.2.0 handling: Half skips Blood Magic and Double adds the flat rank bonus after multiplying the spell.

Setting key `beforeMultiplier` is unchanged from 0.2.1. It is read when the GM applies damage, so this setting also controls existing cards.

## Development and support

Report reproducible issues with the [bug form](https://github.com/jjthibau/pf2e-blood-magic-target-damage/issues/new/choose). Include versions, bloodline/element, spell rank, targets, damage recipients and multiplier setting. Avoid private campaign exports or player information.

```sh
npm test
npm run build
npm run check:release
```

Public checks validate JavaScript syntax and release packaging. Native gameplay requires a licensed isolated installation; see [testing](docs/testing.md), [architecture](docs/architecture.md), [contributing](CONTRIBUTING.md), and [publishing](docs/publishing.md). No campaign data, licensed core/system files or compendiums are included. The module has no runtime AI or external service calls; development used AI assistance.

MIT licensed; see [LICENSE](LICENSE).
