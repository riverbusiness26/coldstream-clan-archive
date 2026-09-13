import { people, rosterEntries } from './data';

// Only evidence explicitly tied to Coldstream belongs on this page. Keep the
// full recovered catalogue unchanged for the separate historical roster.
export const coldstreamEntries = rosterEntries.filter((entry) =>
  /coldstream|21stPA|regiment forum thread/i.test(entry.source_detail));
export const coldstreamPeople = people.flatMap((person) => {
  const entries = coldstreamEntries.filter((entry) => entry.person_key === person.key);
  return entries.length ? [{ ...person, games: [...new Set(entries.map((entry) => entry.game))], entries: entries.length }] : [];
});
