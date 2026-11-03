import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../scripts/main.js', import.meta.url), 'utf8');
const ID = 'pf2e-blood-magic-target-damage';
const feat = key => ({slug:`bloodline-${key}`,system:{rules:[]},flags:{}});
function fixture(keys=['phoenix']) {
  const calls=[],docs=new Map(),preferences=new Map(),once=new Map(),hooks=new Map();
  const actor={documentName:'Actor',uuid:'Actor.synthetic',isOwner:true,itemTypes:{feat:keys.map(feat)},
    options:keys.map(key=>`blood-magic:${key}`),getRollOptions(){return this.options;},
    testUserPermission:(_user,permission)=>permission==='OWNER'&&actor.isOwner,
    getFlag(module,key){assert.equal(module,ID);return preferences.get(key);},
    async setFlag(module,key,value){assert.equal(module,ID);calls.push({key,value});preferences.set(key,value);return actor;}};
  docs.set(actor.uuid,actor);
  class DamageRoll {alter(){return this;}}
  class Actor {async applyDamage(){return 'original';}}
  const originalApply=async()=> 'native-action';
  const module={active:true},sandbox={Map,Set,WeakMap,WeakSet,Object,Number,String,Array,Math,console,
    Hooks:{once:(event,fn)=>once.set(event,fn),on:(event,fn)=>hooks.set(event,fn)},
    CONFIG:{Dice:{rolls:[DamageRoll]},Actor:{documentClass:Actor},PF2E:{damageTypes:{fire:'Fire',void:'Void',electricity:'Electricity',slashing:'Slashing',bludgeoning:'Bludgeoning',piercing:'Piercing'}}},
    game:{socket:{connected:true},system:{id:'pf2e',version:'8.6.0'},release:{generation:14},user:{id:'owner'},modules:new Map([[ID,module]])},
    ui:{notifications:{warn:message=>calls.push({warning:message})},chat:{options:{actions:{applyDamage:originalApply}},constructor:{DEFAULT_OPTIONS:{actions:{applyDamage:originalApply}}}}},
    fromUuidSync:uuid=>docs.get(uuid)};
  vm.createContext(sandbox);vm.runInContext(source,sandbox);once.get('ready')();
  return {actor,docs,preferences,calls,module,sandbox,hooks,api:module.api.benefitChoicesV1};
}

test('ready API is additive and owned reads expose bounded plain choices without writes or raw documents',()=>{
  const f=fixture();assert.deepEqual(Object.keys(f.module.api).sort(),['benefitChoicesV1','mergeBloodMagicDamage','mergePhoenixDamage','selectedBenefits'].sort());
  const r=f.api.read(f.actor);assert.equal(r.apiVersion,1);assert.equal(r.status,'available');assert.equal(r.actorUuid,f.actor.uuid);assert.deepEqual(JSON.parse(JSON.stringify(r.choices)),[{key:'phoenix',label:'Phoenix',mode:'damage',options:[{value:'damage',label:'Damage'},{value:'temp-hp',label:'Temp HP'}]}]);assert.equal(f.calls.length,0);r.choices[0].options[0].label='changed';assert.equal(f.api.read(f.actor).choices[0].options[0].label,'Damage');
});
test('all supported profiles derive offered modes/labels from the same native policy',()=>{
  const expected={phoenix:['temp-hp','Temp HP'],undead:['temp-hp','Temp HP'],diabolic:['other','+2 Deception'],aesir:['other','+2 Reflex saves'],elemental:['other','+2 Intimidation'],psychopomp:['other','+2 Fortitude saves']};
  for(const [key,[mode,label]]of Object.entries(expected)){const f=fixture([key]);if(key==='elemental')f.actor.itemTypes.feat[0].flags={system:{rulesSelections:{elementalBloodline:{damageType:'fire'}}}};const c=f.api.read(f.actor).choices[0];assert.equal(c.key,key);assert.equal(c.options[1].value,mode);assert.equal(c.options[1].label,label);}
});
test('unresolved Elemental selection and unsupported bloodlines receive no inferred choices',()=>{
  for(const key of ['elemental','hag']){const f=fixture([key]);assert.equal(f.api.read(f.actor).choices.length,0);}
});
test('secondary selected benefit requires native Blood Sovereignty and remains independently settable',async()=>{
  const f=fixture(['phoenix','undead']);f.actor.options=['blood-magic:phoenix','second-blood-magic:undead'];assert.equal(f.api.read(f.actor).choices.length,1);assert.equal((await f.api.set(f.actor,'undead','temp-hp')).status,'cancelled');f.actor.options.push('feat:blood-sovereignty');assert.equal(f.api.read(f.actor).choices.length,2);assert.equal((await f.api.set(f.actor,'undead','temp-hp')).status,'completed');assert.equal(f.preferences.get('modes.undead'),'temp-hp');assert.equal(f.preferences.has('mode'),false);
});
test('legacy Phoenix uses preserved mode key and ambiguous legacy bloodlines remain unavailable',async()=>{
  const f=fixture();f.actor.options=[];f.actor.itemTypes.feat[0].system.rules=[{key:'ActiveEffectLike',path:'flags.pf2e.sorcerer.bloodline.spells',value:{}}];assert.equal(f.api.read(f.actor).choices.length,1);const r=await f.api.set(f.actor,'phoenix','temp-hp');assert.equal(r.status,'completed');assert.equal(f.preferences.get('mode'),'temp-hp');f.actor.itemTypes.feat.push({...feat('undead'),system:{rules:[...f.actor.itemTypes.feat[0].system.rules]}});assert.equal(f.api.read(f.actor).choices.length,0);
});
test('nonowned, deleted/replaced/cloned Actor and unsupported runtime/module fail before any write',async()=>{
  for(const change of [f=>f.actor.isOwner=false,f=>f.docs.clear(),f=>f.docs.set(f.actor.uuid,{...f.actor}),f=>f.sandbox.game.system.version='8.7.0',f=>f.sandbox.game.release.generation=15,f=>f.module.active=false]){const f=fixture();change(f);assert.equal(f.api.read(f.actor).status,'unavailable');assert.equal((await f.api.set(f.actor,'phoenix','temp-hp')).status,'cancelled');assert.equal(f.calls.length,0);}
});
test('only exact current selected key and offered mode may persist; malformed current flags stay unknown in read',async()=>{
  for(const [key,mode]of [['undead','temp-hp'],['phoenix','other'],['__proto__','damage'],['phoenix',{mode:'damage'}],['phoenix','DAMAGE']]){const f=fixture();assert.equal((await f.api.set(f.actor,key,mode)).status,'cancelled');assert.equal(f.calls.length,0);}const f=fixture();f.preferences.set('mode','arbitrary');assert.equal(f.api.read(f.actor).choices[0].mode,null);assert.equal((await f.api.set(f.actor,'phoenix','damage')).status,'completed');
});
test('world and synthetic token Actor UUIDs work while malformed/unbounded UUIDs never escape receipts',async()=>{
  const f=fixture();f.docs.clear();f.actor.uuid='Scene.scene.Token.token.Actor.synthetic';f.docs.set(f.actor.uuid,f.actor);assert.equal((await f.api.set(f.actor,'phoenix','temp-hp')).status,'completed');
  for(const uuid of ['Actor.bad\nvalue','JournalEntry.wrong','Actor.'+'x'.repeat(10000),'Actor.a.Item.b']){f.actor.uuid=uuid;const r=await f.api.set(f.actor,'phoenix','damage');assert.equal(r.status,'cancelled');assert.equal(r.actorUuid,null);assert.equal(f.api.read(f.actor).status,'unavailable');}
});
test('awaited flag write is not completed early and duplicate in-flight request is cancelled',async()=>{
  const f=fixture();let finish;f.actor.setFlag=async(module,key,mode)=>{f.calls.push({key,mode});await new Promise(resolve=>finish=resolve);f.preferences.set(key,mode);return f.actor;};const pending=f.api.set(f.actor,'phoenix','temp-hp');assert.equal(f.calls.length,1);assert.equal((await f.api.set(f.actor,'phoenix','damage')).code,'BUSY');finish();const r=await pending;assert.equal(r.status,'completed');assert.equal(r.commitObserved,true);assert.equal(f.calls.length,1);
});
test('native write rejection and mismatched flag stay unknown without retry',async()=>{
  for(const write of [async()=>{throw Error('private transport detail');},async()=>{}]){const f=fixture();let writes=0;f.actor.setFlag=async()=>{writes++;return write();};const r=await f.api.set(f.actor,'phoenix','temp-hp');assert.equal(r.status,'unknown');assert.equal(writes,1);assert.equal(JSON.stringify(r).includes('private'),false);}
});
test('postdispatch ownership/session/current selection/native identity drift remains unknown',async()=>{
  for(const change of [f=>f.actor.isOwner=false,f=>f.sandbox.game.user={id:'other'},f=>f.sandbox.game.user.id='other',f=>f.actor.options=[],f=>f.docs.clear(),f=>f.module.active=false]){const f=fixture();f.actor.setFlag=async(_module,key,mode)=>{f.calls.push({key,mode});f.preferences.set(key,mode);change(f);return f.actor;};const r=await f.api.set(f.actor,'phoenix','temp-hp');assert.equal(r.status,'unknown');assert.equal(f.calls.length,1);}
});
test('throwing native preflight or malformed source UUID getter returns plain typed refusal',async()=>{
  const f=fixture();f.actor.getRollOptions=()=>{throw Error('native read');};assert.equal(f.api.read(f.actor).status,'unavailable');assert.equal((await f.api.set(f.actor,'phoenix','damage')).status,'cancelled');Object.defineProperty(f.actor,'uuid',{get(){throw Error('private getter');}});assert.equal((await f.api.set(f.actor,'phoenix','damage')).actorUuid,null);assert.equal(f.calls.length,0);
});


test('disconnected preflight cannot queue a flag write; disconnect after dispatch is uncertain',async()=>{
  const f=fixture();f.sandbox.game.socket.connected=false;assert.equal((await f.api.set(f.actor,'phoenix','temp-hp')).code,'DISCONNECTED');assert.equal(f.calls.length,0);assert.equal(f.api.read(f.actor).status,'available');f.sandbox.game.socket.connected=true;f.actor.setFlag=async(_module,key,mode)=>{f.calls.push({key,mode});f.preferences.set(key,mode);f.sandbox.game.socket.connected=false;};assert.equal((await f.api.set(f.actor,'phoenix','temp-hp')).status,'unknown');assert.equal(f.calls.length,1);
});

test('native sheet selector shares V1 validation, persists legacy preference and restores current UI after refusal',async()=>{
  const f=fixture();
  class Element {constructor(){this.style={};this.children=[];this.listeners=new Map();this.isConnected=true;}append(...children){this.children.push(...children);}setAttribute(){}add(option){this.children.push(option);}addEventListener(event,fn){this.listeners.set(event,fn);}}
  const row=new Element(),root=new Element();root.querySelector=selector=>selector==='[data-option="blood-magic"]'?row:null;
  f.sandbox.HTMLElement=Element;f.sandbox.Option=class {constructor(label,value){this.label=label;this.value=value;}};f.sandbox.document={createElement:()=>new Element()};
  f.hooks.get('renderActorSheet')({actor:f.actor},root);const select=row.children[0].children.find(child=>child.listeners?.has('change'));assert.equal(select.value,'damage');assert.deepEqual(select.children.map(child=>child.value),['damage','temp-hp']);select.value='temp-hp';await select.listeners.get('change')({stopPropagation(){}});assert.equal(f.preferences.get('mode'),'temp-hp');assert.equal(select.value,'temp-hp');assert.equal(select.disabled,false);f.actor.isOwner=false;select.value='damage';await select.listeners.get('change')({stopPropagation(){}});assert.equal(f.preferences.get('mode'),'temp-hp');assert.equal(select.disabled,true);assert.equal(f.calls.filter(call=>call.key).length,1);
});
