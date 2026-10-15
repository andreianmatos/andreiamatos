from pathlib import Path

t = Path(r"c:\Users\anmatos\Documents\GitHub\andreiamatos\vendor\page-flip.browser.js").read_text(
    encoding="utf-8"
)
print("f4f1ea", t.count("#f4f1ea"))
print("255, 255, 255", t.count("rgb(255, 255, 255)"))
idx = t.find('fillStyle="rgb(255, 255, 255)"')
print("idx", idx)
if idx >= 0:
    print(t[idx - 180 : idx + 180])
