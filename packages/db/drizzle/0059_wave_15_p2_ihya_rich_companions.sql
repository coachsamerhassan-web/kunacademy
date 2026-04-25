-- Wave 15 Phase 2 Session 2 — Ihya rich-text companion fields
-- Date: 2026-04-25
-- Spec: Specs/wave-15-phase-2-spec.md v2 §6.2.4
-- Hakima approved: 2026-04-25 (D4 review gate, scope C1)
--
-- Scope:
--   - 6 Ihya programs (ihya-body, ihya-connection, ihya-grand-journey,
--     ihya-impact, ihya-innovation, ihya-reviving-the-self)
--   - 24 cells = 6 programs × 2 langs × 2 fields (pull_quote, opening_invitation)
--   - Add `*_rich` JSONB keys INSIDE existing `long_description_{ar,en}` JSONB
--   - List arrays (who_for, benefits, who_not_for, impressions) UNTOUCHED
--   - Pre-migration full backup of current `long_description_{ar,en}` for the
--     6 Ihya programs into `programs_long_description_backup_20260425` (per
--     Hakima Concern 2 — full JSONB snapshot, not just the new keys)
--   - Backup TTL: 30 days (drop scheduled 2026-05-25 — see DEPENDENCY-MAP)
--
-- Rollback strategy:
--   UPDATE programs p SET
--     long_description_ar = b.long_description_ar,
--     long_description_en = b.long_description_en
--   FROM programs_long_description_backup_20260425 b
--   WHERE p.id = b.program_id;
--
-- Renderer reads `*_rich` first via `hasRichContent(doc)` guard (Hakima
-- Concern 3); falls back to scalar string. See packages/ui/src/rich-editor/
-- rich-content.tsx + apps/web/src/app/[locale]/programs/[slug]/page.tsx.

BEGIN;

-- ── Concern 2 (Hakima) — backup table holds the FULL pre-migration JSONB
-- for both langs. NOT just the two new keys. 30-day TTL.
CREATE TABLE IF NOT EXISTS programs_long_description_backup_20260425 (
  program_id          UUID         NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  slug                TEXT         NOT NULL,
  long_description_ar JSONB,
  long_description_en JSONB,
  snapshot_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
  PRIMARY KEY (program_id)
);

INSERT INTO programs_long_description_backup_20260425
  (program_id, slug, long_description_ar, long_description_en)
SELECT id, slug, long_description_ar, long_description_en
FROM programs
WHERE slug LIKE 'ihya-%'
ON CONFLICT (program_id) DO NOTHING;

-- ── 24 UPDATE statements (auto-generated; verified TipTap JSON from dry-run
-- artifact reviewed by Hakima 2026-04-25 — see Workspace/CTO/output/
-- 2026-04-25-ihya-rich-migration-diff.md)

UPDATE programs SET long_description_ar = jsonb_set(long_description_ar, '{pull_quote_rich}', '{"type":"doc","content":[{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"جسدك ليس عقبةً في طريقك — هو الطريق."}]}]}'::jsonb) WHERE slug = 'ihya-body';
UPDATE programs SET long_description_ar = jsonb_set(long_description_ar, '{opening_invitation_rich}', '{"type":"doc","content":[{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"يأتيك جسدُك بالإشارات كلَّ يوم — تعبٌ لا يَنام، شدٌّ في الكتفين، نَفَسٌ ضيّق، نومٌ لا يُريح. وأنت تُديرها، لا تُصغي إليها. في هذه الأيّام الأربعة في الطبيعة، ندعوك أن تُبطئ كفاية كي يتكلّم جسدك — ثمّ تتعلَّم كيف تسمعه من غير أن تخاف ممّا يقول. هذه ليست رحلةَ رفاهية، بل عودةٌ إلى الأداة الوحيدة التي لا تَخونك: جسدك نفسه."}]}]}'::jsonb) WHERE slug = 'ihya-body';
UPDATE programs SET long_description_en = jsonb_set(long_description_en, '{pull_quote_rich}', '{"type":"doc","content":[{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Your body is not an obstacle on your path — it is the path."}]}]}'::jsonb) WHERE slug = 'ihya-body';
UPDATE programs SET long_description_en = jsonb_set(long_description_en, '{opening_invitation_rich}', '{"type":"doc","content":[{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Your body sends signals every day — tiredness that doesn''t sleep, tight shoulders, shallow breath, rest that doesn''t restore. And you manage them instead of listening to them. In these four days in nature, we invite you to slow down enough for your body to speak — and to learn how to hear it without fearing what it says. This is not a wellness escape. It is a return to the one instrument that does not betray you: your own body."}]}]}'::jsonb) WHERE slug = 'ihya-body';
UPDATE programs SET long_description_ar = jsonb_set(long_description_ar, '{pull_quote_rich}', '{"type":"doc","content":[{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"لا تطلبْ من علاقاتك ما لم تُعطِه لنفسك أوّلاً."}]}]}'::jsonb) WHERE slug = 'ihya-connection';
UPDATE programs SET long_description_ar = jsonb_set(long_description_ar, '{opening_invitation_rich}', '{"type":"doc","content":[{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"تُحيطك علاقاتٌ كثيرة، ومع ذلك تشعر أحياناً بأنَّك وحيد. تُحادث الناس كلَّ يوم، ومع ذلك لم تَرَ بينهم مَن رآك. الفجوةُ ليست في عدد الناس حولك — هي في نوع حضورك معهم، ونوعِ حضورهم معك. في هذه الأيّام الثلاثة، ندعوك لتتعلَّم أن تتَّصل من وعيٍ لا من حاجة — أي أن تصل إلى الآخر وأنت كامل، لا وأنت ناقص تَطلب منه أن يُكمِلَك. علاقاتُك ليست مكسورة كما تظنّ. أنت فقط لم تحضرْ فيها بعد."}]}]}'::jsonb) WHERE slug = 'ihya-connection';
UPDATE programs SET long_description_en = jsonb_set(long_description_en, '{pull_quote_rich}', '{"type":"doc","content":[{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Do not ask of your relationships what you have not first given to yourself."}]}]}'::jsonb) WHERE slug = 'ihya-connection';
UPDATE programs SET long_description_en = jsonb_set(long_description_en, '{opening_invitation_rich}', '{"type":"doc","content":[{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Many relationships surround you, and still, sometimes, you feel alone. You speak to people every day, and still, among them, no one has seen you. The gap is not in the number of people around you — it is in the kind of presence you bring, and the kind they bring. In these three days, we invite you to learn to connect from awareness, not from need — to arrive at the other as whole, not as incomplete and asking them to complete you. Your relationships are not as broken as you think. You just haven''t been present in them yet."}]}]}'::jsonb) WHERE slug = 'ihya-connection';
UPDATE programs SET long_description_ar = jsonb_set(long_description_ar, '{pull_quote_rich}', '{"type":"doc","content":[{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"لا تذهبُ إلى الطبيعة لتَهرب من حياتك — تذهبُ إليها لتتذكَّرَ أنَّك جزءٌ منها."}]}]}'::jsonb) WHERE slug = 'ihya-grand-journey';
UPDATE programs SET long_description_ar = jsonb_set(long_description_ar, '{opening_invitation_rich}', '{"type":"doc","content":[{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"في الحياة العاديّة، تعيش أجزاءَك في غُرفٍ منفصلة. جسدك في غرفة، وعملك في غرفة، وعلاقاتك في غرفة، وداخلك في غرفةٍ قلَّما تدخلها. في الرحلة الكبرى، تجتمع هذه الغرف كلُّها في مكانٍ واحدٍ ولمرّةٍ واحدة. سبعةُ أيّام في الطبيعة تسمح لكلِّ جزءٍ منك أن يحضر مع الأجزاء الأخرى — ويكتشف أنَّه لم يكن، أصلاً، منفصلاً عنها. هذه ليست رحلةً للهروب من حياتك، بل رحلةٌ تعود منها إليها كاملاً."}]}]}'::jsonb) WHERE slug = 'ihya-grand-journey';
UPDATE programs SET long_description_en = jsonb_set(long_description_en, '{pull_quote_rich}', '{"type":"doc","content":[{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"You do not go to nature to escape your life — you go to remember that you are part of it."}]}]}'::jsonb) WHERE slug = 'ihya-grand-journey';
UPDATE programs SET long_description_en = jsonb_set(long_description_en, '{opening_invitation_rich}', '{"type":"doc","content":[{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"In ordinary life, you live your parts in separate rooms. Your body in one room, your work in another, your relationships in a third, and your interior in a room you rarely enter. In the Grand Journey, all these rooms come together in one place, once. Seven days in nature let every part of you appear alongside the others — and discover that it was never, in truth, separate from them. This is not a journey to escape from your life. It is a journey you return from, to your life, whole."}]}]}'::jsonb) WHERE slug = 'ihya-grand-journey';
UPDATE programs SET long_description_ar = jsonb_set(long_description_ar, '{pull_quote_rich}', '{"type":"doc","content":[{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"الأثرُ الحقيقيّ لا يُقاس بحجم ما تُنتج — بل بمقدار ما يبقى منك فيه."}]}]}'::jsonb) WHERE slug = 'ihya-impact';
UPDATE programs SET long_description_ar = jsonb_set(long_description_ar, '{opening_invitation_rich}', '{"type":"doc","content":[{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"بنيتَ شيئاً. عملتَ عليه سنوات. ومع ذلك، في لحظاتِ الصراحة مع نفسك، تشعر أنَّ عملك لم يَعُد يُشبهك. الجهدُ كبير والأثرُ لا يُوازيه. المُنجَزُ يتراكم ونيّتُك الأولى ضاعت في الزحام. في هذه الأيّام الثلاثة، ندعوك لتُعيد وصلَ العمل بنيّته، والجهد بأثره، والأداء بمعناه الذي بدأتَ به. لن نُعلِّمك كيف تعمل أكثر — سنساعدك أن تعمل ما يُشبهك."}]}]}'::jsonb) WHERE slug = 'ihya-impact';
UPDATE programs SET long_description_en = jsonb_set(long_description_en, '{pull_quote_rich}', '{"type":"doc","content":[{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Real impact is not measured by how much you produce — but by how much of you remains in it."}]}]}'::jsonb) WHERE slug = 'ihya-impact';
UPDATE programs SET long_description_en = jsonb_set(long_description_en, '{opening_invitation_rich}', '{"type":"doc","content":[{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"You built something. You worked on it for years. And yet, in moments of honesty with yourself, you feel that your work no longer looks like you. The effort is large, and the impact does not match it. Accomplishments stack up, and your original intention was lost in the crowd. In these three days, we invite you to reconnect work with its intention, effort with its impact, performance with the meaning it started from. We will not teach you how to work more. We will help you work in a way that looks like you."}]}]}'::jsonb) WHERE slug = 'ihya-impact';
UPDATE programs SET long_description_ar = jsonb_set(long_description_ar, '{pull_quote_rich}', '{"type":"doc","content":[{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"الفكرةُ لا تَخاف منك — أنت مَن يَخاف منها."}]}]}'::jsonb) WHERE slug = 'ihya-innovation';
UPDATE programs SET long_description_ar = jsonb_set(long_description_ar, '{opening_invitation_rich}', '{"type":"doc","content":[{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"تعرف أنَّ في داخلك فكرةً، أو مشروعاً، أو طريقةً جديدةً في العمل — ومع ذلك لا تخرج. ليس لأنّك كسول، ولا لأنّك غيرُ قادر. بل لأنَّ الخوفَ أسرع منها. خوفٌ من الخطأ، من أن لا يَفهمَك الناس، من أن لا تعرف بعدُ من أنت. في هذه الأيّام الثلاثة، ندعوك أن تتركَ الخوفَ قليلاً — لتسمحَ للفكرة أن تأتي. لا نُعلِّمك كيف تُصبح مُبدعاً، لأنّك مُبدعٌ أصلاً — نساعدك أن تُزيل ما يمنعُك من الإصغاء إلى إبداعك."}]}]}'::jsonb) WHERE slug = 'ihya-innovation';
UPDATE programs SET long_description_en = jsonb_set(long_description_en, '{pull_quote_rich}', '{"type":"doc","content":[{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"The idea does not fear you — you are the one who fears it."}]}]}'::jsonb) WHERE slug = 'ihya-innovation';
UPDATE programs SET long_description_en = jsonb_set(long_description_en, '{opening_invitation_rich}', '{"type":"doc","content":[{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"You know there is an idea inside you — or a project, or a new way of working — and still it does not come out. Not because you are lazy, not because you cannot. Because fear moves faster than it does. Fear of being wrong, of not being understood, of not yet knowing who you are. In these three days, we invite you to leave fear a little — so the idea can come. We will not teach you how to become creative, because you already are. We help you clear what prevents you from listening to your own creativity."}]}]}'::jsonb) WHERE slug = 'ihya-innovation';
UPDATE programs SET long_description_ar = jsonb_set(long_description_ar, '{pull_quote_rich}', '{"type":"doc","content":[{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"النَّفسُ لا تُصلَح بالإضافة — تُصلَح بالتصفية."}]}]}'::jsonb) WHERE slug = 'ihya-reviving-the-self';
UPDATE programs SET long_description_ar = jsonb_set(long_description_ar, '{opening_invitation_rich}', '{"type":"doc","content":[{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"قد تكون ناجحاً بكلِّ مقاييس الخارج، ومع ذلك هناك ضجيجٌ داخليّ لا يَسكُن. عاداتٌ صغيرة تستنزفُك من غير أن تنتبه، أفكارٌ تدور في الرأس كلَّ ليلة قبل النوم، إحساسٌ بأنّ يومَك لم يَعُد يُشبهك. في هذه الأيّام ندعوك أن ترجع إلى نفسك قبل أن تُرهقَك عاداتُك أكثر — لا لتُصبح شخصاً آخر، بل لتُميِّز أيّ شيء فيك أصيل، وأيّ شيء فيك عادةٌ تُكرِّرها بلا حاجة. هذا ليس انسحاباً من الحياة — هو ترتيبُ الداخل قبل العودة إليها. نعمل على هذا بمنهجيّة التفكير الحسّي® — طريقنا في أن يُصغي المشاركُ إلى نفسه من الجسد، لا من الرأس وحده."}]}]}'::jsonb) WHERE slug = 'ihya-reviving-the-self';
UPDATE programs SET long_description_en = jsonb_set(long_description_en, '{pull_quote_rich}', '{"type":"doc","content":[{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"The self is not repaired by adding — it is repaired by clearing."}]}]}'::jsonb) WHERE slug = 'ihya-reviving-the-self';
UPDATE programs SET long_description_en = jsonb_set(long_description_en, '{opening_invitation_rich}', '{"type":"doc","content":[{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"You may be successful by every outside measure, and yet there is an inner noise that does not settle. Small habits quietly drain you without your noticing. Thoughts circle in the head each night before sleep. A sense that your day no longer looks like you. In these days we invite you to come back to yourself — before your habits cost you more — not to become someone else, but to tell apart what in you is authentic from what is habit repeating itself without need. This is not a withdrawal from life. It is a reordering of the inside before returning to it. We work through the Somatic Thinking® method — our way of helping the participant listen to the self from the body, not from the head alone."}]}]}'::jsonb) WHERE slug = 'ihya-reviving-the-self';

-- Total UPDATE statements: 24

COMMIT;

-- Post-apply verification (operator runs manually):
--
-- SELECT slug,
--        long_description_ar ? 'pull_quote_rich'         AS ar_pq,
--        long_description_ar ? 'opening_invitation_rich' AS ar_oi,
--        long_description_en ? 'pull_quote_rich'         AS en_pq,
--        long_description_en ? 'opening_invitation_rich' AS en_oi
-- FROM programs WHERE slug LIKE 'ihya-%' ORDER BY slug;
--   Expected: 6 rows × 4 trues
--
-- SELECT count(*) AS backup_rows FROM programs_long_description_backup_20260425;
--   Expected: 6
