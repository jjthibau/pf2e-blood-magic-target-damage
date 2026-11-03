# Owned Blood Magic choices API (unreleased source)

This additive source API is not part of the published 0.3.0 package yet. No version, release or deployment is included in this change. The existing `selectedBenefits`, `mergeBloodMagicDamage` and `mergePhoenixDamage` API members remain available with their existing behavior.

After the supported native module reaches ready, `game.modules.get("pf2e-blood-magic-target-damage").api.benefitChoicesV1` has `apiVersion: 1`, `read(actor)` and asynchronous `set(actor, key, mode)`. Supply a current native world Actor or synthetic token Actor, not a clone, source object or UUID string. Current user must own the Actor. The module must be active on Foundry generation 14 / exactly PF2e 8.6.0. The caller should additionally bind its own view/session/token context before dispatch; this API does not choose or control canvas tokens.

`read` is read-only and returns plain data:

```js
{
  apiVersion: 1,
  status: "available",
  actorUuid: "Actor.example",
  choices: [{
    key: "phoenix", label: "Phoenix", mode: "damage",
    options: [
      {value: "damage", label: "Damage"},
      {value: "temp-hp", label: "Temp HP"}
    ]
  }]
}
```

Choices derive from the module's existing selected-benefit policy and six profiles. Secondary Blood Magic still requires the existing Blood Sovereignty selection; unresolved Elemental and ambiguous legacy choices are not invented. An unsupported/stale persisted mode is `null` rather than a fabricated current selection. Each read creates plain choice/option objects and exposes no Actor, Item, rules, source references or arbitrary flags. Invalid ownership/runtime/source returns `{apiVersion:1,status:"unavailable",code,choices:[]}`. An available Actor can have an empty choices list. Reading does not update flags, publish chat or request a source pack.

Call `await api.set(actor, choice.key, offeredOption.value)` for a choice from a fresh read. Only a currently selected supported key and exact offered mode can be persisted. Native `Actor.setFlag` uses the existing preference path (`mode` for Phoenix and `modes.KEY` for other profiles). The native character-sheet selector uses this same setter, preserving its labels and modes.

Setter outcomes are bounded plain receipts:

- `completed`: `{apiVersion:1,status:"completed",actorUuid,key,mode,commitObserved:true}`. The native setFlag await fulfilled, and current native identity, user/ownership, runtime/module, selected benefit and persisted flag still match. This confirms that awaited operation and immediate state; it is not a distributed transaction receipt or future cross-client lock.
- `cancelled`: `{apiVersion:1,status:"cancelled",actorUuid,code}` before native dispatch, including disconnected, unavailable Actor, unsupported choice, failed preflight or a duplicate local in-flight choice. It has not invoked setFlag. Invalid source UUID is normalized to `null`.
- `unknown`: `{apiVersion:1,status:"unknown",actorUuid,code}` after dispatch when the native await rejects, connection/context changes, or the resulting flag cannot be verified. A write may already have committed. Review native state; do not automatically retry or report a refund/failure.

Actor UUIDs accept bounded world `Actor.ID` and synthetic `Scene.ID.Token.ID.Actor.ID` shapes (1?64 alphanumeric/underscore/hyphen characters per ID). Unknown receipts retain the validated origin UUID. They never echo arbitrary input keys/modes, raw native results or error messages. Concurrent local writes for the same Actor/key receive a preflight busy cancellation; different choices and other clients remain native operations. This API does not introduce timeouts, rollback, retries or a new transport. A caller timing out an already-dispatched promise must preserve uncertainty.

Alternative benefits disable automatic damage but do not automatically grant their actual effects. Damage merging, cast snapshots, targeting, the Half/Double house-rule setting, native IWR/shield/Undo and all existing damage wrappers remain unchanged.

Portable source validation runs with `npm test`. Native mobile workflow, real ownership/socket behavior and device usability require a separately authorized isolated test lane; no native compatibility acceptance is claimed here.
