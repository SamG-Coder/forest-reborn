/** Resource identity is independent of the shape or movement of an item. */
const metals = [
  ['iron', 'Iron', '#798388', .62, .90],
  ['steel', 'Steel', '#a1b7cc', .36, .96],
  ['copper', 'Copper', '#c77951', .48, .92],
  ['bronze', 'Bronze', '#ac883f', .54, .92],
  ['silver', 'Silver', '#e3e8ed', .25, .98],
  ['mithril', 'Mithril', '#63d4cf', .30, .95],
];

export const METAL_RESOURCES = Object.freeze(Object.fromEntries(metals.map(
  ([id, name, color, roughness, metalness]) => [id, Object.freeze({id, name, color, roughness, metalness})],
)));
export const METAL_IDS = Object.freeze(Object.keys(METAL_RESOURCES));

export function metalResource(id) {
  const resource = METAL_RESOURCES[id];
  if (!resource) throw new Error(`Unknown metal resource: ${id}`);
  return resource;
}
