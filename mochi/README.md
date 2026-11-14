# 🐱 Mochi — playable MVP

This folder is a working build of the MVP described in the [project README](../README.md): a cozy cat companion for low-energy days, with a cutaway mansion, an open world to wander, gentle check-ins, tiny tasks, a worry-eating cat, and anonymous messages in a bottle.

It runs in any modern browser, on phones too, and has **no dependencies**: vanilla JS + HTML5 canvas for the game, and a Python standard-library server for the bottle system.

> Why web instead of Godot/Unity? The README suggests a game engine, but nothing was installed on the build machine. A web build was the fastest way to get something every judge and tester can open on their own phone. All art is procedural (drawn in code), so the design carries straight over to Godot later.

---

## ▶️ Run it

**Full experience (bottles between people):**

```bash
cd mochi/server
python server.py            # → http://localhost:8000
python server.py --lan      # also prints a URL for phones on the same Wi-Fi
```

Requires Python 3.9+. Nothing to install. The console prints a **moderator token** for the review queue at `http://localhost:8000/moderation`.

**Solo / offline:** double-click `mochi/web/index.html`. Everything private works offline. Bottles you write wait in an outbox, and only the clearly labelled starter bottles from the Mochi crew can wash up.

### Demo tips

- ⚙️ **Settings → World time** pins the world to *Always day* or *Always night* (fireflies, lit windows, the late-night yawn).
- Pick 😴 **Just watch it** in the check-in to see the cat asleep in a box. Pick ⚡ **Zoomies!** to see it race around the house.
- Open the app in two browsers (or on two phones with `--lan`) to send a bottle from one and reply from the other.
- Writing crisis language into a bottle shows the calm support screen. The bottle is held for a human in `/moderation`.

---

## ✅ What's built (MVP column of the README)

| MVP item | Where |
|---|---|
| Cat companion with energy mirroring (box → sofa → window → yarn → zoomies) | `web/js/mansion.js`, `web/js/cat.js` |
| Subtle check-ins (blanket / laser / seat), adjustable frequency, skippable | `web/js/checkin.js` |
| Energy-scaled daily tasks (1–3), swap, "rest instead", no streaks | `web/js/checkin.js` (`M.tasks`), `web/js/data.js` |
| Worry-eating cat: eat / shred / bury, voice input, nothing stored | `web/js/worry.js` |
| Messages in a bottle: anonymous, energy-matched, one kind reply, report & block | `web/js/bottles.js`, `server/server.py` |
| Safety section: always-visible 🛟, country helplines, safety plan (printable) | `web/js/safety.js` |
| Cutaway mansion with 6 rooms, decorating, idle silliness | `web/js/mansion.js` |
| World map: Bottle Beach, Sleepy Meadow, Whispering Woods (+ Home Isle, Pebble Islet) | `web/js/world.js` |
| Tap-to-walk (A*), optional joystick + keyboard, balloon fast travel, couch mode | `web/js/world.js` |
| Day/night cycle from the local clock | `web/js/util.js` (`M.sky`) |

**Also in:** fog of war that clears as you wander, collectibles (shells, leaves, stamps, stone cats) with no completion percentage, friendly NPC cats, a never-expiring scarf quest, a paper-boat route, a whispering tree for worries, a hope garden that blooms over real days, a failure-free fishing mini-game, a breathing exercise (room and cloud themes), a synthesised soundscape (lo-fi, purr, rain, fire, waves, each mutable), yarn cosmetics (wardrobe and decor), a welcome-back gift that's identical after 1 day or 3 months, and an installable PWA with offline cache.

**Deliberately absent:** paid currency, ads, stamina, timers, streaks, FOMO, red notification badges. The cat never gets sick or sad.

---

## 🧱 Architecture

```
mochi/
├── web/                      static app (works from file:// too)
│   ├── index.html            shell: top bar (🛟 always visible), views, bottom bar
│   ├── css/style.css         palette + bubbly UI; calm styles for safety screens
│   ├── js/util.js            helpers, RNG, sky/day-night, particles, canvas utils
│   ├── js/store.js           on-device state (localStorage), consent-aware saving
│   ├── js/data.js            tasks, helplines, NPC lines, shop items, crew bottles
│   ├── js/cat.js             procedural chibi cat (poses, coats, accessories)
│   ├── js/mansion.js         cutaway house renderer + cat behaviour/gags
│   ├── js/world.js           island generation, chunked terrain, A*, fog, NPCs, travel
│   ├── js/bottles.js         bottle UI + API client + offline outbox
│   ├── js/safety.js          help screen, safety plan, message filter
│   └── js/{checkin,worry,calm,settings,onboarding,minigames,ui,audio,app}.js
└── server/
    ├── server.py             static files + bottle API + moderation API
    └── moderation.html/.js   human review queue
```

- **Performance:** the mansion caches its static layer and runs at about 30 fps. The world renders terrain in 8×8-tile chunks that stream in near the camera and are evicted (LRU) behind it. Frame rate drops to 30 fps when idle and 24 fps in couch mode, and the loops pause when the tab is hidden.
- **Matching** (`compat_score` in `server.py`): bottles go to readers with *compatible* energy. Two people at their lowest are never paired; a reader at energy 1 only gets light (non-vent) bottles from writers with energy ≥ 3. Readers at energy ≥ 3 can opt in as **listener cats** for heavier bottles. Ties break on shared need, topic, close time zone, and how long a bottle has waited. Each bottle reaches at most 3 readers, and each reader gets at most 6 bottles a day.

### Bottle API

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | liveness |
| POST | `/api/bottles` | send `{clientId, text, energy, need, topic, tz}` → `sea` or `held` |
| GET | `/api/inbox` | matched bottles for `clientId, energy, listener, need, topic, tz` |
| POST | `/api/reply` | one kind reply `{clientId, bottleId, text}` |
| GET | `/api/mine` | my bottles' status + replies to them |
| POST | `/api/report` / `/api/block` | hide content for review / never see a sender again |
| POST | `/api/forget` | delete everything this client ever sent |
| GET/POST | `/api/mod/queue`, `/api/mod/decide` | moderator review (token required) |

---

## 🛟 Safety & 🔒 privacy notes

- **Helplines** (`web/js/data.js → HELPLINES`) were checked on **2026-11-14** against the services' own sites or findahelpline.com. FI, VN, US, CA, GB, IE, AU, DE, SE and NL are listed; every other country points to findahelpline.com. **Re-verify every number before any release**: the README cites research showing apps listing wrong numbers. Two caveats: Vietnam's Ngày Mai line has limited hours, and MIELI's English-language line wasn't confirmed, so only the 24/7 Finnish line is listed.
- **Crisis detection** is a keyword/regex list, mirrored in `safety.js` and `server.py`. It errs on the side of holding messages for a human; it is *not* a clinical classifier. Before launch it needs native-language lists and professional review.
- **Filtering:** links, emails, phone numbers and social handles are rejected in bottles and replies. Insults are rejected in replies.
- **Identity:** the device makes a random ID, and the server stores only a salted hash of it. Request logs drop query strings, bodies and IPs. Server data lives in `server/data/` (git-ignored).
- **Health data:** check-in history is saved only with explicit opt-in consent (GDPR art. 9). Worry-room text is never stored anywhere. ⚙️ Settings → Privacy shows what is stored and offers view, export (JSON) and delete everything (which also calls `/api/forget`).
- **18+:** under-18 users keep the private cat features. Bottles are switched off for them and they are pointed to help resources.
- Local data is in plain `localStorage`. Encryption at rest, which the README asks for, needs a native wrapper or a passphrase and is listed below.

## 🧪 How it was tested

- `server.py` was exercised end to end with 37 API checks: matching rules, held crisis bottles, filters, one-reply rule, block, report → moderation, forget, and static-file safety (no directory listing, no path escape).
- The app was driven in headless Edge through every flow: onboarding, check-ins at all 5 energies, tasks, worry room, bottles (send, receive, reply, crisis), help, safety plan, breathing, settings, wardrobe, decor, map travel, leaf, garden, quest, fishing, couch mode, night mode, XL text with reduced motion, under-18 mode, offline file:// mode, and delete everything. Zero JS errors. A reachability check confirms every place, NPC and collectible on the map can be walked to.

## 🗺️ Next steps

Native wrapper with encrypted storage and push-free reminders, a Godot port of the renderer, Starlight Lake, Cat Café Town, Postcard Mountains, listener-cat Lighthouse, mood-reflecting weather, other players' cats with preset emotes, real moderation tooling, and clinician review of all copy.

---

Font: [Nunito](https://github.com/googlefonts/nunito), SIL Open Font License, self-hosted in `web/fonts/` so no request goes to Google. All other art and sound is generated in code.
