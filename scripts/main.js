const MODULE_ID = "pf2e-blood-magic-target-damage";
const pendingRolls = new WeakMap();
const applicationRolls = new WeakMap();
const wrappedActions = new WeakSet();
// PF2e 8.6.0 bloodlines with an immediate spell-rank damage benefit.
// Delayed retaliation (Hag) and nondamage bloodlines use PF2e's own effects.
const BLOODLINES = {
  phoenix: { label: "Phoenix", damageType: "fire", alternative: "Temp HP", alternateMode: "temp-hp" },
  diabolic: { label: "Diabolic", damageType: "fire", alternative: "+2 Deception" },
  undead: { label: "Undead", damageType: "void", alternative: "Temp HP", alternateMode: "temp-hp" },
  aesir: { label: "Aesir", damageType: "electricity", alternative: "+2 Reflex saves" },
  elemental: { label: "Elemental", alternative: "+2 Intimidation" },
  psychopomp: { label: "Psychopomp", damageType: "target-life", alternative: "+2 Fortitude saves" }
};

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, "beforeMultiplier", {
    name: "Blood Magic bonus before damage multipliers (house rule)",
    hint: "Include Blood Magic damage before Half/Double, including on a successful basic save. Off preserves the separate Blood Magic outcome and flat rank bonus. Applies only to this world.",
    scope: "world", config: true, type: Boolean, default: true
  });
});

// Retain native contextual actors, shield block, IWR, HP updates, and undo.
Hooks.once("ready", () => {
  if (game.system.id !== "pf2e" || game.system.version !== "8.6.0" || game.release.generation !== 14) {
    ui.notifications.warn("Blood Magic automation requires Foundry 14 / PF2e 8.6.0; automation is disabled.");
    return;
  }
  const DamageRoll = CONFIG.Dice.rolls.find((cls) => cls.name === "DamageRoll");
  const actorPrototype = CONFIG.Actor.documentClass.prototype;
  if (!DamageRoll || typeof actorPrototype.applyDamage !== "function") return;

  const originalAlter = DamageRoll.prototype.alter;
  DamageRoll.prototype.alter = function (...args) {
    let result = originalAlter.apply(this, args);
    const context = pendingRolls.get(this);
    if (context && args[0] > 0) {
      // alter(1, 0) returns the original. Keep application state off that roll.
      if (result === this) result = DamageRoll.fromData(this.toJSON());
      applicationRolls.set(result, { ...context, multiplier: args[0], sourceRoll: this, alterArgs: args });
    }
    return result;
  };

  const originalApplyDamage = actorPrototype.applyDamage;
  actorPrototype.applyDamage = async function (params) {
    const context = applicationRolls.get(params.damage);
    if (context && params.token?.uuid === context.targetUuid && params.item?.uuid === context.itemUuid
        && !params.skipIWR && !params.final && (context.beforeMultiplier || context.multiplier >= 1)
        && !["failure", "criticalFailure"].includes(context.attackOutcome)) {
      // Rebuild from the original evaluated roll before altering it so native
      // rounding, shift adjustments, and per-type damage stay intact.
      let merged = context.beforeMultiplier ? context.sourceRoll : params.damage;
      for (const benefit of context.benefits) merged = await mergeBloodMagicDamage(merged, context.rank, benefit.damageType);
      const damage = context.beforeMultiplier ? originalAlter.apply(merged, context.alterArgs) : merged;
      params = {
        ...params,
        damage,
        breakdown: [...(params.breakdown ?? []), ...context.benefits.map(benefit => `${benefit.label} Blood Magic +${context.rank} ${benefit.damageType}${context.beforeMultiplier && context.multiplier !== 1 ? ` (before ×${context.multiplier})` : ""}`)]
      };
    }
    return originalApplyDamage.call(this, params);
  };

  installAction(ui.chat.options.actions);
  installAction(ui.chat.constructor.DEFAULT_OPTIONS.actions);
  Hooks.on("renderChatPopout", (app) => installAction(app.options.actions));
  Hooks.on("renderActorSheet", renderBloodMagicChoice);
  Hooks.on("renderActorSheetV2", renderBloodMagicChoice);
  Hooks.on("preCreateChatMessage", snapshotChoice);
  game.modules.get(MODULE_ID).api = {
    mergeBloodMagicDamage, selectedBenefits,
    // Compatibility for existing macros and the original Phoenix test suite.
    mergePhoenixDamage: (roll, rank) => mergeBloodMagicDamage(roll, rank, "fire")
  };
});

function installAction(actions) {
  const original = actions?.applyDamage;
  if (typeof original !== "function" || wrappedActions.has(original)) return;
  const wrapped = async function (event, button) {
    const messageId = button.closest("[data-message-id]")?.dataset.messageId;
    const message = game.messages.get(messageId);
    const rollIndex = Number(button.closest("[data-roll-index]")?.dataset.rollIndex) || 0;
    const roll = message?.rolls.at(rollIndex);
    const context = resolveContext(message);
    if (!context || !roll || !(Number(button.dataset.multiplier) > 0)) {
      return original.call(this, event, button);
    }
    if (pendingRolls.has(roll)) {
      ui.notifications.warn("Finish the current damage application before applying this roll again.");
      return;
    }
    pendingRolls.set(roll, context);
    try {
      return await original.call(this, event, button);
    } finally {
      pendingRolls.delete(roll);
    }
  };
  wrappedActions.add(wrapped);
  actions.applyDamage = wrapped;
}

function bloodlineItem(actor, key) {
  return actor?.itemTypes.feat?.find(item => item.slug === `bloodline-${key}`);
}

function preferenceKey(key) {
  // Retain existing Phoenix preferences without migrating campaign documents.
  return key === "phoenix" ? "mode" : `modes.${key}`;
}

function legacySpellList(item) {
  return item?.system.rules?.find(rule => rule.key === "ActiveEffectLike"
    && rule.path === "flags.pf2e.sorcerer.bloodline.spells")?.value;
}

function legacyBloodline(actor) {
  // Mixed old/new configurations must use their explicit native selection.
  if (actor?.itemTypes.feat?.some(item => item.system.rules?.some(rule => rule.key === "RollOption" && rule.option === "blood-magic"))) return null;
  const candidates = Object.keys(BLOODLINES).filter(key => legacySpellList(bloodlineItem(actor, key)));
  return candidates.length === 1 ? candidates[0] : null;
}

function legacyQualifyingSpell(spell, actor) {
  const key = legacyBloodline(actor);
  if (!key || spell.isCantrip) return false;
  const feature = bloodlineItem(actor, key);
  const entries = Object.entries(legacySpellList(feature));
  const focus = spell.isFocusSpell;
  const listed = entries.some(([rank, entry]) => entry.slug === spell.slug
    && (focus ? ["initial", "advanced", "greater"].includes(rank) : /^\d+(st|nd|rd|th)$/.test(rank)));
  const tradition = feature.system.rules.find(rule => rule.path === "system.proficiencies.aliases.sorcerer")?.value;
  return listed && (focus || (spell.spellcasting?.category === "spontaneous" && tradition && spell.spellcasting.tradition === tradition));
}

function selectedBenefits(actor, options) {
  const choices = options ?? actor?.getRollOptions?.(["all"]) ?? [];
  const legacy = choices.some(option => option.startsWith("blood-magic:")) ? null : legacyBloodline(actor);
  return Object.entries(BLOODLINES).flatMap(([key, profile]) => {
    const item = bloodlineItem(actor, key);
    if (!item || !(legacy === key || choices.includes(`blood-magic:${key}`)
        || (choices.includes(`second-blood-magic:${key}`) && choices.includes("feat:blood-sovereignty")))) return [];
    const damageType = profile.damageType ?? item.flags.system?.rulesSelections?.elementalBloodline?.damageType
      ?? item.flags.pf2e?.rulesSelections?.elementalBloodline?.damageType;
    if (damageType !== "target-life" && !(damageType in CONFIG.PF2E.damageTypes)) return [];
    return [{ key, label: profile.label, damageType, mode: actor.getFlag(MODULE_ID, preferenceKey(key)) ?? "damage" }];
  });
}

function isQualifyingSpell(message) {
  const item = message?.item;
  return message?.isDamageRoll && item?.isOfType("spell") && Object.keys(BLOODLINES).some(key => bloodlineItem(message.actor, key))
    && (item.system.traits.otherTags.includes("blood-magic-spell")
      || item.getRollOptions("item").includes("item:tag:blood-magic-spell")
      || legacyQualifyingSpell(item, message.actor));
}

function snapshotChoice(message) {
  if (!isQualifyingSpell(message)) return;
  const benefits = selectedBenefits(message.actor, message.flags.pf2e?.context?.options);
  message.updateSource({ [`flags.${MODULE_ID}.choice`]: {
    mode: benefits.some(b => b.mode === "damage") ? "damage" : benefits[0]?.mode ?? "off",
    benefits,
    rank: message.flags.pf2e?.origin?.castRank ?? message.item.rank,
    userId: game.user.id
  } });
}

function resolveContext(message) {
  if (!isQualifyingSpell(message)) return null;
  const choice = message.getFlag(MODULE_ID, "choice");
  const saved = choice?.benefits ?? (choice ? [{ key: "phoenix", mode: choice.mode, damageType: "fire" }]
    : selectedBenefits(message.actor, message.flags.pf2e?.context?.options));
  const benefits = saved.filter(b => BLOODLINES[b.key] && bloodlineItem(message.actor, b.key) && b.mode === "damage");
  if (!benefits.length) return null;
  const rank = Number(choice?.rank ?? message.flags.pf2e?.origin?.castRank ?? message.item.rank);
  if (!Number.isInteger(rank) || rank < 1 || rank > 10) return null;
  // Use the actual roller, never an arbitrary other owner's targets.
  const user = game.users.get(choice?.userId ?? message.author?.id);
  if (!user || !message.actor.testUserPermission(user, "OWNER")) return null;
  const targets = [...user.targets];
  if (targets.length !== 1) return null;
  const target = targets[0]?.document ?? targets[0];
  if (!target?.actor || target.parent?.id !== canvas.scene?.id) return null;
  const resolvedBenefits = benefits.map(b => ({
    label: BLOODLINES[b.key].label,
    damageType: b.damageType === "target-life" ? (target.actor.modeOfBeing === "undead" ? "vitality" : "void") : b.damageType
  })).filter(b => b.damageType in CONFIG.PF2E.damageTypes);
  if (!resolvedBenefits.length) return null;
  const options = message.flags.pf2e?.context?.options ?? [];
  const isAttack = message.item.system.traits.value.includes("attack") || options.includes("item:trait:attack");
  return {
    targetUuid: target.uuid,
    itemUuid: message.item.uuid,
    rank,
    benefits: resolvedBenefits,
    beforeMultiplier: game.settings.get(MODULE_ID, "beforeMultiplier"),
    attackOutcome: isAttack ? message.flags.pf2e?.context?.outcome : null
  };
}

async function mergeBloodMagicDamage(roll, rank, damageType) {
  const DamageRoll = roll.constructor;
  const instances = roll.instances.map((instance) => instance.constructor.fromData(instance.toJSON()));
  const index = instances.findIndex((instance) => instance.type === damageType && !instance.persistent);
  if (index >= 0) {
    const instance = instances[index];
    const head = foundry.dice.terms.RollTerm.fromData({
      class: "ArithmeticExpression",
      operator: "+",
      operands: [
        { class: "Grouping", term: instance.head.toJSON() },
        { class: "NumericTerm", number: rank }
      ],
      evaluated: true
    });
    instances[index] = instance.constructor.fromTerms([head], foundry.utils.deepClone(instance.options));
  } else {
    const bonus = await new DamageRoll(`{${rank}[${damageType}]}`).evaluate();
    instances.push(...bonus.instances);
  }
  return DamageRoll.fromTerms([roll.pool.constructor.fromRolls(instances)], foundry.utils.deepClone(roll.options));
}

function renderBloodMagicChoice(sheet, html) {
  const actor = sheet.actor;
  const root = html instanceof HTMLElement ? html : html?.[0];
  if (!root || root.querySelector(`[data-${MODULE_ID}]`)) return;
  let row = root.querySelector('[data-option="blood-magic"]');
  if (!row && legacyBloodline(actor)) {
    const tab = root.querySelector('[data-tab="spellcasting"].tab');
    if (tab) {
      row = document.createElement("div");
      row.dataset.bloodMagicLegacy = "";
      row.append("Blood Magic ");
      tab.prepend(row);
    }
  }
  if (!row) return;
  const label = document.createElement("label");
  label.setAttribute(`data-${MODULE_ID}`, "");
  label.style.cssText = "display:inline-flex;align-items:center;gap:0.35em;margin-left:0.5em";
  const benefits = selectedBenefits(actor);
  if (!benefits.length) return;
  for (const benefit of benefits) {
    const profile = BLOODLINES[benefit.key];
    const text = document.createElement("span");
    text.textContent = `${profile.label}: `;
    label.append(text);
    const select = document.createElement("select");
    select.setAttribute("aria-label", `${profile.label} Blood Magic benefit`);
    select.title = "Damage adds the spell rank to your single target. The world setting controls Half/Double. The alternate benefit uses PF2e's native effect link; choosing it disables automatic bonus damage.";
    select.add(new Option("Damage", "damage"));
    select.add(new Option(profile.alternative, profile.alternateMode ?? "other"));
    select.value = benefit.mode;
    select.disabled = !actor.isOwner;
    select.addEventListener("change", async (event) => {
      event.stopPropagation();
      await actor.setFlag(MODULE_ID, preferenceKey(benefit.key), select.value);
    });
    label.append(select);
  }
  row.append(label);
}
