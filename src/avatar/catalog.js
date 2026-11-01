export const MALE_BASE_ID = 'male-base-v2';
export const FACE_STYLES = ['calm', 'resolute', 'gentle', 'wry', 'stern'].map(name => ({
  id: `male.face.${name}`, name: name[0].toUpperCase() + name.slice(1),
  detail: `/assets/male/uv/layer-${name}.png`, irisMask: `/assets/male/uv/layer-iris-${name}.png`,
}));
export const BODY_STYLES = ['smooth', 'weathered'].map(name => ({
  id: `male.body.${name}`, name: name[0].toUpperCase() + name.slice(1), map: `/assets/male/body-${name}.png`,
}));
export const STARTER_UNDERWEAR = Object.freeze({
  id: 'underwear.male.starter', name: 'Starter boxer briefs', slot: 'underwear',
  model: MALE_BASE_ID, map: '/assets/male/underwear-starter.png',
});
