// ── RDAP / WHOIS lookup utilities ─────────────────────────────────────────────
// Uses the rdap.org public proxy — no Node addon required, plain browser fetch.
// All errors are caught and reported to the TimesPast console; callers receive []
// on failure so the profile viewer still renders with its Wikidata rows.

// ── Step 1: resolve the entity's P856 website → bare domain ──────────────────
export async function resolveWebsiteDomain(qid, { con } = {}) {
  const sparql = `SELECT ?website WHERE { wd:${qid} wdt:P856 ?website . } LIMIT 1`;
  const url    = `https://query.wikidata.org/sparql?query=${encodeURIComponent(sparql)}&format=json`;
  try {
    const resp = await fetch(url, { headers: { Accept: 'application/sparql-results+json' } });
    if (!resp.ok) {
      con?.warn(`[rdap] Wikidata P856 lookup failed (${resp.status}) for ${qid}`);
      return null;
    }
    const data    = await resp.json();
    const binding = data.results.bindings[0];
    if (!binding?.website?.value) {
      con?.log(`[rdap] no P856 website on record for ${qid}`);
      return null;
    }
    const domain = new URL(binding.website.value).hostname.replace(/^www\./, '');
    con?.log(`[rdap] resolved domain for ${qid}: ${domain}`);
    return domain;
  } catch (err) {
    con?.warn(`[rdap] could not resolve website domain for ${qid}: ${err.message}`);
    return null;
  }
}

// ── Step 2: fetch RDAP data for a domain → ProfileViewer-compatible rows ──────
export async function fetchRdapForDomain(domain, { con } = {}) {
  con?.log(`[rdap] fetching RDAP record for ${domain}…`);
  try {
    const resp = await fetch(`https://rdap.org/domain/${domain}`, {
      headers: { Accept: 'application/rdap+json' },
    });
    if (!resp.ok) {
      con?.warn(`[rdap] RDAP lookup returned ${resp.status} for ${domain}`);
      return [];
    }
    const data = await resp.json();
    const rows = [];

    // Helper: build a ProfileViewer property row
    const makeRow = (id, label, displayValue) => ({
      id,
      label,
      type: 'string',
      values: [{ display: displayValue, raw: displayValue }],
    });

    // Domain name as confirmed by registrar
    if (data.ldhName) {
      rows.push(makeRow('rdap_domain', 'Domain', data.ldhName.toLowerCase()));
    }

    // Registration, expiry and last-updated dates from the events array
    const formatDate = (isoStr) => {
      if (!isoStr) return isoStr;
      return isoStr.slice(0, 10); // keep YYYY-MM-DD, drop time
    };
    for (const event of data.events || []) {
      if (event.eventAction === 'registration') {
        rows.push(makeRow('rdap_registered', 'Domain Registered', formatDate(event.eventDate)));
      }
      if (event.eventAction === 'expiration') {
        rows.push(makeRow('rdap_expires',    'Domain Expires',    formatDate(event.eventDate)));
      }
      if (event.eventAction === 'last changed') {
        rows.push(makeRow('rdap_updated',    'Domain Updated',    formatDate(event.eventDate)));
      }
    }

    // Registrant and registrar from the entities array
    for (const entity of data.entities || []) {
      const vcard  = entity.vcardArray?.[1] || [];
      const isRole = (role) => entity.roles?.includes(role);

      if (isRole('registrant')) {
        for (const field of vcard) {
          if (field[0] === 'fn'  && field[3]) rows.push(makeRow('rdap_registrant', 'Registrant',         field[3]));
          if (field[0] === 'org' && field[3]) rows.push(makeRow('rdap_org',        'Registrant Org',     field[3]));
          if (field[0] === 'adr') {
            // vCard adr: ["", extended, street, city, region, postal, country]
            const parts = Array.isArray(field[3]) ? field[3] : [];
            const country = parts[6];
            if (country) rows.push(makeRow('rdap_country', 'Registrant Country', country));
          }
        }
      }

      if (isRole('registrar')) {
        for (const field of vcard) {
          if (field[0] === 'fn' && field[3]) rows.push(makeRow('rdap_registrar', 'Registrar', field[3]));
        }
      }
    }

    // Nameservers
    const nameservers = (data.nameservers || [])
      .map(ns => ns.ldhName?.toLowerCase())
      .filter(Boolean);
    if (nameservers.length) {
      rows.push(makeRow('rdap_ns', 'Nameservers', nameservers.join(', ')));
    }

    con?.log(`[rdap] got ${rows.length} row(s) for ${domain}`);
    return rows;

  } catch (err) {
    con?.warn(`[rdap] fetch failed for ${domain}: ${err.message}`);
    return [];
  }
}
