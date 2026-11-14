#!/usr/bin/env python3
"""Mochi bottle server: serves the web app and the anonymous
"messages in a bottle" API. Python standard library only.

    python server.py               # http://localhost:8000
    python server.py --lan         # also reachable from phones on your Wi-Fi
    python server.py --port 9000

Privacy by design:
  * clients are identified only by a random ID generated on their device;
    the server stores a salted hash of it, never names, emails or IPs;
  * request logs never include query strings or bodies;
  * POST /api/forget deletes everything a client ever sent.

Safety:
  * links, phone numbers, emails and social handles are rejected;
  * crisis language is *held* for a human moderator (and the writer is shown
    support resources by the app) instead of being sent to a stranger;
  * every bottle and reply can be reported (hidden until reviewed) or blocked;
  * bottles are matched to readers with *compatible* energy, never two people
    at their very lowest (co-rumination risk).
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import secrets
import socket
import threading
import time
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

ROOT = Path(__file__).resolve().parent
WEB = ROOT.parent / "web"
DATA_DIR = Path(os.environ.get("MOCHI_DATA", ROOT / "data"))
DB_FILE = DATA_DIR / "db.json"
MOD_PAGE = ROOT / "moderation.html"

MAX_BODY = 8 * 1024
BOTTLE_MAX, REPLY_MAX = 500, 280
DAILY_BOTTLES, DAILY_REPLIES, DAILY_DELIVERIES = 10, 20, 6
MAX_READERS = 3  # each bottle reaches at most three readers
BOTTLE_TTL = 30 * 86400
NEEDS = {"vent", "distract", "company"}
TOPICS = {"", "school stress", "loneliness", "family", "relationships", "I don't know"}

# --------------------------------------------------------------------------- filters
# Mirrors web/js/safety.js — keep both lists in sync.
CRISIS = [re.compile(p, re.I) for p in [
    r"\bkill(ing)?\s+my\s*self\b", r"\bsuicid(e|al)\b", r"\bend(ing)?\s+(my|it)\s+(life|all)\b", r"\bwant(ing)?\s+to\s+die\b",
    r"\bwanna\s+die\b", r"\b(don'?t|do not)\s+want\s+to\s+(live|be alive|be here)\b", r"\bno\s+reason\s+to\s+live\b",
    r"\bself[\s-]?harm", r"\bcut(ting)?\s+my\s*self\b", r"\bhurt(ing)?\s+my\s*self\b", r"\boverdos(e|ing)\b",
    r"\bbetter\s+off\s+dead\b", r"\btake\s+my\s+(own\s+)?life\b", r"\bnot\s+be\s+(here|around)\s+anymore\b",
    r"\bcan'?t\s+go\s+on\s+(like\s+this|anymore|any\s+more)\b", r"\bkms\b",
]]
ABUSE = [re.compile(p, re.I) for p in [
    r"\bkill\s+your\s*self\b", r"\bkys\b", r"\bgo\s+die\b", r"\bnobody\s+(cares|likes\s+you)\b",
    r"\byou'?re\s+(worthless|pathetic|a\s+loser|stupid|ugly)\b", r"\bshut\s+up\b", r"\bidiot\b", r"\bloser\b",
]]
CONTACT = [(re.compile(p, re.I), what) for p, what in [
    (r"(https?://|www\.)\S+", "links"),
    (r"\b[\w-]+\.(com|net|org|io|me|gg|ly|co|app|xyz|info|vn|fi|uk|de|ru|tv|link)\b", "links"),
    (r"[\w.+-]+@[\w-]+\.[\w.]+", "email addresses"),
    (r"(^|\s)@[\w.]{2,}", "social handles"),
    (r"\b(snap(chat)?|insta(gram)?|discord|telegram|whatsapp|kik|tiktok|zalo|facebook|messenger|wechat|line\s?id)\b", "social handles"),
]]
PHONE = re.compile(r"\+?\d[\d\s().-]{5,}\d")


def check(text: str, kind: str) -> dict:
    t = (text or "").strip()
    if not t:
        return {"ok": False, "reason": "empty"}
    if any(r.search(t) for r in CRISIS):
        return {"ok": False, "crisis": True, "reason": "crisis"}
    for r, what in CONTACT:
        if r.search(t):
            return {"ok": False, "reason": f"To keep everyone safe, bottles can't carry {what}."}
    if any(len(re.sub(r"\D", "", m)) >= 7 for m in PHONE.findall(t)):
        return {"ok": False, "reason": "To keep everyone safe, bottles can't carry phone numbers."}
    if kind == "reply" and any(r.search(t) for r in ABUSE):
        return {"ok": False, "reason": "Replies here are kind-only. Could you say it more gently?"}
    return {"ok": True}


CREW = [
    ("crew-1", "company", "", "Hi from the Mochi crew! We tossed this bottle in so the sea isn't empty on your first day. If you're reading it: you showed up, and that counts."),
    ("crew-2", "distract", "", "Crew question of the day: if your cat had a tiny job, what would it be? (Ours would be a professional sunbeam tester.)"),
    ("crew-3", "company", "loneliness", "A note from the crew: lonely days are real and heavy. This bottle is just here to sit next to you for a bit. No need to say anything."),
    ("crew-4", "distract", "", "The crew's cat fact: cats spend around two-thirds of their lives asleep. Rest is extremely on-brand around here."),
    ("crew-5", "company", "I don't know", "From the crew: some days don't have a name or a reason. That's allowed. We hope the waves are gentle where you are."),
]


# --------------------------------------------------------------------------- storage
class DB:
    def __init__(self, path: Path):
        self.path = path
        self.lock = threading.RLock()
        if path.exists():
            self.data = json.loads(path.read_text("utf-8"))
        else:
            self.data = {"salt": secrets.token_hex(16), "bottles": [], "replies": [], "reports": [], "blocks": [], "counters": {}}
        existing = {b["id"] for b in self.data["bottles"]}
        for cid, need, topic, text in CREW:
            if cid not in existing:
                self.data["bottles"].append({"id": cid, "author": "crew", "text": text, "energy": None, "need": need, "topic": topic,
                                             "tz": 0, "at": time.time(), "status": "sea", "deliveredTo": [], "crew": True})
        self.save()

    def save(self):
        with self.lock:
            self.path.parent.mkdir(parents=True, exist_ok=True)
            tmp = self.path.with_suffix(".tmp")
            tmp.write_text(json.dumps(self.data, ensure_ascii=False), "utf-8")
            os.replace(tmp, self.path)

    def who(self, client_id: str) -> str:
        return hashlib.sha256((self.data["salt"] + client_id).encode()).hexdigest()[:20]

    def bump(self, who: str, kind: str, limit: int) -> bool:
        key = f"{who}:{time.strftime('%Y-%m-%d')}:{kind}"
        c = self.data["counters"]
        if c.get(key, 0) >= limit:
            return False
        c[key] = c.get(key, 0) + 1
        if len(c) > 20000:  # forget old counters
            today = time.strftime("%Y-%m-%d")
            self.data["counters"] = {k: v for k, v in c.items() if today in k}
        return True

    def blocked(self, a: str, b: str) -> bool:
        return any((x["by"] == a and x["who"] == b) or (x["by"] == b and x["who"] == a) for x in self.data["blocks"])


# --------------------------------------------------------------------------- matching
def compat_score(writer: int | None, reader: int, need: str, listener: bool) -> float | None:
    """Higher is better; None means 'never pair these two'.
    Compatible, not identical: a level-1 writer goes to a level 2-3 reader,
    and a reader at level 1 only gets light bottles from people with energy."""
    if writer is None:  # crew bottles fit anyone, but real people go first
        return 0.4
    if listener and reader >= 3:
        return 3.5 if need == "vent" else 2.5
    if reader <= 1:
        return 1.0 if (writer >= 3 and need != "vent") else None
    diff = reader - writer
    if diff in (1, 2):
        s = 3.0
    elif diff == 0:
        s = 2.0 if writer >= 3 else 1.0
    elif diff == -1:
        s = 1.0
    else:
        return None
    if need == "vent" and diff < 0:
        s -= 1.0
    return s if s > 0 else None


def tz_close(a: int, b: int) -> bool:
    d = abs((a or 0) - (b or 0)) % 1440
    return min(d, 1440 - d) <= 180


# --------------------------------------------------------------------------- HTTP
class Handler(SimpleHTTPRequestHandler):
    db: DB = None  # type: ignore
    mod_token: str = ""

    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".html": "text/html; charset=utf-8",
        ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".ttf": "font/ttf", ".json": "application/json",
    }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(WEB), **kwargs)

    # -- privacy-respecting logs: no query strings, no bodies, no IPs
    def log_message(self, fmt, *args):
        path = urlparse(self.path).path
        if path.startswith("/api/"):
            print(f"[{time.strftime('%H:%M:%S')}] {self.command} {path}")

    def end_headers(self):
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("Permissions-Policy", "camera=(), geolocation=(), interest-cohort=()")
        self.send_header("Content-Security-Policy",
                         "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; "
                         "connect-src 'self'; font-src 'self'; media-src 'self' blob:; frame-ancestors 'none'")
        if not urlparse(self.path).path.startswith("/fonts/"):
            self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def list_directory(self, path):  # no directory listings
        self.send_error(HTTPStatus.NOT_FOUND)
        return None

    # -- helpers
    def send_json(self, obj, status=200):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def read_json(self) -> dict:
        n = int(self.headers.get("Content-Length") or 0)
        if n <= 0 or n > MAX_BODY:
            raise ValueError("bad body size")
        data = json.loads(self.rfile.read(n).decode("utf-8"))
        if not isinstance(data, dict):
            raise ValueError("bad body")
        return data

    def client(self, data_or_query) -> str:
        cid = data_or_query.get("clientId")
        if isinstance(cid, list):
            cid = cid[0] if cid else ""
        cid = str(cid or "")
        if not (8 <= len(cid) <= 64) or not re.fullmatch(r"[A-Za-z0-9-]+", cid):
            raise PermissionError("missing client id")
        return self.db.who(cid)

    # -- routing
    def do_GET(self):
        url = urlparse(self.path)
        if url.path.startswith("/api/"):
            return self.api("GET", url.path, parse_qs(url.query))
        if url.path in ("/moderation", "/moderation/", "/moderation.js"):
            page = MOD_PAGE if not url.path.endswith(".js") else MOD_PAGE.with_suffix(".js")
            body = page.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", "text/javascript; charset=utf-8" if page.suffix == ".js" else "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return None
        return super().do_GET()

    def do_POST(self):
        url = urlparse(self.path)
        if not url.path.startswith("/api/"):
            return self.send_json({"error": "not found"}, 404)
        try:
            data = self.read_json()
        except Exception:
            return self.send_json({"error": "bad request"}, 400)
        return self.api("POST", url.path, data)

    def api(self, method, path, data):
        routes = {
            ("GET", "/api/health"): self.health,
            ("POST", "/api/bottles"): self.post_bottle,
            ("GET", "/api/inbox"): self.inbox,
            ("POST", "/api/reply"): self.post_reply,
            ("GET", "/api/mine"): self.mine,
            ("POST", "/api/report"): self.report,
            ("POST", "/api/block"): self.block,
            ("POST", "/api/forget"): self.forget,
            ("GET", "/api/mod/queue"): self.mod_queue,
            ("POST", "/api/mod/decide"): self.mod_decide,
        }
        fn = routes.get((method, path))
        if not fn:
            return self.send_json({"error": "not found"}, 404)
        try:
            with self.db.lock:
                return fn(data)
        except PermissionError as e:
            return self.send_json({"error": str(e)}, 403)
        except (ValueError, KeyError, TypeError) as e:
            return self.send_json({"error": "bad request", "detail": str(e)}, 400)

    # -- endpoints
    def health(self, q):
        return self.send_json({"ok": True, "service": "mochi-bottles"})

    def post_bottle(self, d):
        who = self.client(d)
        text = str(d.get("text", "")).strip()[:BOTTLE_MAX]
        need = d.get("need") if d.get("need") in NEEDS else "company"
        topic = d.get("topic") if d.get("topic") in TOPICS else ""
        energy = max(1, min(5, int(d.get("energy") or 3)))
        tz = max(-840, min(840, int(d.get("tz") or 0)))
        verdict = check(text, "bottle")
        if not verdict["ok"] and not verdict.get("crisis"):
            return self.send_json({"error": "rejected", "reason": verdict["reason"]}, 400)
        if not self.db.bump(who, "bottle", DAILY_BOTTLES):
            return self.send_json({"error": "rate", "reason": "That's a lot of bottles for one day. The sea will still be here tomorrow. 🌊"}, 429)
        status = "held" if verdict.get("crisis") else "sea"
        b = {"id": "b-" + secrets.token_urlsafe(8), "author": who, "text": text, "energy": energy, "need": need, "topic": topic,
             "tz": tz, "at": time.time(), "status": status, "deliveredTo": [], "crew": False}
        self.db.data["bottles"].append(b)
        self.db.save()
        return self.send_json({"id": b["id"], "status": status, "crisis": status == "held"})

    def inbox(self, q):
        who = self.client(q)
        g = lambda k, default="": (q.get(k) or [default])[0]
        energy = max(1, min(5, int(g("energy", "3") or 3)))
        listener = g("listener") == "1"
        need, topic = g("need"), g("topic")
        tz = int(g("tz", "0") or 0)
        now = time.time()
        today_key = f"{who}:{time.strftime('%Y-%m-%d')}:deliver"
        left = DAILY_DELIVERIES - self.db.data["counters"].get(today_key, 0)
        if left <= 0:
            return self.send_json({"bottles": [], "note": "rest"})
        scored = []
        for b in self.db.data["bottles"]:
            if b["status"] != "sea" or b["author"] == who or who in b["deliveredTo"]:
                continue
            if not b["crew"] and (len(b["deliveredTo"]) >= MAX_READERS or now - b["at"] > BOTTLE_TTL or self.db.blocked(who, b["author"])):
                continue
            s = compat_score(b["energy"], energy, b["need"], listener)
            if s is None:
                continue
            if need and b["need"] == need:
                s += 1.0
            if topic and b["topic"] == topic:
                s += 0.5
            if not b["crew"] and tz_close(b["tz"], tz):
                s += 0.5
            if not b["crew"]:
                s += min((now - b["at"]) / 86400, 1.0) * 0.5 - len(b["deliveredTo"]) * 0.3  # fairness: waiting bottles first
            scored.append((s, b))
        scored.sort(key=lambda x: -x[0])
        picked = [b for _, b in scored[: min(3, left)]]
        for b in picked:
            b["deliveredTo"].append(who)
            self.db.bump(who, "deliver", DAILY_DELIVERIES)
        if picked:
            self.db.save()
        return self.send_json({"bottles": [{"id": b["id"], "text": b["text"], "need": b["need"], "topic": b["topic"], "energy": b["energy"],
                                            "authorRef": b["author"], "crew": b["crew"], "at": int(b["at"] * 1000)} for b in picked]})

    def post_reply(self, d):
        who = self.client(d)
        b = next((x for x in self.db.data["bottles"] if x["id"] == d.get("bottleId")), None)
        if not b or b["status"] not in ("sea",):
            return self.send_json({"error": "gone", "reason": "This bottle has drifted away."}, 404)
        if not b["crew"] and who not in b["deliveredTo"]:
            raise PermissionError("not delivered to you")
        if any(r["bottleId"] == b["id"] and r["author"] == who for r in self.db.data["replies"]):
            return self.send_json({"error": "once", "reason": "You already sent this bottle one kind reply. 💛"}, 409)
        text = str(d.get("text", "")).strip()[:REPLY_MAX]
        verdict = check(text, "reply")
        if not verdict["ok"] and not verdict.get("crisis"):
            return self.send_json({"error": "rejected", "reason": verdict["reason"]}, 400)
        if not self.db.bump(who, "reply", DAILY_REPLIES):
            return self.send_json({"error": "rate", "reason": "You've been very kind today. Rest a little. 💛"}, 429)
        status = "held" if verdict.get("crisis") else ("crew" if b["crew"] else "ok")
        r = {"id": "r-" + secrets.token_urlsafe(8), "bottleId": b["id"], "author": who, "text": text, "at": time.time(), "status": status}
        self.db.data["replies"].append(r)
        self.db.save()
        return self.send_json({"id": r["id"], "status": "held" if status == "held" else "ok", "crisis": status == "held"})

    def mine(self, q):
        who = self.client(q)
        mine = [b for b in self.db.data["bottles"] if b["author"] == who]
        ids = {b["id"] for b in mine}
        reps = [r for r in self.db.data["replies"] if r["bottleId"] in ids and r["status"] == "ok" and not self.db.blocked(who, r["author"])]
        return self.send_json({
            "bottles": [{"id": b["id"], "status": b["status"], "deliveries": len(b["deliveredTo"]),
                         "replyCount": sum(1 for r in reps if r["bottleId"] == b["id"])} for b in mine],
            "replies": [{"id": r["id"], "bottleId": r["bottleId"], "text": r["text"], "at": int(r["at"] * 1000), "authorRef": r["author"]} for r in reps],
        })

    def report(self, d):
        who = self.client(d)
        kind, item_id = d.get("kind"), d.get("id")
        coll = self.db.data["bottles"] if kind == "bottle" else self.db.data["replies"] if kind == "reply" else None
        if coll is None:
            raise ValueError("kind")
        item = next((x for x in coll if x["id"] == item_id), None)
        if item and not item.get("crew"):
            if item["status"] in ("sea", "ok"):
                item["status"] = "review"  # hidden until a moderator looks at it
            self.db.data["reports"].append({"kind": kind, "id": item_id, "by": who, "reason": str(d.get("reason", ""))[:200], "at": time.time()})
            self.db.save()
        return self.send_json({"ok": True})

    def block(self, d):
        who = self.client(d)
        ref = str(d.get("authorRef", ""))[:40]
        if ref and ref != "crew" and not self.db.blocked(who, ref):
            self.db.data["blocks"].append({"by": who, "who": ref, "at": time.time()})
            self.db.save()
        return self.send_json({"ok": True})

    def forget(self, d):
        who = self.client(d)
        data = self.db.data
        nb, nr = len(data["bottles"]), len(data["replies"])
        mine = {b["id"] for b in data["bottles"] if b["author"] == who}
        data["bottles"] = [b for b in data["bottles"] if b["author"] != who]
        data["replies"] = [r for r in data["replies"] if r["author"] != who and r["bottleId"] not in mine]
        data["blocks"] = [x for x in data["blocks"] if x["by"] != who and x["who"] != who]
        data["reports"] = [x for x in data["reports"] if x["by"] != who]
        for b in data["bottles"]:
            if who in b["deliveredTo"]:
                b["deliveredTo"] = [x for x in b["deliveredTo"] if x != who]
        data["counters"] = {k: v for k, v in data["counters"].items() if not k.startswith(who + ":")}
        self.db.save()
        return self.send_json({"ok": True, "deletedBottles": nb - len(data["bottles"]), "deletedReplies": nr - len(data["replies"])})

    # -- moderation (human review queue)
    def need_mod(self, d):
        tok = d.get("token")
        if isinstance(tok, list):
            tok = tok[0] if tok else ""
        if not tok or not secrets.compare_digest(str(tok), self.mod_token):
            raise PermissionError("moderator token required")

    def mod_queue(self, q):
        self.need_mod(q)
        data = self.db.data
        def reports_for(kind, item_id):
            return [x["reason"] for x in data["reports"] if x["kind"] == kind and x["id"] == item_id]
        items = []
        for b in data["bottles"]:
            if b["status"] in ("held", "review"):
                items.append({"kind": "bottle", "id": b["id"], "text": b["text"], "status": b["status"], "at": int(b["at"] * 1000),
                              "energy": b["energy"], "need": b["need"], "reports": reports_for("bottle", b["id"])})
        for r in data["replies"]:
            if r["status"] in ("held", "review"):
                items.append({"kind": "reply", "id": r["id"], "text": r["text"], "status": r["status"], "at": int(r["at"] * 1000),
                              "reports": reports_for("reply", r["id"])})
        crew_notes = [{"text": r["text"], "at": int(r["at"] * 1000)} for r in data["replies"] if r["status"] == "crew"][-20:]
        stats = {"bottlesAtSea": sum(1 for b in data["bottles"] if b["status"] == "sea" and not b["crew"]),
                 "replies": sum(1 for r in data["replies"] if r["status"] == "ok")}
        return self.send_json({"items": sorted(items, key=lambda x: x["at"]), "crewNotes": crew_notes, "stats": stats})

    def mod_decide(self, d):
        self.need_mod(d)
        kind, item_id, action = d.get("kind"), d.get("id"), d.get("action")
        coll = self.db.data["bottles"] if kind == "bottle" else self.db.data["replies"]
        item = next((x for x in coll if x["id"] == item_id), None)
        if not item or action not in ("approve", "remove"):
            raise ValueError("unknown item or action")
        item["status"] = ("sea" if kind == "bottle" else "ok") if action == "approve" else "removed"
        self.db.data["reports"] = [x for x in self.db.data["reports"] if not (x["kind"] == kind and x["id"] == item_id)]
        self.db.save()
        return self.send_json({"ok": True, "status": item["status"]})


def lan_ip() -> str:
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("10.255.255.255", 1))
            return s.getsockname()[0]
    except OSError:
        return "127.0.0.1"


def main():
    ap = argparse.ArgumentParser(description="Mochi web app + bottle server")
    ap.add_argument("--port", type=int, default=int(os.environ.get("PORT", 8000)))
    ap.add_argument("--lan", action="store_true", help="listen on all interfaces so phones on the same Wi-Fi can join")
    args = ap.parse_args()
    Handler.db = DB(DB_FILE)
    Handler.mod_token = os.environ.get("MOCHI_MOD_TOKEN") or secrets.token_urlsafe(12)
    host = "0.0.0.0" if args.lan else "127.0.0.1"
    httpd = ThreadingHTTPServer((host, args.port), Handler)
    print("🐱 Mochi is awake!")
    print(f"   App:         http://localhost:{args.port}/")
    if args.lan:
        print(f"   On your LAN: http://{lan_ip()}:{args.port}/")
    print(f"   Moderation:  http://localhost:{args.port}/moderation   (token: {Handler.mod_token})")
    print("   Data file:  ", DB_FILE)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nMochi curls up for a nap. Bye! 💤")


if __name__ == "__main__":
    main()
