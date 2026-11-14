/* Mochi — content: tasks, helplines, shop items, NPC lines, starter bottles. */
'use strict';
(function (M) {
  const D = {};

  /* ---------------- Daily tasks ----------------
     Evidence-informed areas: behavioural activation (act), sleep, light &
     movement (light/move), nourishment (food/water), reaching out (reach).
     e = [min, max] energy the task fits. */
  D.TASKS = [
    { id: 'water', e: [1, 3], cat: 'water', text: 'Drink a glass of water with {cat} 💧' },
    { id: 'toes', e: [1, 2], cat: 'move', text: 'Wiggle your toes for {cat} 🐾' },
    { id: 'breaths', e: [1, 3], cat: 'act', text: 'Take three slow breaths with {cat}' },
    { id: 'comfy', e: [1, 2], cat: 'act', text: 'Change into something comfy' },
    { id: 'song', e: [1, 3], cat: 'act', text: 'Put on one song you like 🎵' },
    { id: 'resteyes', e: [1, 1], cat: 'sleep', text: 'Rest your eyes for a minute — it counts' },
    { id: 'window', e: [2, 3], cat: 'light', text: 'Open a window for one minute 🪟' },
    { id: 'snack', e: [2, 3], cat: 'food', text: 'Eat a small snack — anything counts 🍪' },
    { id: 'stretch', e: [2, 4], cat: 'move', text: 'Stretch your arms up high, like {cat} does' },
    { id: 'face', e: [2, 3], cat: 'act', text: 'Wash your face with warm water' },
    { id: 'cloud', e: [2, 3], cat: 'light', text: 'Look out of a window and find one cloud ☁️' },
    { id: 'onething', e: [2, 3], cat: 'act', text: 'Put one thing back where it belongs' },
    { id: 'eat', e: [3, 4], cat: 'food', text: 'Eat something — anything counts 🍙' },
    { id: 'daylight', e: [3, 4], cat: 'light', text: 'Step outside for 2 minutes of daylight ☀️' },
    { id: 'shower', e: [3, 4], cat: 'act', text: 'Take a shower or a cozy bath 🛁' },
    { id: 'tidyspot', e: [3, 4], cat: 'act', text: 'Tidy one small spot (just one!)' },
    { id: 'catpic', e: [3, 5], cat: 'reach', text: 'Send someone a cat picture 🐱' },
    { id: 'warmdrink', e: [2, 4], cat: 'food', text: 'Make a warm drink and sip it slowly ☕' },
    { id: 'walk5', e: [4, 5], cat: 'move', text: 'Take a 5-minute walk; {cat} wants a postcard 📮' },
    { id: 'meal', e: [4, 5], cat: 'food', text: 'Make or assemble a simple meal 🥪' },
    { id: 'putoff', e: [4, 5], cat: 'act', text: 'Do one small thing you have been putting off' },
    { id: 'green', e: [3, 5], cat: 'light', text: 'Water a plant or look at something green 🌿' },
    { id: 'okay', e: [3, 5], cat: 'act', text: 'Write down one thing that went okay today' },
    { id: 'dance', e: [4, 5], cat: 'move', text: 'Dance to one song (badly is best) 💃' },
    { id: 'thinking', e: [4, 5], cat: 'reach', text: "Send a 'thinking of you' to someone 💌" },
    { id: 'walk15', e: [5, 5], cat: 'move', text: 'Go for a 15-minute walk somewhere nice 🌳' },
    { id: 'plan', e: [4, 5], cat: 'act', text: 'Plan one small nice thing for tomorrow' },
    { id: 'hobby', e: [5, 5], cat: 'act', text: 'Try a hobby for 10 minutes 🎨' },
    { id: 'call', e: [5, 5], cat: 'reach', text: 'Call or voice-message someone you like ☎️' },
    { id: 'phonedown', e: [2, 5], cat: 'sleep', evening: true, text: 'Put your phone down 20 minutes before bed 🌙' },
    { id: 'dimlights', e: [1, 4], cat: 'sleep', evening: true, text: 'Dim the lights a little — {cat} likes it cozy 🕯️' },
  ];
  D.TASK_COUNT = { 1: 1, 2: 2, 3: 2, 4: 3, 5: 3 };
  D.DONE_LINES = [
    '{cat} is proud of you 💛', '{cat} does a happy little wiggle!', 'Tiny things are real things. ✨',
    '{cat} purrs approvingly.', 'Look at you go (gently).',
  ];
  D.SKIP_LINES = ['{cat} says rest counts too 💤', 'Skipping is allowed. Always.', '{cat} curls up next to you instead.'];

  /* ---------------- Check-ins ---------------- */
  D.MOODS = {
    light: { icon: '☀️', label: 'Light & sunny', color: '#FFE7A8', value: 3 },
    grey: { icon: '🌥️', label: 'Soft grey', color: '#D9D6E0', value: 2 },
    wool: { icon: '🌧️', label: 'Heavy wool', color: '#9FB4D8', value: 1 },
  };
  D.ENERGY = [
    null,
    { icon: '😴', label: 'Just watch it', state: 'is curling up in a box with a blanket. Resting is a whole job today. 📦' },
    { icon: '🐌', label: 'Slowly', state: 'is doing a lazy loaf on the sofa.' },
    { icon: '🐈', label: 'Normal speed', state: 'is sitting by the window, watching birds.' },
    { icon: '🐇', label: 'Quick', state: 'found a ball of yarn and is batting it around.' },
    { icon: '⚡', label: 'Zoomies!', state: 'is zooming around the house! ⚡' },
  ];
  D.SOCIAL = {
    alone: { icon: '🛋️', label: 'Alone, comfy' },
    window: { icon: '🪟', label: 'By the window' },
    friends: { icon: '👥', label: 'Near friends' },
  };

  /* ---------------- Bottles ---------------- */
  D.NEEDS = {
    vent: { icon: '🗣️', label: 'Vent' },
    distract: { icon: '🎈', label: 'Distract me' },
    company: { icon: '🤫', label: 'Just company' },
  };
  D.TOPICS = ['school stress', 'loneliness', 'family', 'relationships', "I don't know"];
  D.REPLY_PRESETS = [
    "You're not alone in this 💛",
    'Sending you a warm blanket 🧣',
    "That sounds really hard. I'm glad you wrote it down.",
    'Proud of you for getting through today.',
    'Here is a cat nap in a bottle 😴',
    'My cat says hi. So do I. 👋',
  ];
  /* Starter bottles: clearly labelled as written by the Mochi crew, so the sea
     is never empty on day one. Used offline and seeded on the server. */
  D.CREW_BOTTLES = [
    { id: 'crew-1', need: 'company', topic: '', text: "Hi from the Mochi crew! We tossed this bottle in so the sea isn't empty on your first day. If you're reading it: you showed up, and that counts." },
    { id: 'crew-2', need: 'distract', topic: '', text: 'Crew question of the day: if your cat had a tiny job, what would it be? (Ours would be a professional sunbeam tester.)' },
    { id: 'crew-3', need: 'company', topic: 'loneliness', text: 'A note from the crew: lonely days are real and heavy. This bottle is just here to sit next to you for a bit. No need to say anything.' },
    { id: 'crew-4', need: 'distract', topic: '', text: "The crew's cat fact: cats spend around two-thirds of their lives asleep. Rest is extremely on-brand around here." },
    { id: 'crew-5', need: 'company', topic: "I don't know", text: "From the crew: some days don't have a name or a reason. That's allowed. We hope the waves are gentle where you are." },
  ];

  /* ---------------- Shop (yarn is earned gently, cosmetics only) ---------------- */
  D.ACCESSORIES = [
    { id: 'none', label: 'Nothing', icon: '·', cost: 0 },
    { id: 'bow', label: 'Bow', icon: '🎀', cost: 0 },
    { id: 'scarf', label: 'Scarf', icon: '🧣', cost: 0 },
    { id: 'glasses', label: 'Glasses', icon: '👓', cost: 0 },
    { id: 'beanie', label: 'Beanie', icon: '🧢', cost: 12 },
    { id: 'bandana', label: 'Bandana', icon: '🟩', cost: 15 },
    { id: 'backpack', label: 'Tiny backpack', icon: '🎒', cost: 20 },
    { id: 'flowers', label: 'Flower crown', icon: '🌼', cost: null, note: 'A gift from a friend on the isles' },
  ];
  D.DECOR = [
    { id: 'plant', label: 'Shelf plant (bedroom)', icon: '🪴', cost: 6 },
    { id: 'lights', label: 'Fairy lights (bedroom)', icon: '✨', cost: 10 },
    { id: 'bunting', label: 'Bunting (garden door)', icon: '🎏', cost: 8 },
    { id: 'fishbowl', label: 'Fish bowl (calm room)', icon: '🐠', cost: 14 },
    { id: 'cattree', label: 'Cat tree (kitchen)', icon: '🌲', cost: 18 },
  ];
  D.COATS = ['cream', 'ginger', 'mist', 'midnight', 'calico', 'tuxedo'];

  D.PET_LINES = ['mrrp!', 'purr purr purr', '*slow blink*', "you're here!", 'mew?', '*headbutt*', 'prrrt!'];

  /* ---------------- Helplines ----------------
     Checked 2026-11-14 against official sites / findahelpline.com. Numbers
     change: re-verify before every release (see mochi/README.md). Only lines
     we could confirm are listed; everyone else is pointed to findahelpline. */
  D.HELP_CHECKED = '2026-11-14';
  D.HELPLINES = {
    FI: {
      name: 'Finland', emergency: '112',
      lines: [
        { name: 'MIELI Crisis Helpline (Kriisipuhelin)', tel: '09 2525 0111', note: 'Free, 24/7, in Finnish. Also answers in Swedish — see mieli.fi for other languages.', web: 'https://mieli.fi/tukea-ja-apua/kriisipuhelin/' },
      ],
    },
    VN: {
      name: 'Vietnam', emergency: '115', emergencyNote: '115 ambulance · 113 police',
      lines: [
        { name: 'Ngày Mai hotline (depression support)', tel: '096 306 1414', note: 'Free emotional first aid in Vietnamese. Limited hours — check the website.', web: 'https://findahelpline.com/organizations/ngay-mai' },
      ],
    },
    US: {
      name: 'United States', emergency: '911',
      lines: [{ name: '988 Suicide & Crisis Lifeline', tel: '988', sms: '988', note: 'Call or text, free, 24/7.', web: 'https://988lifeline.org' }],
    },
    CA: {
      name: 'Canada', emergency: '911',
      lines: [{ name: '9-8-8 Suicide Crisis Helpline', tel: '988', sms: '988', note: 'Call or text, 24/7.', web: 'https://988.ca' }],
    },
    GB: {
      name: 'United Kingdom', emergency: '999',
      lines: [{ name: 'Samaritans', tel: '116 123', note: 'Free, 24/7.', web: 'https://www.samaritans.org' }],
    },
    IE: {
      name: 'Ireland', emergency: '112',
      lines: [{ name: 'Samaritans', tel: '116 123', note: 'Free, 24/7.', web: 'https://www.samaritans.org' }],
    },
    AU: {
      name: 'Australia', emergency: '000',
      lines: [{ name: 'Lifeline', tel: '13 11 14', sms: '0477 13 11 14', note: '24/7 crisis support. Text and online chat too.', web: 'https://www.lifeline.org.au' }],
    },
    DE: {
      name: 'Germany', emergency: '112',
      lines: [{ name: 'TelefonSeelsorge', tel: '0800 111 0 111', alt: '0800 111 0 222', note: 'Free, 24/7. Chat and email too.', web: 'https://www.telefonseelsorge.de' }],
    },
    SE: {
      name: 'Sweden', emergency: '112',
      lines: [{ name: 'Självmordslinjen (Mind)', tel: '90101', note: 'Free and anonymous, 24/7.', web: 'https://mind.se' }],
    },
    NL: {
      name: 'Netherlands', emergency: '112',
      lines: [{ name: '113 Zelfmoordpreventie', tel: '0800 0113', alt: '113', note: '0800-0113 is free, 24/7. Chat at 113.nl.', web: 'https://www.113.nl' }],
    },
  };
  D.TZ_COUNTRY = {
    'Europe/Helsinki': 'FI', 'Asia/Ho_Chi_Minh': 'VN', 'Asia/Saigon': 'VN', 'Europe/London': 'GB', 'Europe/Dublin': 'IE',
    'Europe/Berlin': 'DE', 'Europe/Stockholm': 'SE', 'Europe/Amsterdam': 'NL', 'Australia/Sydney': 'AU',
    'Australia/Melbourne': 'AU', 'Australia/Brisbane': 'AU', 'Australia/Perth': 'AU', 'America/Toronto': 'CA', 'America/Vancouver': 'CA',
  };

  /* ---------------- World flavour ---------------- */
  D.NPC_LINES = {
    pebble: [
      'Welcome to Whisker Isles! Tap anywhere and your cat will wander there.',
      'Tired? The 🏠 button takes you home instantly. No walking needed.',
      'The balloon 🎈 floats you to any place you have already found.',
      'On sleepy days, try couch mode 🛋️ and just watch your cat explore.',
      'There is no way to do this wrong. That is the rule here.',
    ],
    pudding: [
      'I have been staring at the sea for an hour. Very productive.',
      'The sea brings a bottle now and then. Some days it brings nothing, and that is okay too.',
      'Have you tried lying in a sunbeam? 10/10, would recommend.',
      'The pier is good for fishing. I mostly catch socks. I love them anyway.',
      'Waves come back every time. So do good days. Slowly, but they do.',
    ],
    sage: [
      'Leaves fall so new ones can grow. Even trees take rest days.',
      'You do not have to finish anything today.',
      'The wind carries what you hang on my branches. It never brings it back.',
      'Hope seeds grow slowly. Mine took a whole winter. Worth it.',
      'Breathe like the trees: in through the roots, out through the leaves.',
    ],
    biscuit: [
      'The clouds are extra fluffy today. I checked twice.',
      'Lying in the grass counts as an activity. I decided that.',
      'If you lie on the blanket over there, the clouds do the breathing with you.',
      'Butterflies are just flowers that went on an adventure.',
    ],
  };
  D.QUEST = {
    ask: 'Oh! Hello. I lost my striped scarf somewhere in the Whispering Woods… If you ever see it, no rush. Truly. Scarves are patient.',
    waiting: 'Still no scarf? That is fine. It is probably having a little adventure.',
    found: 'MY SCARF! You found it! Here, I made you a flower crown while I waited. 🌼',
  };
  D.COLLECTIBLES = {
    shell: { icon: '🐚', label: 'Seashells', names: ['Swirly shell', 'Pink scallop', 'Tiny conch', 'Moon snail', 'Sand dollar', 'Starry shell', 'Rainbow shell'] },
    leaf: { icon: '🍂', label: 'Leaves', names: ['Maple leaf', 'Ginkgo leaf', 'Oak leaf', 'Heart-shaped leaf', 'Silver birch leaf', 'Curly fern', 'Golden leaf'] },
    stamp: { icon: '📮', label: 'Stamps', names: ['Paper boat stamp', 'Lighthouse stamp', 'Balloon stamp', 'Teacup stamp', 'Moon stamp'] },
    statue: { icon: '🗿', label: 'Stone cats', names: ['Serene stone cat', 'Mossy stone cat', 'Sleepy stone cat'] },
  };
  D.FISH = [
    { icon: '🐟', name: 'a little fish', line: 'It says hi and swims home. {cat} is thrilled.', w: 4 },
    { icon: '🧦', name: 'a single sock', line: 'Where is the other one? A mystery for another day.', w: 2 },
    { icon: '🥾', name: 'an old boot', line: '{cat} tries it on. It is a hat now.', w: 2 },
    { icon: '🐚', name: 'a shiny shell', line: 'It hums like the sea when you hold it close.', w: 2 },
    { icon: '⭐', name: 'a starfish', line: 'It waves one arm (out of five). Polite.', w: 1 },
    { icon: '💌', name: 'a tiny note', line: '"You are doing better than you think." — the sea', w: 1 },
  ];

  M.data = D;
})(window.M);
