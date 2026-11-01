import {SaveLibrary} from './save-library.js';

export const saveLibrary = new SaveLibrary(localStorage);
export let session = null;
export function selectSession(entry) {
  session = {entry, storage: saveLibrary.slot(entry.id)};
  return session;
}
export function updateSession(values) {
  session.entry = saveLibrary.update(session.entry.id, values);
}
