-- Canon Phase 2 Wave 3-B — placeholder program logos for Wisal + Seeds variants.
-- Per Samer D8=(a): real logos will be shared later; Sani swaps via /admin/programs/ CRUD.
-- Placeholders live at /images/programs/logos/placeholders/<slug>.svg (served from apps/web/public).
-- Idempotent: each UPDATE scopes to the program slug + only sets logo when currently NULL or still pointing at the placeholder path.
-- Rollback: UPDATE programs SET program_logo = NULL WHERE slug IN (...) AND program_logo LIKE '/images/programs/logos/placeholders/%';

BEGIN;

UPDATE programs
   SET program_logo = '/images/programs/logos/placeholders/wisal.svg'
 WHERE slug = 'wisal'
   AND (program_logo IS NULL OR program_logo LIKE '/images/programs/logos/placeholders/%');

UPDATE programs
   SET program_logo = '/images/programs/logos/placeholders/seeds-youth.svg'
 WHERE slug = 'seeds-youth'
   AND (program_logo IS NULL OR program_logo LIKE '/images/programs/logos/placeholders/%');

UPDATE programs
   SET program_logo = '/images/programs/logos/placeholders/seeds-parents.svg'
 WHERE slug = 'seeds-parents'
   AND (program_logo IS NULL OR program_logo LIKE '/images/programs/logos/placeholders/%');

UPDATE programs
   SET program_logo = '/images/programs/logos/placeholders/seeds-caregivers.svg'
 WHERE slug = 'seeds-caregivers'
   AND (program_logo IS NULL OR program_logo LIKE '/images/programs/logos/placeholders/%');

COMMIT;
