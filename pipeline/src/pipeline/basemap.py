"""The ground under the 2D track map (realistic UI spec): each circuit's real surroundings seen
from above, drawn from its scenery (data/scenery, the `scenery` step) as an SVG in metres.

- Hill shading from the scenery's height grid, so hills and valleys read.
- Land cover (forest, grass, farmland, scrub, sand, gravel, run-off, town, water), trees,
  streams and roads.
- Buildings with a soft shadow.

The track itself isn't drawn: the game draws its own outline over the image. The web app's
`scripts/basemap.mjs` renders each SVG to an image in apps/web/public/basemap/.

data/basemap/index.json says, per circuit, the image's size in metres, and per race, the SVG
matrix that places the image (metres) under the race's outline (map units): the inverse of the
scenery step's similarity fit.
"""

from __future__ import annotations

import base64
import io
import json
import math
from pathlib import Path

import numpy as np
from PIL import Image

from . import paths
from .scenery import CIRCUITS, SCENERY_DIR

BASEMAP_DIR = paths.DATA_DIR / "basemap"
SVG_DIR = paths.CACHE_DIR / "basemap"

# Colours per ground type: the open land and each cover. Natural, a little muted, so the
# track and the cars stay the brightest things on the map.
PALETTE = {
    "park": {
        "base": "#8e9a63",
        "grass": "#7f9454",
        "farm": "#a7a46e",
        "scrub": "#6e7f47",
        "forest": "#2f4a2b",
        "forest_edge": "#3b5a33",
        "tree": "#26401f",
        "sand": "#d2bf8e",
    },
    "forest": {
        "base": "#86935c",
        "grass": "#7a8f50",
        "farm": "#a3a06a",
        "scrub": "#647a42",
        "forest": "#2b4527",
        "forest_edge": "#37552f",
        "tree": "#223b1c",
        "sand": "#d2bf8e",
    },
    "dry": {
        "base": "#a4a06e",
        "grass": "#8f9a5b",
        "farm": "#b5ab78",
        "scrub": "#7d8650",
        "forest": "#3c5232",
        "forest_edge": "#4a6339",
        "tree": "#33492a",
        "sand": "#d6c290",
    },
    "desert": {
        "base": "#cdb98f",
        "grass": "#93a061",
        "farm": "#b9ad7d",
        "scrub": "#a8a06c",
        "forest": "#55663c",
        "forest_edge": "#64764a",
        "tree": "#4c5f35",
        "sand": "#dcc89a",
    },
}
COMMON = {
    "urban": "#a29d93",
    "water": "#55798a",
    "gravel": "#cdb98f",
    "asphalt": "#5f6366",
    "stream": "#5f8494",
    "road_edge": "#5d5a52",
    "road": "#d2cbbb",
    "building": "#dcd7ce",
    "building_edge": "#9c958a",
    "stand": "#c9c3b8",
}
# Shadows under forests and buildings, a dappled canopy, and a fine grain over everything.
DEFS = (
    "<defs>"
    '<filter id="shadow" x="-5%" y="-5%" width="110%" height="110%">'
    '<feDropShadow dx="1.6" dy="2.2" stdDeviation="1.4" flood-color="#000" flood-opacity="0.4"/>'
    "</filter>"
    '<filter id="canopy" x="-2%" y="-2%" width="104%" height="104%">'
    '<feTurbulence type="fractalNoise" baseFrequency="0.08" numOctaves="3" seed="7" result="n"/>'
    '<feColorMatrix in="n" type="matrix" '
    'values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.1 0.75" result="dots"/>'
    '<feComposite in="dots" in2="SourceGraphic" operator="in" result="d"/>'
    '<feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="d"/></feMerge>'
    "</filter>"
    '<filter id="grain" x="0" y="0" width="100%" height="100%">'
    '<feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="2" seed="4"/>'
    '<feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.12 0"/>'
    "</filter>"
    "</defs>"
)
PX_PER_M = 1.25  # the image's detail, for the battle camera close up
MAX_PX = 4096


def _ring(pts: list[list[float]]) -> str:
    return "M" + " ".join(f"{x:.1f} {y:.1f}" for x, y in pts) + "Z"


def _line(pts: list[list[float]]) -> str:
    return "M" + " ".join(f"{x:.1f} {y:.1f}" for x, y in pts)


def _heights(s: dict) -> np.ndarray:
    g = s["grid"]
    raw = np.frombuffer(base64.b64decode(g["h"]), dtype="<u2").astype(np.float32) / 10
    return raw.reshape(g["nz"], g["nx"])


def hillshade(h: np.ndarray, step: float, exaggerate: float = 2.2) -> np.ndarray:
    """Light from the north-west, 0 (shadow) to 1 (lit); flat ground is about 0.71."""
    dy, dx = np.gradient(h * exaggerate, step)
    slope = np.arctan(np.hypot(dx, dy))
    aspect = np.arctan2(-dx, dy)
    az, alt = math.radians(315), math.radians(45)
    shade = np.sin(alt) * np.cos(slope) + np.cos(alt) * np.sin(slope) * np.cos(az - aspect)
    return np.clip(shade, 0, 1)


def _shade_png(h: np.ndarray, step: float) -> str:
    """The hill shading as a grey PNG for a multiply blend: flat ground white, slopes away from
    the light darker, slopes facing it a touch lighter than flat."""
    s = hillshade(h, step)
    flat = math.sin(math.radians(45))
    tone = np.clip(1 - (flat - s) * 0.9, 0.45, 1.0)
    img = Image.fromarray((tone * 255).astype(np.uint8), "L")
    buf = io.BytesIO()
    img.save(buf, "PNG", optimize=True)
    return base64.b64encode(buf.getvalue()).decode()


# Roof tones (a building's is picked from its outline, so it stays the same on every run), the
# grandstands' seat colours, and how the barriers are drawn.
ROOFS = ["#dcd7ce", "#d0cbc1", "#c3c6c6", "#d6cab8", "#bdb8ae", "#cfd2cf"]
SEATS = ["#3a6690", "#8c3a3f", "#5f6a73", "#36795c", "#7a6a3a"]
CONCRETE = "#bfbab0"
# kind: (colour, width in m, dash). Drawn about twice their real width, so they read on a
# whole-lap view (at about a pixel and a half a metre).
BARRIERS = {
    "wall": ("#ece9e2", 2.2, None),
    "retaining_wall": ("#dcd8ce", 2.2, None),
    "guard_rail": ("#d3dade", 1.6, None),
    "fence": ("#262b2e", 1.0, "3 1.6"),
}
SUN = (0.42, 0.58)  # m of shadow, per m of height, along x and y (the light from the north-west)


def _hash(pts: list[list[float]]) -> int:
    x, y = pts[0]
    return int(abs(x * 7.31 + y * 3.17) * 10) % 9973


def _axis(pts: list[list[float]]) -> float:
    """The angle (degrees) of a footprint's long side: its principal axis."""
    a = np.asarray(pts, float)
    a = a - a.mean(0)
    _, vecs = np.linalg.eigh(a.T @ a)
    vx, vy = vecs[:, -1]
    return math.degrees(math.atan2(vy, vx))


def _buildings(s: dict, pal: dict) -> tuple[str, str]:
    """Buildings and grandstands from above: each casts a shadow as long as it's tall; roofs
    in a few real tones with a darker rim; a grandstand shows its rows of seats, running along
    its length. Returns (pattern defs, the drawing)."""
    defs: list[str] = []
    shadows: list[str] = []
    roofs: list[str] = []
    for k, b in enumerate(s.get("buildings", [])):
        pts = b["p"]
        if len(pts) < 3:
            continue
        rise = min(max(b.get("h", 6) - b.get("min", 0), 2.5), 45)
        dx, dy = SUN[0] * rise, SUN[1] * rise
        ring = _ring(pts)
        # The shadow: the footprint pushed away from the sun, joined to it by its own sweep
        # (the footprint drawn at a few steps along the way).
        steps = 4
        for i in range(1, steps + 1):
            f = i / steps
            shadows.append(f'<path d="{ring}" transform="translate({dx * f:.1f} {dy * f:.1f})"/>')
        if b.get("stand"):
            seat = SEATS[_hash(pts) % len(SEATS)]
            pid = f"seats{k}"
            defs.append(
                f'<pattern id="{pid}" patternUnits="userSpaceOnUse" width="2.4" height="2.4" '
                f'patternTransform="rotate({_axis(pts):.1f})">'
                f'<rect width="2.4" height="2.4" fill="{CONCRETE}"/>'
                f'<rect width="2.4" height="1.5" fill="{seat}"/></pattern>'
            )
            roofs.append(
                f'<path d="{ring}" fill="url(#{pid})" stroke="#6f6a62" stroke-width="0.9"/>'
            )
        else:
            roof = ROOFS[_hash(pts) % len(ROOFS)]
            roofs.append(
                f'<path d="{ring}" fill="{roof}" stroke="{pal["building_edge"]}" '
                f'stroke-width="0.9"/>'
            )
    drawing = (
        f'<g fill="#000" opacity="0.3" filter="url(#soft-shadow)">{"".join(shadows)}</g>'
        f"<g>{''.join(roofs)}</g>"
    )
    return "".join(defs), drawing


def _barriers(s: dict) -> str:
    """The real barriers: concrete walls, armco and catch fencing, each its own line."""
    out = []
    for kind, (colour, width, dash) in BARRIERS.items():
        d = "".join(_line(b["p"]) for b in s.get("barriers", []) if b["kind"] == kind)
        if not d:
            continue
        dashes = f' stroke-dasharray="{dash}"' if dash else ""
        if kind in ("wall", "retaining_wall", "guard_rail"):
            out.append(
                f'<path d="{d}" fill="none" stroke="#000" stroke-opacity="0.35" '
                f'stroke-width="{width + 0.9:.1f}" stroke-linejoin="round" '
                f'transform="translate(0.4 0.6)"/>'
            )
        out.append(
            f'<path d="{d}" fill="none" stroke="{colour}" stroke-width="{width}" '
            f'stroke-linejoin="round"{dashes}/>'
        )
    return "".join(out)


def svg(circuit: str) -> str:
    s = json.loads((SCENERY_DIR / f"{circuit}.json").read_text())
    w, h = s["size"]
    pal = {**COMMON, **PALETTE[s.get("ground", "park")]}
    areas = s["areas"]

    def area(kind: str, fill: str, extra: str = "") -> str:
        polys = areas.get(kind) or []
        if not polys:
            return ""
        d = "".join(_ring(p) for p in polys if len(p) >= 3)
        return f'<path d="{d}" fill="{fill}" fill-rule="evenodd" {extra}/>'

    g = s["grid"]
    heights = _heights(s)
    shade = _shade_png(heights, g["step"])
    gw, gh = g["nx"] * g["step"], g["nz"] * g["step"]

    trees = "".join(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="2.6"/>' for x, y in s.get("trees", []))
    roads = s.get("roads", [])
    road_edge = "".join(
        f'<path d="{_line(r["p"])}" stroke-width="{r["w"] + 1.6:.1f}"/>' for r in roads
    )
    road = "".join(f'<path d="{_line(r["p"])}" stroke-width="{r["w"]:.1f}"/>' for r in roads)
    streams = "".join(
        f'<path d="{_line(r["p"])}" stroke-width="{max(r["w"], 2):.1f}"/>'
        for r in s.get("streams", [])
    )
    seat_defs, buildings = _buildings(s, pal)

    head = (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:.1f} {h:.1f}" '
        f'width="{w:.0f}" height="{h:.0f}">'
    )
    line = 'fill="none" stroke-linecap="round" stroke-linejoin="round"'
    shading = (
        f'<image href="data:image/png;base64,{shade}" x="0" y="0" width="{gw:.1f}" '
        f'height="{gh:.1f}" preserveAspectRatio="none" style="mix-blend-mode:multiply"/>'
    )
    return f"""{head}
{DEFS}
<defs><filter id="soft-shadow" x="-5%" y="-5%" width="110%" height="110%">\
<feGaussianBlur stdDeviation="0.9"/></filter>{seat_defs}</defs>
<rect width="{w:.1f}" height="{h:.1f}" fill="{pal["base"]}"/>
{area("farm", pal["farm"])}
{area("grass", pal["grass"])}
{area("scrub", pal["scrub"])}
{area("sand", pal["sand"])}
{area("urban", pal["urban"])}
<g filter="url(#shadow)">{area("forest", pal["forest"], 'filter="url(#canopy)"')}</g>
{area("forest", "none", f'stroke="{pal["forest_edge"]}" stroke-width="3" opacity="0.7"')}
<g fill="{pal["tree"]}">{trees}</g>
{area("water", pal["water"])}
{area("gravel", pal["gravel"])}
{area("asphalt", pal["asphalt"])}
<g stroke="{pal["stream"]}" {line}>{streams}</g>
<g stroke="{pal["road_edge"]}" {line}>{road_edge}</g>
<g stroke="{pal["road"]}" {line}>{road}</g>
{shading}
{_barriers(s)}
{buildings}
<rect width="{w:.1f}" height="{h:.1f}" filter="url(#grain)"/>
</svg>"""


def placement(race: dict) -> list[float]:
    """The SVG matrix taking the image's metres to the race outline's map units: the inverse
    of world = M · p + t."""
    a, b, c, d = race["m"]
    tx, ty = race["t"]
    det = a * d - b * c
    ia, ib, ic, id_ = d / det, -b / det, -c / det, a / det
    e = -(ia * tx + ib * ty)
    f = -(ic * tx + id_ * ty)
    # SVG's matrix(a b c d e f) maps (x, y) to (a x + c y + e, b x + d y + f).
    return [round(v, 6) for v in (ia, ic, ib, id_, e, f)]


def write(circuits: list[str] | None = None) -> Path:
    SVG_DIR.mkdir(parents=True, exist_ok=True)
    BASEMAP_DIR.mkdir(parents=True, exist_ok=True)
    index_path = BASEMAP_DIR / "index.json"
    index = (
        json.loads(index_path.read_text()) if index_path.exists() else {"circuits": {}, "races": {}}
    )
    for c in circuits or list(CIRCUITS):
        src = SCENERY_DIR / f"{c}.json"
        if not src.exists():
            continue
        s = json.loads(src.read_text())
        w, h = s["size"]
        scale = min(PX_PER_M, MAX_PX / max(w, h))
        (SVG_DIR / f"{c}.svg").write_text(svg(c))
        index["circuits"][c] = {
            "w": round(w, 1),
            "h": round(h, 1),
            "px": [round(w * scale), round(h * scale)],
            "src": f"/basemap/{c}.webp",
            # The open land's colour: the image fades into it at its edges, and the map fills
            # the rest of its box with it.
            "base": PALETTE[s.get("ground", "park")]["base"],
        }
        for race_id, race in s["races"].items():
            index["races"][race_id] = {
                "circuit": c,
                "matrix": placement(race),
                "err": race["err"],
            }
    index["circuits"] = dict(sorted(index["circuits"].items()))
    index["races"] = dict(sorted(index["races"].items()))
    index_path.write_text(json.dumps(index, indent=1) + "\n")
    return index_path


WEB_DIR = paths.REPO_ROOT / "apps" / "web"


def images(circuits: list[str] | None = None, quality: int = 74) -> list[Path]:
    """Render the SVGs (scripts/basemap.mjs, a headless browser) and save each as a WebP in
    apps/web/public/basemap/."""
    import subprocess

    names = circuits or [p.stem for p in sorted(SVG_DIR.glob("*.svg"))]
    subprocess.run(["node", "scripts/basemap.mjs", *names], cwd=WEB_DIR, check=True)
    out_dir = WEB_DIR / "public" / "basemap"
    out_dir.mkdir(parents=True, exist_ok=True)
    index = json.loads((BASEMAP_DIR / "index.json").read_text())
    out = []
    for c in names:
        png = SVG_DIR / f"{c}.png"
        if not png.exists():
            continue
        img = fade(Image.open(png).convert("RGB"), index["circuits"][c]["base"])
        dst = out_dir / f"{c}.webp"
        img.save(dst, "WEBP", quality=quality, method=6)
        out.append(dst)
    return out


def fade(img: Image.Image, base: str, share: float = 0.09) -> Image.Image:
    """Blend the image's edges into the open land's colour, so its border doesn't show where
    the map is wider than the scenery."""
    a = np.asarray(img).astype(np.float32)
    h, w = a.shape[:2]
    band = max(8, round(min(w, h) * share))
    ys = np.minimum(np.arange(h), np.arange(h)[::-1])[:, None]
    xs = np.minimum(np.arange(w), np.arange(w)[::-1])[None, :]
    t = np.clip(np.minimum(xs, ys) / band, 0, 1)
    t = t * t * (3 - 2 * t)
    rgb = np.array([int(base[i : i + 2], 16) for i in (1, 3, 5)], dtype=np.float32)
    a = a * t[..., None] + rgb * (1 - t[..., None])
    return Image.fromarray(a.astype(np.uint8))
