import { resolveTextToEntities } from '@/lib/wikidataUtils';

const FLAG_LABELS = {
  '-p':  'people',
  '-o':  'organisations',
  '-l':  'living entities',
  '-a':  'artificial agents',
  '-e':  'events',
  '-ph': 'phenomena',
  '-w':  'conflicts',
  '-pl': 'places',
  '-ob': 'objects',
  '-t':  'technology',
  '-wo': 'works',
  '-c':  'concepts',
  '-sc': 'sciences',
  '-wx': 'weather',
};

export default {
  name:        'search',
  aliases:     ['s'],
  description: 'Search Wikidata by category flag',
  usage:       'search <flag> <term>  e.g. search -p napoleon  or  search -e "battle of hastings"',

  async run({ console: con, handlers, rawInput, ask }) {
    const parts = rawInput.trim().split(/\s+/);
    const flag  = parts[1];
    const term  = parts.slice(2).join(' ').replace(/^["']+|["']+$/g, '');

    if (!flag || !FLAG_LABELS[flag]) {
      con.error(`search needs a flag. Options: ${Object.keys(FLAG_LABELS).join('  ')}`);
      return;
    }

    if (!term) {
      con.error(`search ${flag} needs a search term.`);
      return;
    }

    switch (flag) {

      case '-p': {
        con.log(`Searching people for "${term}"…`);
        await handlers.handleSparqlSearch(term);
        break;
      }

      case '-e': {
        con.log(`Resolving "${term}"…`);
        let candidates;
        try {
          candidates = await resolveTextToEntities(term, { limit: 30 });
        } catch (err) {
          con.error(`Wikidata lookup failed: ${err.message}`);
          break;
        }

        if (!candidates || candidates.length === 0) {
          con.warn(`No results found for "${term}"`);
          break;
        }

        // Single result — skip disambiguation
        if (candidates.length === 1) {
          con.log(`Found: ${candidates[0].label} (${candidates[0].qid}) — fetching events…`);
          await handlers.handleEventSearch(candidates[0].qid, candidates[0].label);
          break;
        }

        // Multiple results — print list
        con.log(`${candidates.length} matches for "${term}":`);
        candidates.forEach((c, i) => {
          const desc = c.description ? `  —  ${c.description}` : '';
          con.log(`  ${i + 1}.  ${c.label}${desc}  (${c.qid})`);
        });

        // Interactive path (keyboard) — ask inline
        if (ask) {
          const answer = await ask(`Pick 1–${candidates.length}:`);
          const n = parseInt(answer, 10);
          if (isNaN(n) || n < 1 || n > candidates.length) {
            con.error(`"${answer}" is not a valid choice — enter a number between 1 and ${candidates.length}`);
            break;
          }
          const chosen = candidates[n - 1];
          con.log(`Selected: ${chosen.label} — fetching events…`);
          await handlers.handleEventSearch(chosen.qid, chosen.label);

        } else {
          // Automated path (URL params / WebSocket) — auto-select first
          con.log(`Auto-selecting: ${candidates[0].label}`);
          await handlers.handleEventSearch(candidates[0].qid, candidates[0].label);
        }
        break;
      }

            case '-o': {
        con.log(`Resolving "${term}"…`);
        let orgCandidates;
        try {
          orgCandidates = await resolveTextToEntities(term, { limit: 30 });
        } catch (err) {
          con.error(`Wikidata lookup failed: ${err.message}`);
          break;
        }

        if (!orgCandidates || orgCandidates.length === 0) {
          con.warn(`No results found for "${term}"`);
          break;
        }

        if (orgCandidates.length === 1) {
          con.log(`Found: ${orgCandidates[0].label} (${orgCandidates[0].qid}) — plotting…`);
          await handlers.handleOrgSearch(orgCandidates[0].qid, orgCandidates[0].label);
          break;
        }

        con.log(`${orgCandidates.length} matches for "${term}":`);
        orgCandidates.forEach((c, i) => {
          const desc = c.description ? `  —  ${c.description}` : '';
          con.log(`  ${i + 1}.  ${c.label}${desc}  (${c.qid})`);
        });

        if (ask) {
          const answer = await ask(`Pick 1–${orgCandidates.length}:`);
          const n = parseInt(answer, 10);
          if (isNaN(n) || n < 1 || n > orgCandidates.length) {
            con.error(`"${answer}" is not a valid choice — enter a number between 1 and ${orgCandidates.length}`);
            break;
          }
          const chosen = orgCandidates[n - 1];
          con.log(`Selected: ${chosen.label} — plotting…`);
          await handlers.handleOrgSearch(chosen.qid, chosen.label);
        } else {
          con.log(`Auto-selecting: ${orgCandidates[0].label}`);
          await handlers.handleOrgSearch(orgCandidates[0].qid, orgCandidates[0].label);
        }
        break;
      }

      default: {
        con.warn(
          `"${FLAG_LABELS[flag]}" search (${flag}) is coming soon. ` +
          `Active flags: -p (people)  -e (events)  -o (organisations)`
        );
      }
    }
  },
};
