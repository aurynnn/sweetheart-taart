"""Generates the e-mail artwork in public/email/ (Python 3 + Pillow).

    python3 scripts/email-art/generate.py && npm run upload:email-assets

E-mail clients only reliably show PNG/JPG/GIF (no SVG, no CSS animation), so the
animations are small looping GIFs drawn in the website's colours. Everything is drawn
at SS× resolution and scaled down for smooth edges.
"""
import math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parents[2] / 'public' / 'email'
OUT.mkdir(parents=True, exist_ok=True)

SS = 3                      # supersampling factor
PINK = (232, 120, 138)
PINK_DARK = (212, 90, 106)
PINK_LIGHT = (242, 160, 170)
BLUSH = (253, 238, 240)
CREAM = (255, 244, 246)
WHITE = (255, 255, 255)
GOLD = (245, 184, 61)
RED = (214, 48, 72)
SPRINKLES = [(232, 120, 138), (255, 214, 165), (189, 224, 199), (205, 180, 245), (212, 90, 106), (135, 196, 235)]
BG = WHITE                  # animations sit in a white round "sticker" in the mail


def ease_out_back(t):
    c1, c3 = 1.70158, 2.70158
    return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2


def blend(c, a, bg=BG):
    """Colour c at opacity a over the background (GIFs have no smooth transparency)."""
    return tuple(int(bg[i] + (c[i] - bg[i]) * a) for i in range(3))


def heart(d, cx, cy, size, fill):
    pts = []
    for i in range(60):
        t = math.pi * 2 * i / 60
        x = 16 * math.sin(t) ** 3
        y = 13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t)
        pts.append((cx + x * size / 32, cy - y * size / 32))
    d.polygon(pts, fill=fill)


def star(d, cx, cy, r, fill, points=5, inner=0.45, rot=-math.pi / 2):
    pts = []
    for i in range(points * 2):
        rr = r if i % 2 == 0 else r * inner
        a = rot + math.pi * i / points
        pts.append((cx + rr * math.cos(a), cy + rr * math.sin(a)))
    d.polygon(pts, fill=fill)


def sparkle(d, cx, cy, r, fill):
    star(d, cx, cy, r, fill, points=4, inner=0.28, rot=0)


def save_gif(frames, name, size, ms=70, loop=0):
    """loop=0 → repeat forever; loop=None → play once and stay on the last frame"""
    small = [f.resize(size, Image.LANCZOS).convert('P', palette=Image.ADAPTIVE, colors=96) for f in frames]
    extra = {} if loop is None else {'loop': loop}
    small[0].save(OUT / name, save_all=True, append_images=small[1:], duration=ms, optimize=True, disposal=2, **extra)
    print('✓', name, f'{(OUT / name).stat().st_size // 1024} KB')


def cupcake(d, cx, cy, s=1.0, squash=1.0):
    """A cupcake like on the website: pleated pink wrapper, swirl, cherry, sprinkles."""
    k = SS * s
    base = cy + 40 * k
    # shadow
    d.ellipse((cx - 62 * k, base + 48 * k, cx + 62 * k, base + 62 * k), fill=(245, 225, 228))
    # wrapper
    top_w, bot_w, h = 70 * k, 52 * k, 58 * k
    d.polygon([(cx - top_w, base), (cx + top_w, base), (cx + bot_w, base + h), (cx - bot_w, base + h)], fill=PINK_LIGHT)
    for i in range(-5, 6):
        x1 = cx + i * top_w / 5.5
        x2 = cx + i * bot_w / 5.5
        d.line((x1, base + 3 * k, x2, base + h - 2 * k), fill=PINK, width=max(1, int(3 * k)))
    # frosting swirl (squash for the bounce)
    fy = lambda v: base - v * k * squash
    d.ellipse((cx - 82 * k, fy(28), cx + 82 * k, fy(-14)), fill=CREAM)
    d.ellipse((cx - 64 * k, fy(62), cx + 64 * k, fy(12)), fill=(255, 236, 240))
    d.ellipse((cx - 44 * k, fy(92), cx + 44 * k, fy(46)), fill=CREAM)
    d.ellipse((cx - 22 * k, fy(114), cx + 22 * k, fy(80)), fill=(255, 236, 240))
    # sprinkles
    spots = [(-55, 8), (-30, 20), (5, 4), (40, 18), (60, 2), (-45, 40), (-10, 38), (25, 48), (-22, 68), (15, 72), (-5, 96)]
    for i, (sx, sy) in enumerate(spots):
        x, y = cx + sx * k, fy(sy)
        ang = (i * 47) % 180
        dx, dy = 7 * k * math.cos(math.radians(ang)), 7 * k * math.sin(math.radians(ang))
        d.line((x - dx, y - dy, x + dx, y + dy), fill=SPRINKLES[i % len(SPRINKLES)], width=int(5 * k))
    # cherry
    d.arc((cx + 2 * k, fy(150), cx + 34 * k, fy(108)), 190, 280, fill=(92, 122, 58), width=int(4 * k))
    d.ellipse((cx - 14 * k, fy(136), cx + 14 * k, fy(108)), fill=RED)
    d.ellipse((cx - 7 * k, fy(131), cx - 1 * k, fy(125)), fill=(255, 150, 160))


def anim_cupcake():
    """Aanvraag ontvangen: bouncing cupcake with hearts floating up."""
    W = H = 360 * SS
    frames, n = [], 28
    hearts = [(-110, 0.0, 26), (95, 0.33, 22), (-60, 0.55, 18), (120, 0.75, 20), (40, 0.15, 16)]
    for f in range(n):
        t = f / n
        im = Image.new('RGB', (W, H), BG)
        d = ImageDraw.Draw(im)
        for hx, off, size in hearts:
            p = (t + off) % 1
            y = H * 0.78 - p * H * 0.6
            x = W / 2 + hx * SS + math.sin(p * math.pi * 2) * 10 * SS
            heart(d, x, y, size * SS * (0.7 + 0.3 * p), blend(PINK, 1 - p ** 1.6))
        bounce = abs(math.sin(t * math.pi * 2))
        cupcake(d, W / 2, H * 0.47 - bounce * 8 * SS, s=1.05, squash=1 - 0.04 * (1 - bounce))
        for i, (sx, sy) in enumerate([(-130, -110), (135, -80), (-120, 40)]):
            a = (math.sin((t + i / 3) * math.pi * 2) + 1) / 2
            sparkle(d, W / 2 + sx * SS, H / 2 + sy * SS, (6 + 8 * a) * SS, blend(GOLD, a))
        frames.append(im)
    save_gif(frames, 'anim-cupcake.gif', (180, 180))


def anim_cake():
    """Bevestigd: two-tier cake, flickering candles, falling confetti."""
    W = H = 360 * SS
    frames, n = [], 24
    confetti = [((i * 67) % 360, (i * 53) % 100 / 100, SPRINKLES[i % len(SPRINKLES)]) for i in range(26)]
    for f in range(n):
        t = f / n
        im = Image.new('RGB', (W, H), BG)
        d = ImageDraw.Draw(im)
        for x, off, col in confetti:
            p = (t + off) % 1
            cx, cy = (x + 10) * SS * 0.95, p * H
            ang = (p * 720 + x) % 360
            dx, dy = 8 * SS * math.cos(math.radians(ang)), 4 * SS * math.sin(math.radians(ang))
            d.polygon([(cx - dx, cy - dy), (cx + dy, cy - dx), (cx + dx, cy + dy), (cx - dy, cy + dx)], fill=blend(col, 0.9))
        cx, base = W / 2, H * 0.84
        d.ellipse((cx - 130 * SS, base - 12 * SS, cx + 130 * SS, base + 14 * SS), fill=(236, 236, 240))
        d.rounded_rectangle((cx - 105 * SS, base - 90 * SS, cx + 105 * SS, base), 16 * SS, fill=CREAM)
        d.rounded_rectangle((cx - 105 * SS, base - 90 * SS, cx + 105 * SS, base - 62 * SS), 16 * SS, fill=PINK_LIGHT)
        for i in range(-4, 5):
            d.ellipse((cx + i * 23 * SS - 11 * SS, base - 72 * SS, cx + i * 23 * SS + 11 * SS, base - 50 * SS), fill=PINK_LIGHT)
        d.rounded_rectangle((cx - 70 * SS, base - 160 * SS, cx + 70 * SS, base - 90 * SS), 14 * SS, fill=(255, 236, 240))
        d.rounded_rectangle((cx - 70 * SS, base - 160 * SS, cx + 70 * SS, base - 138 * SS), 14 * SS, fill=PINK)
        for i in range(-3, 4):
            d.ellipse((cx + i * 20 * SS - 9 * SS, base - 146 * SS, cx + i * 20 * SS + 9 * SS, base - 128 * SS), fill=PINK)
        for i, off in enumerate((-40, 0, 40)):
            x = cx + off * SS
            d.rounded_rectangle((x - 6 * SS, base - 205 * SS, x + 6 * SS, base - 160 * SS), 3 * SS, fill=[(135, 196, 235), PINK_DARK, (189, 224, 199)][i])
            flick = 1 + 0.18 * math.sin((t * 4 + i * 0.7) * math.pi * 2)
            d.ellipse((x - 9 * SS, base - (228 + 8 * flick) * SS, x + 9 * SS, base - 203 * SS), fill=GOLD)
            d.ellipse((x - 4 * SS, base - (219 + 4 * flick) * SS, x + 4 * SS, base - 207 * SS), fill=(255, 238, 170))
        frames.append(im)
    save_gif(frames, 'anim-cake.gif', (180, 180))


def anim_star_row():
    """Review: 5 separate star GIFs (so each star is its own link). They PLAY ONCE:
    the stars are filled from the very first frame (Outlook only shows frame 1),
    pop one after another, star 5 twinkles, and they stay filled — so there is never
    an empty moment and people can tap whenever they like (also on phones)."""
    W = 120 * SS
    n = 30
    for idx in range(5):
        frames = []
        for f in range(n):
            t = f / n
            im = Image.new('RGB', (W, W), BLUSH)  # same pink as the rating row in the mail
            d = ImageDraw.Draw(im)
            start = 0.1 + idx * 0.1
            p = min(1, max(0, (t - start) / 0.22))
            sc = 0.72 + 0.28 * ease_out_back(p)          # filled throughout, grows with a bounce
            star(d, W / 2, W / 2 + 4 * SS, 48 * SS * sc, GOLD)
            star(d, W / 2 - 10 * SS * sc, W / 2 - 8 * SS, 12 * SS * sc, (255, 225, 150))
            if idx == 4 and t > 0.72:
                a = math.sin((t - 0.72) / 0.28 * math.pi)
                sparkle(d, W / 2 + 40 * SS, W / 2 - 38 * SS, (4 + 10 * a) * SS, blend(GOLD, a, BLUSH))
            frames.append(im)
        frames.append(frames[-1].copy())  # clean final frame (no sparkle) that stays
        save_gif(frames, f'star-{idx + 1}.gif', (60, 60), ms=45, loop=None)


def anim_slice():
    """Hoe was je taart: a slice of layered cake on a plate, a fork taking a bite,
    little hearts rising — "mmm!"."""
    W = H = 360 * SS
    frames, n = [], 28
    for f in range(n):
        t = f / n
        im = Image.new('RGB', (W, H), BG)
        d = ImageDraw.Draw(im)
        cx, base = W / 2 - 4 * SS, H * 0.72
        # plate
        d.ellipse((cx - 140 * SS, base - 8 * SS, cx + 160 * SS, base + 40 * SS), fill=(238, 238, 243))
        d.ellipse((cx - 115 * SS, base - 2 * SS, cx + 135 * SS, base + 28 * SS), fill=(250, 250, 252))
        # slice (side view wedge): layers of sponge / cream / pink mousse, frosting on top
        tip_x, back_x = cx - 110 * SS, cx + 95 * SS
        layers = [(0, 34, (240, 205, 160)), (34, 46, WHITE), (46, 80, PINK_LIGHT), (80, 92, WHITE), (92, 126, (240, 205, 160))]
        for y0, y1, col in layers:
            y0p, y1p = base - y0 * SS, base - y1 * SS
            d.polygon([(tip_x + y0 * 0.55 * SS, y0p), (back_x, y0p), (back_x, y1p), (tip_x + y1 * 0.55 * SS, y1p)], fill=col)
        top_y = base - 126 * SS
        d.polygon([(tip_x + 126 * 0.55 * SS, top_y), (back_x, top_y), (back_x + 10 * SS, top_y + 8 * SS), (back_x, top_y + 14 * SS), (tip_x + 130 * 0.55 * SS, top_y + 12 * SS)], fill=PINK)
        d.rounded_rectangle((back_x - 4 * SS, top_y, back_x + 12 * SS, base), 6 * SS, fill=PINK)  # frosted back
        # strawberry on top
        sx, sy = cx + 40 * SS, top_y - 16 * SS
        d.ellipse((sx - 20 * SS, sy - 16 * SS, sx + 20 * SS, sy + 18 * SS), fill=RED)
        for k in range(5):
            d.ellipse((sx - 12 * SS + k * 6 * SS, sy - 2 * SS + (k % 2) * 8 * SS, sx - 10 * SS + k * 6 * SS, sy + (k % 2) * 8 * SS), fill=(255, 220, 120))
        d.polygon([(sx - 12 * SS, sy - 14 * SS), (sx, sy - 26 * SS), (sx + 12 * SS, sy - 14 * SS), (sx, sy - 10 * SS)], fill=(92, 160, 70))
        # fork: comes in, dips into the tip, goes back out
        dip = max(0.0, math.sin(t * math.pi * 2))
        fx, fy = tip_x + 20 * SS + (1 - dip) * 60 * SS, base - (150 - 70 * dip) * SS
        fork = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        fd = ImageDraw.Draw(fork)
        fd.rounded_rectangle((fx - 5 * SS, fy - 120 * SS, fx + 5 * SS, fy - 30 * SS), 4 * SS, fill=(190, 196, 206, 255))
        fd.rounded_rectangle((fx - 20 * SS, fy - 34 * SS, fx + 20 * SS, fy - 22 * SS), 5 * SS, fill=(190, 196, 206, 255))
        for k in range(4):
            fd.rounded_rectangle((fx - 20 * SS + k * 12 * SS, fy - 26 * SS, fx - 13 * SS + k * 12 * SS, fy + 6 * SS), 3 * SS, fill=(190, 196, 206, 255))
        fork = fork.rotate(-28, center=(fx, fy), resample=Image.BICUBIC)
        im.paste(fork, (0, 0), fork)
        # hearts rising after the bite
        for i, off in enumerate((0.0, 0.3, 0.6)):
            p = (t + off) % 1
            hx = cx + (60 + i * 38) * SS + math.sin(p * 6) * 6 * SS
            hy = top_y - 40 * SS - p * 110 * SS
            heart(d, hx, hy, (14 + 6 * p) * SS, blend([PINK, PINK_DARK, PINK_LIGHT][i], 1 - p ** 1.5))
        frames.append(im)
    save_gif(frames, 'anim-slice.gif', (180, 180))


def pattern_tile():
    """Seamless tile of soft sprinkles & hearts for the e-mail header background."""
    W = 240
    im = Image.new('RGBA', (W * SS, W * SS), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    rng = [(23, 31, 0), (150, 20, 1), (205, 110, 2), (70, 150, 3), (130, 200, 4), (30, 215, 5), (190, 175, 0), (100, 80, 1)]
    for i, (x, y, c) in enumerate(rng):
        x, y = x * SS, y * SS
        if i % 3 == 0:
            heart(d, x, y, 12 * SS, (255, 255, 255, 45))
        else:
            ang = math.radians((i * 53) % 180)
            dx, dy = 8 * SS * math.cos(ang), 8 * SS * math.sin(ang)
            d.line((x - dx, y - dy, x + dx, y + dy), fill=(255, 255, 255, 55), width=4 * SS)
    im.resize((W, W), Image.LANCZOS).save(OUT / 'pattern.png', optimize=True)
    print('✓ pattern.png')


def anim_bell():
    """Herinnering: a bell that rings, with sound arcs."""
    W = H = 320 * SS
    frames, n = [], 24
    for f in range(n):
        t = f / n
        im = Image.new('RGB', (W, H), BG)
        swing = math.sin(t * math.pi * 4) * (18 if t < 0.5 else 0)
        bell = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        b = ImageDraw.Draw(bell)
        cx, cy = W / 2, H / 2
        b.ellipse((cx - 14 * SS, cy - 112 * SS, cx + 14 * SS, cy - 84 * SS), fill=PINK_DARK + (255,))
        b.pieslice((cx - 78 * SS, cy - 96 * SS, cx + 78 * SS, cy + 60 * SS), 180, 360, fill=PINK + (255,))
        b.polygon([(cx - 78 * SS, cy - 18 * SS), (cx + 78 * SS, cy - 18 * SS), (cx + 98 * SS, cy + 52 * SS), (cx - 98 * SS, cy + 52 * SS)], fill=PINK + (255,))
        b.rounded_rectangle((cx - 106 * SS, cy + 44 * SS, cx + 106 * SS, cy + 64 * SS), 10 * SS, fill=PINK_DARK + (255,))
        b.ellipse((cx - 18 * SS, cy + 58 * SS, cx + 18 * SS, cy + 92 * SS), fill=GOLD + (255,))
        b.ellipse((cx - 44 * SS, cy - 70 * SS, cx - 24 * SS, cy - 20 * SS), fill=(242, 160, 170, 255))
        bell = bell.rotate(swing, center=(cx, cy - 100 * SS), resample=Image.BICUBIC)
        im.paste(bell, (0, 0), bell)
        d = ImageDraw.Draw(im)
        if t < 0.5:
            a = abs(math.sin(t * math.pi * 4))
            for r in (120, 145):
                d.arc((cx - r * SS, cy - r * SS, cx + r * SS, cy + r * SS), 200, 250, fill=blend(PINK_LIGHT, a), width=6 * SS)
                d.arc((cx - r * SS, cy - r * SS, cx + r * SS, cy + r * SS), 290, 340, fill=blend(PINK_LIGHT, a), width=6 * SS)
        frames.append(im)
    save_gif(frames, 'anim-bell.gif', (160, 160))


def icon_png(draw_fn, name, size=96):
    im = Image.new('RGBA', (size * SS * 2, size * SS * 2), (0, 0, 0, 0))
    draw_fn(im, size * SS * 2)
    im.resize((size, size), Image.LANCZOS).save(OUT / name, optimize=True)
    print('✓', name)


def draw_facebook(im, W):
    d = ImageDraw.Draw(im)
    d.ellipse((0, 0, W - 1, W - 1), fill=(24, 119, 242, 255))
    font = ImageFont.truetype('/usr/share/fonts/liberation/LiberationSans-Bold.ttf', int(W * 0.66))
    # Centre the glyph's actual ink box, not the text box
    l, t, r, b = d.textbbox((0, 0), 'f', font=font)
    d.text(((W - (r - l)) / 2 - l + W * 0.02, (W - (b - t)) / 2 - t), 'f', font=font, fill=(255, 255, 255, 255))


def draw_maps(im, W):
    """Map pin in Google Maps colours on a white round badge."""
    d = ImageDraw.Draw(im)
    d.ellipse((0, 0, W - 1, W - 1), fill=(255, 255, 255, 255))
    cx, top, r = W / 2, W * 0.16, W * 0.26
    # pin body: circle + point
    d.polygon([(cx - r * 0.88, top + r * 1.35), (cx + r * 0.88, top + r * 1.35), (cx, top + r * 2.85)], fill=(234, 67, 53, 255))
    d.ellipse((cx - r, top, cx + r, top + 2 * r), fill=(234, 67, 53, 255))
    # coloured quarter accents like the Google Maps pin
    d.pieslice((cx - r, top, cx + r, top + 2 * r), 180, 270, fill=(66, 133, 244, 255))
    d.pieslice((cx - r, top, cx + r, top + 2 * r), 270, 330, fill=(52, 168, 83, 255))
    d.pieslice((cx - r, top, cx + r, top + 2 * r), 330, 360, fill=(251, 188, 4, 255))
    d.ellipse((cx - r * 0.42, top + r * 0.58, cx + r * 0.42, top + r * 1.42), fill=(165, 14, 14, 255))
    d.ellipse((cx - r * 0.36, top + r * 0.64, cx + r * 0.36, top + r * 1.36), fill=(255, 255, 255, 255))


if __name__ == '__main__':
    anim_cupcake()
    anim_cake()
    anim_star_row()
    anim_slice()
    pattern_tile()
    anim_bell()
    icon_png(draw_facebook, 'facebook.png')
    icon_png(draw_maps, 'maps.png')
