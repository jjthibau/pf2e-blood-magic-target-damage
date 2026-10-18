# Architecture

The runtime is `scripts/main.js`. It registers a world setting during `init` and installs the automation during `ready` only on Foundry generation14/PF2e8.6.0. There are no dependencies or external service calls.

## Selection and snapshots

`selectedBenefits` reads supported native Blood Magic choices and the module's per-bloodline damage/alternate preference. Elemental uses the native stored damage choice. Psychopomp resolves void/vitality against the designated target. Legacy support uses one unambiguous bloodline's stored spell list and does not rewrite the character's original features.

`snapshotChoice` stores rank, caster and selected benefits on new damage cards. Original Phoenix choice flags and old cards remain supported. The caster must have exactly one intended target when damage is applied; target identity is carried through native application.

## Native damage integration

The module wraps chat damage actions and `DamageRoll.alter`, then passes application context through WeakMaps. It wraps `Actor.applyDamage` only to substitute the merged roll for the one designated target. Native processing still handles IWR, shield Block, HP and damage receipts/Undo.

`mergeBloodMagicDamage` clones evaluated damage instances, adds the flat rank bonus to matching nonpersistent damage, or adds a new typed instance. The original evaluated dice are preserved. The multiplier setting chooses whether to merge before native Half/Double or use the older flat-after-multiplication behavior. A pending-application guard prevents concurrent use of the same roll.

These wrappers depend on PF2e implementation details. Compatibility requires actual native tests, not only syntax checks. Pay particular attention to mixed damage, matching damage with resistance/weakness, targeting versus recipients, shift adjustments, shield HP, Undo and casts from player clients.

## Scope

Alternative benefits remain manual. Hag retaliation, Blood Rising, separate targets for multiple benefits, unresolved profiles, cantrips, healing and nonqualifying spells are outside automatic bonus damage. UI labels currently use English. No compendium or rules-text library is bundled.
