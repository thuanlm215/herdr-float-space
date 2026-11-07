// Notes: up to five named pages, kept in a file of the mod's own instead of
// Herdr's shared state, which redraws every mod in the app on each change.
// No Herdr calls here, so the tests import it directly.

export const MAX_NOTES = 5;
export const NAME_LENGTH = 40;
const ID = /^n[1-9][0-9]*$/;

// The mod's data folder, which Herdr makes for every mod.
export function notesPath(appHome) {
  return `${appHome}/data/float-space/notes.json`;
}

// One line, at most NAME_LENGTH characters; blank gives the fallback.
export function noteName(value, fallback) {
  const name = Array.from(String(value ?? "").replace(/\s+/g, " ").trim()).slice(0, NAME_LENGTH).join("");
  return name || fallback;
}

// Never drops a note's text: an entry with a missing or repeated id gets a
// new one, and a file edited to hold more than MAX_NOTES keeps them all (only
// adding is refused).
export function readNotes(value) {
  if (value?.version > 1) {
    throw new Error("Float Space notes belong to a newer version. Update the mod before opening them.");
  }
  const entries = (Array.isArray(value?.notes) ? value.notes : []).filter(note => note && typeof note === "object");
  const taken = new Set();
  const ids = entries.map(note => {
    if (!ID.test(note.id ?? "") || taken.has(note.id)) return null;
    taken.add(note.id);
    return note.id;
  });
  let sequence = Math.max(0, ...[...taken].map(id => Number(id.slice(1))),
    Number.isSafeInteger(value?.sequence) ? value.sequence : 0);
  const notes = entries.map((note, i) => ({
    id: ids[i] ?? `n${++sequence}`,
    name: noteName(note.name, `Note ${i + 1}`),
    text: typeof note.text === "string" ? note.text : "",
  }));
  if (!notes.length) notes.push({ id: `n${++sequence}`, name: "Notes", text: "" });
  return {
    version: 1,
    active: notes.some(note => note.id === value?.active) ? value.active : notes[0].id,
    sequence,
    notes,
  };
}

export function parseNotes(text) {
  let value;
  try { value = JSON.parse(text); }
  catch { throw new Error("Float Space could not read its notes file: it is not valid JSON."); }
  return readNotes(value);
}

export function serializeNotes(doc) {
  return `${JSON.stringify(doc, null, 2)}\n`;
}

// The single Notes page of earlier versions becomes the first note.
export function firstNotes(legacy) {
  return readNotes({ notes: [{ id: "n1", name: "Notes", text: typeof legacy === "string" ? legacy : "" }] });
}

export function activeNote(doc) {
  return doc.notes.find(note => note.id === doc.active) ?? doc.notes[0];
}

// "Note 2" for the second, skipping names already used.
export function nextNoteName(notes) {
  const used = new Set(notes.map(note => note.name));
  let number = notes.length + 1;
  while (used.has(`Note ${number}`)) number += 1;
  return `Note ${number}`;
}

// The new note becomes the shown one. Ids are never reused, so a menu or a
// command naming a deleted note can't reach a newer one.
export function addNote(doc, name) {
  if (doc.notes.length >= MAX_NOTES) {
    throw new Error(`Float Space keeps up to ${MAX_NOTES} notes. Delete one before adding another.`);
  }
  const id = `n${doc.sequence + 1}`;
  return {
    ...doc, active: id, sequence: doc.sequence + 1,
    notes: [...doc.notes, { id, name: noteName(name, nextNoteName(doc.notes)), text: "" }],
  };
}

export function renameNote(doc, id, name) {
  const note = doc.notes.find(item => item.id === id);
  if (!note || noteName(name, note.name) === note.name) return doc;
  return { ...doc, notes: doc.notes.map(item => item === note ? { ...item, name: noteName(name, note.name) } : item) };
}

// The last note can't go. Deleting the shown one shows the next, or the one
// before it at the end of the list.
export function removeNote(doc, id) {
  const index = doc.notes.findIndex(note => note.id === id);
  if (index < 0 || doc.notes.length === 1) return doc;
  const notes = doc.notes.filter(note => note.id !== id);
  const active = doc.active === id ? (notes[index] ?? notes[index - 1]).id : doc.active;
  return { ...doc, active, notes };
}

export function selectNote(doc, id) {
  return doc.active !== id && doc.notes.some(note => note.id === id) ? { ...doc, active: id } : doc;
}

// Unknown ids are ignored: text typed into a note deleted meanwhile is dropped.
export function setNoteText(doc, id, text) {
  const note = doc.notes.find(item => item.id === id);
  if (!note || note.text === text) return doc;
  return { ...doc, notes: doc.notes.map(item => item === note ? { ...item, text } : item) };
}

// Text left in shared state by an earlier version, found next to an existing
// notes file (a downgrade, then an upgrade). `kept` says the text is in the
// notes now, so shared state may forget it; with no room it stays there.
export function adoptLegacy(doc, legacy) {
  if (typeof legacy !== "string" || legacy === "" || doc.notes.some(note => note.text === legacy)) return { doc, kept: true };
  if (doc.notes.length >= MAX_NOTES) return { doc, kept: false };
  const name = doc.notes.some(note => note.name === "Notes") ? nextNoteName(doc.notes) : "Notes";
  const added = addNote(doc, name);
  return { doc: setNoteText({ ...added, active: doc.active }, added.active, legacy), kept: true };
}
