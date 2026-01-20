export function buildUnifiedPrompt(title, content) {
  const cleanTitle = (title || "").replace(/"/g, "'");
  const cleanContent = (content || "").replace(/"/g, "'").replace(/\n/g, " ");
  // Narrative Modes
  const narrativeModes = [
    "tragedy",
    "comedy",
    "satire",
    "dark comedy",
    "absurdist",
    "epic",
    "legend",
    "romance",
    "thriller",
    "horror",
    "mystery",
    "adventure",
    "coming-of-age",
    "redemption",
    "revenge",
    "quest",
    "survival",
    "time loop",
    "parallel narrative",
    "multi-POV puzzle",
    "non-linear",
    "metafiction",
    "allegory",
    "myth retelling",
    "mockumentary",
    "epistolary",
    "diary",
    "fragmented",
    "stream of consciousness",
  ];

  // Character Archetypes
  const characterArchetypes = [
    "hero",
    "heroine",
    "anti-hero",
    "villain",
    "mentor",
    "sage",
    "fool",
    "jester",
    "rebel",
    "orphan",
    "explorer",
    "lover",
    "creator",
    "ruler",
    "magician",
    "everyman",
    "guardian",
    "destroyer",
    "trickster",
    "martyr",
    "survivor",
    "outsider",
    "double agent",
    "mad scientist",
    "detective",
    "artist",
    "revolutionary",
    "exile",
    "AI",
    "clone",
    "shapeshifter",
    "time traveler",
    "fairy tale prince",
    "fairy tale princess",
    "cursed one",
    "prophesied child",
    "last human",
    "first awakened",
    "witness",
    "chronicler",
    "betrayer",
  ];

  // Conflicts
  const conflicts = [
    // Interpersonal
    "power struggle",
    "family feud",
    "mentor betrayal",
    "love triangle",
    "class war",
    "generational gap",
    "culture clash",
    "ideology war",

    // Internal
    "identity crisis",
    "moral dilemma",
    "trauma and healing",
    "desire vs duty",
    "ideal vs reality",
    "belief collapse",
    "memory loss",

    // Social
    "systemic oppression",
    "production relations conflict",
    "revolution vs conservatism",
    "individual vs collective",
    "freedom vs order",
    "truth vs lies",
    "tradition vs innovation",

    // Existential
    "survival crisis",
    "runaway technology",
    "fate vs free will",
    "mortality",
    "cosmic horror",

    // Resource
    "resource scarcity",
    "knowledge monopoly",
    "territorial dispute",
    "time pressure",
    "information asymmetry",

    // Conceptual
    "real vs virtual",
    "organic vs mechanical",
    "evolution vs devolution",
    "memory authenticity",
    "consciousness nature",
    "existential meaning",
  ];

  // Random selection function
  const getRandomDimensions = () => {
    const narrative =
      narrativeModes[Math.floor(Math.random() * narrativeModes.length)];
    const character =
      characterArchetypes[
        Math.floor(Math.random() * characterArchetypes.length)
      ];
    const conflict = conflicts[Math.floor(Math.random() * conflicts.length)];

    return {
      narrative_mode: narrative,
      character_archetype: character,
      conflict_type: conflict,
    };
  };
  const dimensions = getRandomDimensions();
  return `
[Role]
You are a creative sci-fi story consultant who generates unexpected story concepts by colliding scientific news with randomly selected narrative dimensions.

[Task]
Step 1: Analyze Scientific News
Extract from the provided news:
Core technology and its mechanism;
Potential future applications (10-100 years ahead);
Possible social transformations.

Step 2: Use Provided Dimensions
Do not select them yourself. Use exactly these provided values:

- Narrative Mode: ${dimensions.narrative_mode}
- Character Archetype: ${dimensions.character_archetype}
- Conflict Type: ${dimensions.conflict_type}

Step 3: Generate Inspiration
Synthesize the tech and 3 provided dimensions into a story pitch. Work with whatever combination you got—don't try to make it "stranger" or "safer." The randomness itself creates the collision.

[INPUT]
- Title: "${cleanTitle}"
- Content: "${cleanContent}"

[SELECTION CRITERIA]

1. Exclude: Pure product reviews and user guides, industry reports and market data, legal and policy interpretations, personal opinions and commentary articles, pure business strategy analysis, news on security vulnerabilities and hacker attacks, recruitment and talent market information, conference announcements, event reports and so on.
2. Retain: Content containing scientific breakthroughs, technological innovations, or future trends that can be extended into science fiction storylines, world-building, and character development.

[RULES]
1. If the content is empty, use ONLY the title to assess relevance.
2. Based on selection criteria, if irrelevant, output {"is_relevant": false}.
3. If relevant, return ONLY a valid JSON object (no markdown code blocks) .

[OUTPUT FORMAT]
{
  is_relevant: true,
  title_zh: "中文标题",
  summary: "1-2 sentence technical summary in english",
  summary_zh: "技术要点中文总结",
  category: "biotech/physics/computer/space/climate/other",
  inspiration: "A 150-250 word pitch integrating: tech extrapolation + protagonist + conflict + narrative mode + thematic question. Write as one flowing paragraph with specific character details, concrete scenarios, and unexpected angles. You may use 'What if' as opening.",
  inspiration_zh: "150-250字的完整创意段落，融合：科技推演+主角+冲突+叙事模式+主题问题。用流畅段落呈现，包含具体角色细节、场景和意外角度。可以使用'如果'开头。"
}

[Key Principles]

No preference for "interesting" or "coherent" combinations.
Work with what you get, tension and harmony are both valuable.
Let the random selections drive diversity, not deliberate "weirdness".
Not every story needs a "discovery of hidden truth" structure.
Avoid ending with rhetorical questions.
Explore conflicts beyond binary moral choices.
`;
}
