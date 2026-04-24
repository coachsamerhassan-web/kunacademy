-- 0051_canon_w4_ihya_long_form.sql
-- Canon W4 — Ihya long-form landing-page content migration.
--
-- Source of truth: /Users/samer/Claude Code/Project Memory/KUN-Features/IHYA-LANDING-PAGES.md §7.1-§7.6
-- Scope: 6 Ihya slugs (ihya-body, ihya-reviving-the-self, ihya-impact,
--        ihya-innovation, ihya-connection, ihya-grand-journey).
--
-- Changes:
--   1. Extend `programs` with `long_description_ar jsonb` + `long_description_en jsonb`.
--      Structured per-section so the template can render with distinct styling per section.
--      Shape: {
--        "opening_invitation": "...",       -- Section 2 of composition
--        "who_for": ["...", "...", ...],   -- Section 3a bullets
--        "who_not_for": ["...", ...],       -- Section 3b bullets
--        "benefits": ["...", ...],          -- Section 4 bullets (5-6 items)
--        "impressions": ["...", ...],       -- Section 5 paragraphs (3-5 sentences each, authored as 3 paragraphs)
--        "pull_quote": "...",               -- Samer pull-quote
--        "closing_invitation": "..."        -- Final section (optional — only present on dated variants)
--      }
--      NULL = no long-form content; template falls back to short description_ar/en as today.
--
--   2. Populate all 6 Ihya variants with Hakima's authored copy from IHYA-LANDING-PAGES.md §7.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS + UPDATE by slug. Safe to re-run.

-- ── Schema extension ────────────────────────────────────────────────────────
ALTER TABLE programs
  ADD COLUMN IF NOT EXISTS long_description_ar jsonb,
  ADD COLUMN IF NOT EXISTS long_description_en jsonb;

COMMENT ON COLUMN programs.long_description_ar IS
  'Structured long-form landing-page content (AR). Sections: opening_invitation, who_for[], who_not_for[], benefits[], impressions[], pull_quote, closing_invitation?. NULL = use description_ar fallback.';
COMMENT ON COLUMN programs.long_description_en IS
  'Structured long-form landing-page content (EN). Same shape as long_description_ar. NULL = use description_en fallback.';

-- ── Seed: Ihya Body / إحياء الجسد (§7.1) ───────────────────────────────────
UPDATE programs SET
  long_description_ar = $$
  {
    "opening_invitation": "يأتيك جسدُك بالإشارات كلَّ يوم — تعبٌ لا يَنام، شدٌّ في الكتفين، نَفَسٌ ضيّق، نومٌ لا يُريح. وأنت تُديرها، لا تُصغي إليها. في هذه الأيّام الأربعة في الطبيعة، ندعوك أن تُبطئ كفاية كي يتكلّم جسدك — ثمّ تتعلَّم كيف تسمعه من غير أن تخاف ممّا يقول. هذه ليست رحلةَ رفاهية، بل عودةٌ إلى الأداة الوحيدة التي لا تَخونك: جسدك نفسه.",
    "who_for": [
      "مَن يشعر بأنّ جسده يتكلَّم بلغةٍ لم يَعُد يفهمها",
      "مَن جرَّب الرياضة والتمارين ولكنّ الإرهاق لم يذهب",
      "مَن يُدير ألماً أو توتّراً مزمناً يعرف أنّه ليس عضويّاً وحسب",
      "مَن يريد أن يتعلَّم فارقاً جوهريّاً بين السيطرة على الجسد والإصغاء إليه",
      "مَن يشعر أنّه مُنفصل عن إحساسه الداخليّ، وإن كان ناجحاً من الخارج"
    ],
    "who_not_for": [
      "مَن يبحث عن برنامجٍ علاجيّ طبّي أو نفسيّ — إحياء الجسد مكمّلٌ للعلاج، لا بديلٌ عنه",
      "مَن يريد خطّةً لياقيّةً أو حِمية مُبرمَجة — الرحلة لا تُقدِّم ذلك",
      "مَن لا يَسَعه الابتعاد أربعة أيّام عن عمله وهاتفه بقلبٍ حاضر"
    ],
    "benefits": [
      "قدرة جديدة على قراءة إشارات جسدك قبل أن تتحوَّل إلى أعراض",
      "راحةٌ عميقة في النَّفَس والكتفين لم تشعر بها منذ زمن",
      "علاقةٌ مختلفة مع التعب — لا كعدوٍّ بل كرسالة",
      "وضوحٌ في التمييز بين الإرهاق الذي يحتاج راحة والإرهاق الذي يحتاج قراراً",
      "ممارسةٌ يوميّة بسيطة تأخذها معك — تعود إليها في المدينة كما في السفر",
      "شعورٌ بأنّك عُدتَ إلى بيتك الأصليّ، وأنّ هذا البيت هو جسدك"
    ],
    "impressions": [
      "تبدأ الأيّام على إيقاع الأرض، لا على إيقاع التقويم. ضوءٌ يملأ الغرفة ببطء، نَفَسٌ قبل الكلام، قهوةٌ تُشرَب بلا عجلة. تتحرَّك المجموعة برفقٍ من غير أن يُقال لها كيف تتحرَّك، وتَسكُن معاً قبل أن يُطلب منها أن تتكلَّم.",
      "في مثل هذه الرحلات، تسمع جسدَك وهو يُفرِج عن ما كان يحمله بصمت. الأرض نفسها تُعلِّم شيئاً لا يُعلَّم في قاعة — الجبلُ لا يستعجل، والنهرُ لا يعتذر. وأنت بينهما تتذكَّر أنَّك، أصلاً، جزءٌ من هذا الإيقاع.",
      "تنتهي الأيّام الأربعة والمجموعة أهدأ ممّا وصلت، وأنت أقلَّ ثقلاً، وجسدُك — لأوّل مرّة منذ وقت طويل — يُحسّ به صاحبه."
    ],
    "pull_quote": "جسدك ليس عقبةً في طريقك — هو الطريق."
  }
  $$::jsonb,
  long_description_en = $$
  {
    "opening_invitation": "Your body sends signals every day — tiredness that doesn't sleep, tight shoulders, shallow breath, rest that doesn't restore. And you manage them instead of listening to them. In these four days in nature, we invite you to slow down enough for your body to speak — and to learn how to hear it without fearing what it says. This is not a wellness escape. It is a return to the one instrument that does not betray you: your own body.",
    "who_for": [
      "People whose body has been speaking in a language they no longer understand",
      "People who have tried exercise and gym routines, yet the fatigue hasn't lifted",
      "People carrying chronic tension or pain they know is not purely physical",
      "People who want to learn the difference between controlling the body and listening to it",
      "People who feel disconnected from their inner sense, even when the outside looks successful"
    ],
    "who_not_for": [
      "Anyone seeking medical or psychological treatment — Ihya Body complements therapy, it does not replace it",
      "Anyone looking for a fitness plan or structured diet — the retreat does not offer those",
      "Anyone who cannot step away from work and phone for four days with a fully present heart"
    ],
    "benefits": [
      "A new capacity to read your body's signals before they become symptoms",
      "A depth of rest in breath and shoulders you haven't felt in a long time",
      "A different relationship with fatigue — not as an enemy but as a message",
      "Clarity in telling the difference between tiredness that needs rest and tiredness that needs a decision",
      "One simple daily practice you take with you — returning to it in the city as in travel",
      "A sense of having come home to your original house, and that house is your body"
    ],
    "impressions": [
      "The days begin on the rhythm of the land, not on the rhythm of a calendar. Light fills the room slowly; breath comes before speech; coffee is sipped without hurry. The group moves gently without being told how to move, and it becomes still together before anyone is asked to speak.",
      "In retreats like this, you hear your body releasing what it had been quietly carrying. The land itself teaches what cannot be taught in a classroom — the mountain does not rush, the river does not apologize. And you, between them, remember that you were always part of this rhythm.",
      "Four days end and the group is quieter than when it arrived, and you are lighter, and your body — for the first time in a long while — is being felt by the one who lives in it."
    ],
    "pull_quote": "Your body is not an obstacle on your path — it is the path."
  }
  $$::jsonb,
  updated_at = now()
WHERE slug = 'ihya-body';

-- ── Seed: Ihya Reviving the Self / إحياء النفس (§7.2) ─────────────────────
UPDATE programs SET
  long_description_ar = $$
  {
    "opening_invitation": "قد تكون ناجحاً بكلِّ مقاييس الخارج، ومع ذلك هناك ضجيجٌ داخليّ لا يَسكُن. عاداتٌ صغيرة تستنزفُك من غير أن تنتبه، أفكارٌ تدور في الرأس كلَّ ليلة قبل النوم، إحساسٌ بأنّ يومَك لم يَعُد يُشبهك. في هذه الأيّام ندعوك أن ترجع إلى نفسك قبل أن تُرهقَك عاداتُك أكثر — لا لتُصبح شخصاً آخر، بل لتُميِّز أيّ شيء فيك أصيل، وأيّ شيء فيك عادةٌ تُكرِّرها بلا حاجة. هذا ليس انسحاباً من الحياة — هو ترتيبُ الداخل قبل العودة إليها. نعمل على هذا بمنهجيّة التفكير الحسّي® — طريقنا في أن يُصغي المشاركُ إلى نفسه من الجسد، لا من الرأس وحده.",
    "who_for": [
      "مَن يشعر بأنّ ضجيجَ الداخل أعلى من ضجيج الخارج",
      "مَن وصل إلى سنٍّ أو مرحلةٍ لم تَعُد فيها النجاحاتُ المعتادة تكفي",
      "مَن يُلاحظ تكرار أنماطٍ متعبة (قلقٌ لا سبب له، غضبٌ سريع، إفراطٌ في العمل) ولم يَعُد يريد إدارتها، بل فهمها",
      "مَن يبحث عن مساحةٍ تأمّلية بلغةٍ عربيّة وحسّاسيّةٍ ثقافيّة — لا استيرادًا حرفيّاً من الغرب",
      "مَن يريد أن يُصفّي عاداتٍ، لا أن يُضيف أُخرى"
    ],
    "who_not_for": [
      "مَن يعيش أزمةً نفسيّة حادّة — الرحلة ليست بديلاً عن العلاج النفسيّ",
      "مَن يتوقَّع «حلاّ» جاهزاً في أربعة أيّام — العمل يبدأ هنا ولا ينتهي هنا",
      "مَن يريد صمتاً كاملاً طوال الوقت — الرحلة تتنفّس بين الصمت والحوار"
    ],
    "benefits": [
      "تمييزٌ أوضح بين صوتك الأصيل وبين أصواتٍ تلبَّسَتك من حيث لا تدري",
      "مساحةٌ داخليّة عاد إليها الهدوء، ولو جزئيّاً",
      "معرفةٌ محسوسة بعادةٍ مُرهِقة واحدة على الأقلّ، وكيفيّة التخلّي عنها",
      "ليالٍ يغمضُ فيها النومُ أسرع، وأفكارٌ تدور في الرأس أقلّ",
      "قدرة على الرجوع إلى هذه السَّكينة في وسط المدينة — لا فقط في الجبل",
      "علاقة أنعم مع ذاتك — أقلّ محاسبة، أكثر فهماً"
    ],
    "impressions": [
      "الوصولُ إلى المكان هو أوَّلُ درس. الطريقُ نفسُه يُعلِّمك أنَّك لستَ في عجلة، وأنَّ ما ستعيشه هنا لا يُقاس بالدقائق. في أوَّل ليلة، المجموعةُ هادئة لأنَّها لم تتعرَّف على نفسها بعد؛ وفي الليلة الأخيرة هادئة لأنَّها عرفت.",
      "النهارُ مبنيٌّ على إيقاعٍ يحترم الجسد والوقت معاً: صباحٌ يبدأ من الداخل، ومساءٌ يُغلَق بصمتٍ قبل الكلمة الأخيرة. بين هذين الطرفين، حواراتٌ عميقة مع النَّفس وحوارات مع المجموعة، ومواقفُ يكتشف فيها المشاركُ ما كان يحمله من غير أن يعرف.",
      "لا نَعِدُك بتحوّلٍ سحريّ — نَعِدُك بأنَّك، حين تعود، سترى يومَك العاديَّ بعينٍ جديدة. وهذا، في حدِّ ذاته، يكفي ليُغيِّر يومَك العاديّ."
    ],
    "pull_quote": "النَّفسُ لا تُصلَح بالإضافة — تُصلَح بالتصفية.",
    "closing_invitation": "السَّكينةُ ليست مكاناً تذهب إليه — هي شيءٌ يُستعاد. هذه الأيّامُ ثلاثٌ أو أربعٌ من ثلاثمئة وخمسة وستّين، لكنّها التي تُغيِّر كيف تعيش الباقي. تعالَ إلى نفسك قبل أن تُرهقَك عاداتُك أكثر — ثمّ ارجعْ إلى حياتك، وأنتَ تعرف أين تقف منها."
  }
  $$::jsonb,
  long_description_en = $$
  {
    "opening_invitation": "You may be successful by every outside measure, and yet there is an inner noise that does not settle. Small habits quietly drain you without your noticing. Thoughts circle in the head each night before sleep. A sense that your day no longer looks like you. In these days we invite you to come back to yourself — before your habits cost you more — not to become someone else, but to tell apart what in you is authentic from what is habit repeating itself without need. This is not a withdrawal from life. It is a reordering of the inside before returning to it. We work through the Somatic Thinking® method — our way of helping the participant listen to the self from the body, not from the head alone.",
    "who_for": [
      "People for whom the inner noise has become louder than the outer noise",
      "People arriving at an age or stage where the usual accomplishments no longer suffice",
      "People noticing repeating tiring patterns (unnamed anxiety, quick anger, over-working) who no longer want to manage them — they want to understand them",
      "People seeking a contemplative space in Arabic, with cultural sensitivity — not imported wholesale from the West",
      "People who want to clear habits, not add new ones"
    ],
    "who_not_for": [
      "Anyone in acute psychological crisis — the retreat is not a substitute for therapy",
      "Anyone expecting a packaged 'solution' in four days — the work begins here, it does not end here",
      "Anyone seeking complete silence throughout — the retreat breathes between silence and dialogue"
    ],
    "benefits": [
      "Clearer discrimination between your authentic voice and the voices that crept in without your knowing",
      "An inner space where quiet has partly returned",
      "A felt understanding of at least one exhausting habit and how to step out of it",
      "Nights where sleep comes sooner, and fewer thoughts circling the mind",
      "An ability to return to this stillness in the middle of the city — not only on the mountain",
      "A gentler relationship with yourself — less self-auditing, more understanding"
    ],
    "impressions": [
      "Arriving at the place is the first lesson. The road itself teaches you that you are not in a hurry, and that what you'll live here cannot be measured in minutes. On the first night, the group is quiet because it has not yet met itself; on the last night it is quiet because it has.",
      "The day is built on a rhythm that respects the body and time together: a morning that begins from the inside, and an evening that closes in silence before the last word. Between these two edges, deep conversations with the self and with the group, and moments where the participant discovers what they had been carrying without knowing it.",
      "We do not promise you a magical transformation — we promise that, when you return, you will see your ordinary day with a new eye. And that, in itself, is enough to change your ordinary day."
    ],
    "pull_quote": "The self is not repaired by adding — it is repaired by clearing.",
    "closing_invitation": "Stillness is not a place you travel to — it is something that is reclaimed. These are three or four days out of three hundred and sixty-five, and yet they are the ones that change how you live the rest. Come back to yourself before your habits cost you more — then return to your life, knowing where you stand in it."
  }
  $$::jsonb,
  updated_at = now()
WHERE slug = 'ihya-reviving-the-self';

-- ── Seed: Ihya Impact / إحياء الأثر (§7.3) ─────────────────────────────────
UPDATE programs SET
  long_description_ar = $$
  {
    "opening_invitation": "بنيتَ شيئاً. عملتَ عليه سنوات. ومع ذلك، في لحظاتِ الصراحة مع نفسك، تشعر أنَّ عملك لم يَعُد يُشبهك. الجهدُ كبير والأثرُ لا يُوازيه. المُنجَزُ يتراكم ونيّتُك الأولى ضاعت في الزحام. في هذه الأيّام الثلاثة، ندعوك لتُعيد وصلَ العمل بنيّته، والجهد بأثره، والأداء بمعناه الذي بدأتَ به. لن نُعلِّمك كيف تعمل أكثر — سنساعدك أن تعمل ما يُشبهك.",
    "who_for": [
      "مؤسّسون وقادة وصلوا إلى مرحلةٍ فيها العمل يُدير حياتهم بدلاً من العكس",
      "مَن حقَّقوا أهدافهم الخارجيّة، ولم تأتِ معها الراحة التي كانوا يتوقّعونها",
      "موظّفون كبار أو مديرون تنفيذيّون يشعرون أنّ دورهم لم يَعُد يُعبِّر عنهم",
      "زملاؤنا من المدرِّبين المُحترَفين (Coaches) الذين يساعدون الآخرين ويعلمون أنّهم يحتاجون مساحةً لأنفسهم",
      "مَن يريد أن يُراجع عملَه، لا أن يَهرب منه"
    ],
    "who_not_for": [
      "مَن يبحث عن ورشةِ إنتاجيّةٍ أو استراتيجيّةِ عمل — هذا ليس برنامجَ أداءٍ تقليديّ",
      "مَن لا يستطيع ترك هاتف العمل أربعة أيّام — الرحلة تتطلَّب انقطاعاً حقيقيّاً",
      "مَن يتوقَّع أجوبةً جاهزة — الرحلة تُنضِج الأسئلة الصحيحة، لا تُجيب عنها نيابةً عنك"
    ],
    "benefits": [
      "وضوحٌ جديد في النيّة التي يقوم عليها عملك اليوم، لا التي بدأتَ بها فقط",
      "قدرة على التفريق بين الجهد الذي يُؤثِّر وبين الجهد الذي يُنهك",
      "قراراتٌ أهمّ ثلاثة — ممّا سَتُبقي وممّا سَتترك — كُتبت بهدوءٍ لا بضغط",
      "علاقة أنضج مع الإنجاز — أقلّ تعريفاً للذات عبره، وأكثر تمتّعاً به",
      "مساحةُ سكون تعرف كيف ترجع إليها حين يضغط العمل مرّة أخرى",
      "أثرٌ يبدأ داخلك — قبل أن يُرى في الخارج"
    ],
    "impressions": [
      "الطبيعةُ تُعيد تعريف الإنتاجيّة من دون كلمات. في الصباح، الشمس ترتفع من غير اجتماع، والشجرةُ تُثمر من غير مؤشّرات أداء. وأنت بينها تستعيد شيئاً كان فيك: أنّ العمل الأصيل لا يُنهك صاحبه إذا كان في مكانه الصحيح.",
      "المجموعة هنا مختلفة — كلُّ واحدٍ فيها وصل إلى شيء، وكلُّ واحدٍ فيها يشكُّ في شيء. لا يوجد تسابُق، ولا عرضُ إنجازات. يوجد حضورٌ هادئ، وحواراتٌ لا يُملى فيها جوابٌ جاهز.",
      "تنتهي الأيّام الثلاثة وفي جيبك ليس برنامجَ عملٍ جديداً — بل عدسةً جديدة. تنظرُ إلى عملك من خلالها، وتعرف ما الذي ستُبقيه، وما الذي اكتفى من وقتك."
    ],
    "pull_quote": "الأثرُ الحقيقيّ لا يُقاس بحجم ما تُنتج — بل بمقدار ما يبقى منك فيه."
  }
  $$::jsonb,
  long_description_en = $$
  {
    "opening_invitation": "You built something. You worked on it for years. And yet, in moments of honesty with yourself, you feel that your work no longer looks like you. The effort is large, and the impact does not match it. Accomplishments stack up, and your original intention was lost in the crowd. In these three days, we invite you to reconnect work with its intention, effort with its impact, performance with the meaning it started from. We will not teach you how to work more. We will help you work in a way that looks like you.",
    "who_for": [
      "Founders and leaders arriving at a stage where work runs their life instead of the other way round",
      "People who hit their external targets and found that the promised peace did not come with them",
      "Senior professionals and executives who feel their role no longer represents them",
      "Our fellow coaches who hold space for others and know they need space of their own",
      "People who want to review their work — not run from it"
    ],
    "who_not_for": [
      "Anyone looking for a productivity workshop or a business strategy session — this is not a conventional performance program",
      "Anyone who cannot leave the work phone for four days — the retreat requires a real disconnection",
      "Anyone expecting pre-packaged answers — the retreat ripens the right questions, it does not answer them on your behalf"
    ],
    "benefits": [
      "A new clarity about the intention your work rests on today — not only the one you started with",
      "A capacity to tell the difference between effort that creates impact and effort that creates exhaustion",
      "Your three most important decisions — what you will keep, what you will let go — written in calm, not under pressure",
      "A more mature relationship with accomplishment — less self-definition through it, more enjoyment of it",
      "A quiet inner space you know how to return to when work presses again",
      "An impact that begins inside you — before it is seen outside"
    ],
    "impressions": [
      "The natural world redefines productivity without words. In the morning, the sun rises without a meeting, and the tree bears fruit without KPIs. And you, between them, recover something that was always yours: that authentic work does not exhaust its author when it stands in its right place.",
      "The group here is different — each person has reached something, and each person doubts something. There is no competition, no showcase of achievements. There is quiet presence, and conversations where no ready answer is dictated.",
      "The three days end, and in your pocket is not a new work program — but a new lens. You look at your work through it, and you know what you will keep, and what has had enough of your time."
    ],
    "pull_quote": "Real impact is not measured by how much you produce — but by how much of you remains in it."
  }
  $$::jsonb,
  updated_at = now()
WHERE slug = 'ihya-impact';

-- ── Seed: Ihya Innovation / روح الابتكار (§7.4) ───────────────────────────
UPDATE programs SET
  long_description_ar = $$
  {
    "opening_invitation": "تعرف أنَّ في داخلك فكرةً، أو مشروعاً، أو طريقةً جديدةً في العمل — ومع ذلك لا تخرج. ليس لأنّك كسول، ولا لأنّك غيرُ قادر. بل لأنَّ الخوفَ أسرع منها. خوفٌ من الخطأ، من أن لا يَفهمَك الناس، من أن لا تعرف بعدُ من أنت. في هذه الأيّام الثلاثة، ندعوك أن تتركَ الخوفَ قليلاً — لتسمحَ للفكرة أن تأتي. لا نُعلِّمك كيف تُصبح مُبدعاً، لأنّك مُبدعٌ أصلاً — نساعدك أن تُزيل ما يمنعُك من الإصغاء إلى إبداعك.",
    "who_for": [
      "مُبدعون (كُتّاب، مصمّمون، بُناة منتجات، فنّانون) يشعرون أنّهم «عالقون» رغم خبرتهم",
      "قادةٌ يريدون قراراتٍ أشجع في عملهم، ولكنّ الخوف الداخليّ أعلى من صوت البصيرة",
      "مَن يعيش تحوّلاً مهنيّاً ويبحث عن صوتٍ جديد، لا نسخةٍ مُكرَّرة من القديم",
      "مَن يريد تجربةَ التفكير الحسّيّ — لا قراءةَ عنه فقط",
      "مَن يشكّ في أنَّ أفضلَ أفكاره ما زالت داخله، لم تَخرج بعد"
    ],
    "who_not_for": [
      "مَن يبحث عن ورشةِ تقنيّاتٍ إبداعيّة (برامج، أدوات، عصفٌ ذهنيّ كلاسيكيّ) — ليست هذه",
      "مَن لا يريد أن يشعر بأيّ شيءٍ غير مريح — الإبداعُ يمرّ بلحظاتٍ غير مريحة، هذه طبيعتُه",
      "مَن يعتقد أنَّ الإبداع موهبةٌ وِلاديّة لا تُكتسَب — سترحلُ من هنا بقناعةٍ مختلفة"
    ],
    "benefits": [
      "علاقة مختلفة مع الخوف — ليس كعدوٍّ بل كإشارةٍ تعرف قراءتها",
      "فكرةٌ أو مشروعٌ نضج داخلك — كتبتَه أو شعرتَ بشكله بوضوحٍ كافٍ لتُكمل",
      "تجربةٌ مباشرة للتفكير الحسّيّ — ستفهم لماذا هذا النهج مختلف عمّا سبق",
      "ثقة جديدة في أنَّ إبداعك ليس محدوداً بما أنتجتَه من قبل",
      "ممارسةٌ بسيطة تأخذها معك — تعود إليها حين يعود الخوف",
      "شجاعةٌ هادئة، لا حماسةٌ مؤقّتة"
    ],
    "impressions": [
      "الإبداعُ لا يأتي في القاعات المُضاءة بالفلوريسنت. يأتي حين تُبطئ كفاية كي تسمع نفسك. المكانُ يُهيِّئ ذلك من غير أن يُلفت إليه: ضوءٌ طبيعيّ، أصواتٌ قليلة، وقتٌ للمشي وحدك قبل الحوار.",
      "المجموعة صغيرةٌ بما يكفي ليعرف كلُّ واحدٍ اسمَ الآخر، وكبيرةٌ بما يكفي ليرى كلُّ واحدٍ منّا نفسَه في الآخرين. نجرِّب، نكتب، نصمت، ونشارك ما شعرنا به من غير أن يُحكَم عليه.",
      "تنتهي الأيّام الثلاثة وقد تغيَّرت فيك علاقةٌ لطيفةٌ ولكنَّها مُهمّة: لم تَعُد تنتظر الإلهام. عرفتَ أنَّ الإلهام موجود، وأنَّه كان ينتظرك، لا العكس."
    ],
    "pull_quote": "الفكرةُ لا تَخاف منك — أنت مَن يَخاف منها."
  }
  $$::jsonb,
  long_description_en = $$
  {
    "opening_invitation": "You know there is an idea inside you — or a project, or a new way of working — and still it does not come out. Not because you are lazy, not because you cannot. Because fear moves faster than it does. Fear of being wrong, of not being understood, of not yet knowing who you are. In these three days, we invite you to leave fear a little — so the idea can come. We will not teach you how to become creative, because you already are. We help you clear what prevents you from listening to your own creativity.",
    "who_for": [
      "Creators (writers, designers, product builders, artists) who feel 'stuck' despite their experience",
      "Leaders who want braver decisions at work, but whose inner fear is louder than the voice of insight",
      "People in professional transition seeking a new voice — not a repeat of the old one",
      "People who want to experience Somatic Thinking — not only read about it",
      "People who suspect that their best ideas are still inside them, waiting to come out"
    ],
    "who_not_for": [
      "Anyone looking for a creative-techniques workshop (software, tools, classic brainstorming) — this isn't one",
      "Anyone unwilling to feel anything uncomfortable — creativity passes through uncomfortable moments; that's its nature",
      "Anyone who believes creativity is a birth-given talent that can't be developed — you will leave here with a different conviction"
    ],
    "benefits": [
      "A different relationship with fear — not as an enemy but as a signal you can read",
      "An idea or project that ripened inside you — written down, or felt clearly enough to continue",
      "A direct experience of Somatic Thinking — you will understand why this approach differs from what came before",
      "New confidence that your creativity is not limited to what you have produced before",
      "One simple practice you take with you — returning to it when fear returns",
      "Quiet courage, not temporary enthusiasm"
    ],
    "impressions": [
      "Creativity does not arrive in rooms lit by fluorescent light. It arrives when you slow down enough to hear yourself. The place arranges this without drawing attention to it: natural light, few sounds, time to walk alone before any dialogue.",
      "The group is small enough that everyone knows each other's name, and large enough that each of us sees ourselves in the others. We experiment, we write, we grow still, and we share what we felt without being judged for it.",
      "The three days end, and one gentle but important relationship has shifted inside you: you no longer wait for inspiration. You know inspiration is there, and that it was waiting for you — not the other way round."
    ],
    "pull_quote": "The idea does not fear you — you are the one who fears it."
  }
  $$::jsonb,
  updated_at = now()
WHERE slug = 'ihya-innovation';

-- ── Seed: Ihya Connection / إحياء الصِّلة (§7.5) ───────────────────────────
UPDATE programs SET
  long_description_ar = $$
  {
    "opening_invitation": "تُحيطك علاقاتٌ كثيرة، ومع ذلك تشعر أحياناً بأنَّك وحيد. تُحادث الناس كلَّ يوم، ومع ذلك لم تَرَ بينهم مَن رآك. الفجوةُ ليست في عدد الناس حولك — هي في نوع حضورك معهم، ونوعِ حضورهم معك. في هذه الأيّام الثلاثة، ندعوك لتتعلَّم أن تتَّصل من وعيٍ لا من حاجة — أي أن تصل إلى الآخر وأنت كامل، لا وأنت ناقص تَطلب منه أن يُكمِلَك. علاقاتُك ليست مكسورة كما تظنّ. أنت فقط لم تحضرْ فيها بعد.",
    "who_for": [
      "مَن يشعر بفجوةٍ بين عدد علاقاته وعمقها",
      "أزواجٌ يريدون أن يحضروا لبعضهم بطريقةٍ جديدة — لا أن يُصلِحوا خلافاً معيَّناً فقط",
      "قادةٌ يعرفون أنَّ حضورهم مع فريقهم يُحدِّد ما يحصل أكثر من أدواتهم الإداريّة",
      "آباء وأمّهات يريدون أن يرَوا أبناءَهم كما هم، لا كما يحتاجون أن يكونوا",
      "مَن يكرّر أنماطَ علاقاتٍ مُرهِقة ولم يَعُد يريد أن يُلقي اللومَ على الآخر"
    ],
    "who_not_for": [
      "مَن يبحث عن علاجٍ زوجيّ متخصّص — هذه الرحلة مُكمِّلة له ولا تحلّ محلّه",
      "مَن يريد أن يُغيِّر الآخرين من غير أن يتغيَّر هو — المدخل هنا من الذات إلى الصِّلة",
      "مَن لا يستطيع الجلوس مع شريكٍ أو مجموعةٍ بصراحةٍ هادئة — الرحلة تتطلَّب انفتاحاً لا عنفاً"
    ],
    "benefits": [
      "وعيٌ أوضح بنمط حضورك مع الآخرين — ما الذي تُضيفه فعلاً وما الذي تحمله من الماضي",
      "قدرة على الإصغاء بطريقةٍ تُغيِّر المُتكلِّم، لا فقط تفهمه",
      "مسافةٌ صحّيّة جديدة — لا بُعدٌ بارد ولا التحامٌ مُرهِق",
      "محادثاتٌ مهمّة في حياتك ستعود إليها — هذه المرّة بلغةٍ جديدة",
      "ثقة في علاقاتك لا تعتمد على ردّ الفعل الدائم من الآخر",
      "شعورٌ بأنَّك قادرٌ على الوحدة، ومن ثَمَّ قادرٌ على الصِّلة"
    ],
    "impressions": [
      "الصِّلةُ تحتاج أرضاً هادئة كي تنمو. المكانُ يُقدِّم هذه الأرض: مجموعةٌ صغيرة، وقتٌ لا يُستعجَل، صمتٌ مُتعمَّد قبل الحوار، ودوائرُ يُصغى فيها أكثر ممّا يُتكلَّم.",
      "نتعلَّم الحضور في خطواتٍ صغيرة، لا في تحوّلاتٍ مفاجئة. نلتقي بأنفسنا قبل أن نلتقي بالآخر، فنعرف أنَّ ما كنّا نطلبه من علاقاتنا كان أحياناً طلباً من أنفسنا لأنفسنا. وحين يحدث ذلك، شيءٌ يسترخي.",
      "الأيّامُ الثلاثةُ لا تُقدِّم لك علاقاتٍ جديدة — تُقدِّم لك طريقةً جديدة للدخول إلى علاقاتك القديمة. ترجعُ إلى شريكك، إلى طفلك، إلى فريقك، وأنت الشخصُ نفسه — ولكنَّك تراهم بطريقةٍ لم تكن تراها قبل أسبوع."
    ],
    "pull_quote": "لا تطلبْ من علاقاتك ما لم تُعطِه لنفسك أوّلاً."
  }
  $$::jsonb,
  long_description_en = $$
  {
    "opening_invitation": "Many relationships surround you, and still, sometimes, you feel alone. You speak to people every day, and still, among them, no one has seen you. The gap is not in the number of people around you — it is in the kind of presence you bring, and the kind they bring. In these three days, we invite you to learn to connect from awareness, not from need — to arrive at the other as whole, not as incomplete and asking them to complete you. Your relationships are not as broken as you think. You just haven't been present in them yet.",
    "who_for": [
      "People sensing a gap between the number of their relationships and their depth",
      "Couples who want to show up for each other in a new way — not only to resolve a particular disagreement",
      "Leaders who know their presence with their team shapes what happens more than their management tools",
      "Parents who want to see their children as they are, not as they need them to be",
      "People repeating tiring relational patterns who no longer want to assign the blame elsewhere"
    ],
    "who_not_for": [
      "Anyone seeking specialized couples therapy — this retreat complements that work, it does not replace it",
      "Anyone wanting to change others without themselves changing — the entry here is from the self into connection",
      "Anyone unable to sit with a partner or a group in quiet honesty — the retreat requires openness, not confrontation"
    ],
    "benefits": [
      "Clearer awareness of your pattern of presence with others — what you actually bring, and what you carry from the past",
      "A capacity for listening that changes the speaker, not only understands them",
      "A new healthy distance — neither cold remove nor exhausting enmeshment",
      "Important conversations in your life that you will return to — this time in a new language",
      "Confidence in your relationships that does not depend on constant reciprocation from the other",
      "A sense that you are capable of solitude, and from there capable of connection"
    ],
    "impressions": [
      "Connection needs quiet ground to grow. The place offers that ground: a small group, time that cannot be rushed, an intentional silence before dialogue, and circles where more is listened than said.",
      "We learn presence in small steps, not in sudden transformations. We meet ourselves before we meet the other, and we discover that what we had been asking of our relationships was sometimes a request from ourselves to ourselves. When that lands, something relaxes.",
      "The three days do not give you new relationships — they give you a new way of entering your old ones. You return to your partner, your child, your team — the same person you were — but seeing them in a way you did not, a week ago."
    ],
    "pull_quote": "Do not ask of your relationships what you have not first given to yourself."
  }
  $$::jsonb,
  updated_at = now()
WHERE slug = 'ihya-connection';

-- ── Seed: Ihya Grand Journey / إحياء الرحلة الكبرى (§7.6) ──────────────────
UPDATE programs SET
  long_description_ar = $$
  {
    "opening_invitation": "في الحياة العاديّة، تعيش أجزاءَك في غُرفٍ منفصلة. جسدك في غرفة، وعملك في غرفة، وعلاقاتك في غرفة، وداخلك في غرفةٍ قلَّما تدخلها. في الرحلة الكبرى، تجتمع هذه الغرف كلُّها في مكانٍ واحدٍ ولمرّةٍ واحدة. سبعةُ أيّام في الطبيعة تسمح لكلِّ جزءٍ منك أن يحضر مع الأجزاء الأخرى — ويكتشف أنَّه لم يكن، أصلاً، منفصلاً عنها. هذه ليست رحلةً للهروب من حياتك، بل رحلةٌ تعود منها إليها كاملاً.",
    "who_for": [
      "مَن يبحث عن تجربةٍ عميقة لا يكفيها ثلاثة أو أربعة أيّام",
      "خرّيجو رحلات إحياء السابقة الذين يريدون التكامل بين ما مرّوا به",
      "قادةٌ ومؤسّسون في مرحلةٍ محوريّة من حياتهم يحتاجون مساحةً استثنائيّة لقرارٍ استثنائيّ",
      "زملاؤنا من المدرِّبين المُحترَفين (Coaches) في مرحلة تطوُّرٍ مهنيّ عميق",
      "مَن يريد أن يرى، لمرّةٍ واحدة، ما الذي يحدث حين يجتمع كلُّ شيءٍ فيه في مكانٍ واحد"
    ],
    "who_not_for": [
      "مَن يدخل إلى الرحلات لأوّل مرّة — نوصي بالبدء برحلةٍ متخصّصة (3–4 أيّام) قبل الرحلة الكبرى",
      "مَن لا يستطيع ترك عمله ومسؤوليّاته سبعة أيّام كاملة — الرحلة لا تعمل إلا بانقطاعٍ كامل",
      "مَن يبحث عن تجربةٍ خفيفة — الرحلةُ عميقة، طويلة، وتتطلَّب حضوراً كاملاً"
    ],
    "benefits": [
      "إحساسٌ بالكمال الداخليّ لم يَعُد يحتاج إلى الخارج ليُثبت نفسَه",
      "رؤية واضحة لأجزائك كلِّها معاً — كيف يتكلَّم جسدك مع عملك، وعلاقاتك مع نفسك",
      "قرارٌ أو اتِّجاهٌ كبير نضج فيك على مدى سبعة أيّام، لا سبع ساعات",
      "علاقةٌ جديدة مع الطبيعة كمُعلِّمٍ أصيل، لا كمجرَّد مشهدٍ خلفيّ",
      "ممارساتٌ قليلة ومتَّزنة تأخذها معك — لا قائمةٌ ثقيلة تُضيف عبئاً",
      "إحساسٌ بأنَّك رجعتَ كاملاً، كما لم تكن من قبل"
    ],
    "impressions": [
      "في رحلةٍ من سبعة أيّام، يحدث شيءٌ لا يُمكن أن يحدث في أقلّ من ذلك: الوقتُ يتغيَّر شكلُه. اليومُ الأوَّل يشبه يوماً عاديّاً. اليومُ الثالث يصير أطول. اليومُ الخامس ما عاد يُشبه يوماً في المدينة أصلاً — صار يشبه نَفَساً طويلاً واحداً.",
      "الرحلة الكبرى تأخذك عبر الطبيعة بإيقاعٍ لا يُفرَض. مشيٌ بصمتٍ في الصباح، حوارٌ بين الظهر والعصر، حلقةُ إصغاءٍ عند المغيب، ليلٌ تسمع فيه نَفسَك أكثر ممّا تسمع هاتفك. كلُّ يومٍ يَفتح باباً صغيراً أعمق من الذي قبله.",
      "تنتهي الأيّام السبعة وتنظرُ إلى الصورة نفسها التي كانت في هاتفك قبل الرحلة — وجهُك فيها. تعرف أنَّ هذا الوجه هو أنت قبل الرحلة، وأنَّ هناك وجهاً آخر هو أنت بعد الرحلة. والفرق بينهما ليس في الملامح، بل في مَن يَسكُن خلفها."
    ],
    "pull_quote": "لا تذهبُ إلى الطبيعة لتَهرب من حياتك — تذهبُ إليها لتتذكَّرَ أنَّك جزءٌ منها."
  }
  $$::jsonb,
  long_description_en = $$
  {
    "opening_invitation": "In ordinary life, you live your parts in separate rooms. Your body in one room, your work in another, your relationships in a third, and your interior in a room you rarely enter. In the Grand Journey, all these rooms come together in one place, once. Seven days in nature let every part of you appear alongside the others — and discover that it was never, in truth, separate from them. This is not a journey to escape from your life. It is a journey you return from, to your life, whole.",
    "who_for": [
      "People seeking a deep experience that three or four days cannot hold",
      "Graduates of previous Ihya retreats wanting the integration across what they have walked through",
      "Leaders and founders at a pivotal life stage who need an exceptional space for an exceptional decision",
      "Our fellow coaches in a season of deep professional development",
      "People who want to see, once, what happens when everything inside them meets in one place"
    ],
    "who_not_for": [
      "People entering Ihya for the first time — we recommend beginning with a themed retreat (3-4 days) before the Grand Journey",
      "Anyone who cannot step away from work and responsibilities for a full seven days — the retreat works only under complete disconnection",
      "Anyone looking for a light experience — this is deep, long, and requires full presence"
    ],
    "benefits": [
      "A sense of inner wholeness that no longer needs the outside to prove itself",
      "A clear view of all your parts together — how your body speaks to your work, your relationships to your self",
      "A large decision or direction that has ripened in you over seven days, not seven hours",
      "A new relationship with nature as a genuine teacher, not merely a backdrop",
      "A few balanced practices to take with you — not a heavy list that adds weight",
      "A felt sense of returning whole, in a way you had not been before"
    ],
    "impressions": [
      "On a seven-day journey, something happens that cannot happen in less: time changes shape. The first day feels like an ordinary day. The third day grows longer. By the fifth day, a day no longer resembles a day in the city — it resembles one long breath.",
      "The Grand Journey moves you through nature at a rhythm that is not imposed. A silent walk in the morning, conversation between noon and afternoon, a listening circle at sunset, a night where you hear yourself more than you hear your phone. Each day opens a small door, a little deeper than the one before.",
      "The seven days end, and you look at the same photograph that was on your phone before the journey — your own face in it. You know that face is you before the journey, and that there is another face, which is you after it. The difference between them is not in the features, but in who lives behind them."
    ],
    "pull_quote": "You do not go to nature to escape your life — you go to remember that you are part of it."
  }
  $$::jsonb,
  updated_at = now()
WHERE slug = 'ihya-grand-journey';

-- ── Verify seed: 6 Ihya rows with populated long_description ──────────────
DO $verify$
DECLARE
  v_count int;
BEGIN
  SELECT COUNT(*) INTO v_count
    FROM programs
    WHERE slug LIKE 'ihya-%'
      AND long_description_ar IS NOT NULL
      AND long_description_en IS NOT NULL;

  IF v_count <> 6 THEN
    RAISE EXCEPTION 'Canon W4: expected 6 Ihya rows with long_description populated, got %', v_count;
  END IF;

  RAISE NOTICE 'Canon W4 seed verified: % Ihya rows with long_description_ar + long_description_en', v_count;
END
$verify$;

-- ── Migration tracking note ─────────────────────────────────────────────────
-- Per reference_kun_db_migration_pattern: drizzle-kit tracking is best-effort on VPS.
-- This file should be applied via `sudo -u postgres psql -f` on the VPS if drizzle-kit OOMs.
