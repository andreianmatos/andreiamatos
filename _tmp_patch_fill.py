from pathlib import Path

p = Path(r"c:\Users\anmatos\Documents\GitHub\andreiamatos\vendor\page-flip.browser.js")
t = p.read_text(encoding="utf-8")
old = t
t = t.replace("#ecdec1", "#f4f1ea")
t = t.replace('fillStyle="rgb(236, 222, 193)"', 'fillStyle="rgb(244, 241, 234)"')
if t == old:
    raise SystemExit("no replacements")
p.write_text(t, encoding="utf-8")
print("patched")
print("f4f1ea", t.count("#f4f1ea"))
print("ecdec1", t.count("#ecdec1"))
