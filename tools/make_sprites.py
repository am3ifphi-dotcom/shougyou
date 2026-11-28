#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
星屑珈琲 — オリジナル立ち絵 & CG プロシージャル生成
深い夕日の光と温かいフラットセル画。全てオリジナル描画。
"""
import math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

S = 2
W, H = 1200 * S, 1600 * S

def sc(v):
    return int(v * S)

class BlendDraw:
    """全描画操作をスクラッチレイヤーに描き、本体へalpha_compositeする。
    PILのImageDrawは半透明色を「置換」するため、そのままでは透明な穴が空く。"""
    def __init__(self, img):
        self.img = img
    def _layer(self):
        return Image.new('RGBA', self.img.size, (0, 0, 0, 0))
    def _composite(self, layer):
        self.img.alpha_composite(layer)
    def polygon(self, pts, fill=None, outline=None):
        lay = self._layer(); d = ImageDraw.Draw(lay)
        d.polygon(pts, fill=fill, outline=outline); self._composite(lay)
    def ellipse(self, box, fill=None, outline=None, width=1):
        lay = self._layer(); d = ImageDraw.Draw(lay)
        d.ellipse(box, fill=fill, outline=outline, width=width); self._composite(lay)
    def pieslice(self, box, start, end, fill=None, outline=None, width=1):
        lay = self._layer(); d = ImageDraw.Draw(lay)
        d.pieslice(box, start, end, fill=fill, outline=outline, width=width); self._composite(lay)
    def rectangle(self, box, fill=None, outline=None, width=1):
        lay = self._layer(); d = ImageDraw.Draw(lay)
        d.rectangle(box, fill=fill, outline=outline, width=width); self._composite(lay)
    def rounded_rectangle(self, box, radius=0, fill=None, outline=None, width=1):
        lay = self._layer(); d = ImageDraw.Draw(lay)
        d.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width); self._composite(lay)
    def line(self, pts, fill=None, width=1, joint='curve'):
        lay = self._layer(); d = ImageDraw.Draw(lay)
        d.line(pts, fill=fill, width=width, joint=joint); self._composite(lay)
    def arc(self, box, start, end, fill=None, width=1):
        lay = self._layer(); d = ImageDraw.Draw(lay)
        d.arc(box, start, end, fill=fill, width=width); self._composite(lay)

def new_canvas():
    img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    return img, BlendDraw(img)

def face_poly(cx, cy, rx, ry, taper=0.17, n=64):
    pts = []
    for i in range(n):
        th = 2 * math.pi * i / n
        x = cx + rx * math.cos(th) * (1 - taper * max(0, math.sin(th)) ** 1.35)
        y = cy + ry * math.sin(th)
        pts.append((x, y))
    return pts

def almond_poly(cx, cy, w, h, n=44):
    pts = []
    for i in range(n):
        t = i / (n - 1) * math.pi * 2
        x = cx + w * math.cos(t)
        y = cy + h * math.sin(t) * (1 - 0.26 * abs(math.cos(t)))
        pts.append((x, y))
    return pts

def arc_pts(cx, cy, w, h, a0, a1, n=36):
    pts = []
    for i in range(n):
        t = math.radians(a0 + (a1 - a0) * i / (n - 1))
        pts.append((cx + w * math.cos(t), cy + h * math.sin(t)))
    return pts

def line(draw, pts, fill, width):
    draw.line(pts, fill=fill, width=int(width), joint='curve')

def rr(draw, box, radius, fill=None, outline=None, width=1):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)

# ============ カラー ============
SKIN      = (247, 205, 170, 255)
SKIN_SH   = (226, 170, 134, 255)
SKIN_DEEP = (201, 140, 110, 255)
LINE      = (47, 33, 29, 255)
LINE_SOFT = (74, 54, 48, 210)

def render(char, expr, out):
    img, draw = new_canvas()
    CX, CY = W // 2, sc(560)
    RX, RY = sc(282), sc(352)

    # ---------- 後ろ髪 ----------
    if char == 'setsuko':
        # シニヨン（お団子）
        draw.ellipse((CX - sc(150), sc(150), CX + sc(150), sc(480)), fill=(188, 186, 197, 255))
        draw.ellipse((CX - sc(120), sc(180), CX + sc(120), sc(450)), fill=(206, 204, 215, 255))
    elif char == 'tooru':
        # 襟足まわりの暗い層
        draw.ellipse((CX - sc(300), sc(330), CX + sc(300), sc(760)), fill=(30, 28, 38, 255))
    elif char == 'genzo':
        pass  # 短髪

    # ---------- 体（トルソー） ----------
    draw_torso(draw, char)

    # ---------- 首 ----------
    neck_top = CY + RY - sc(60)
    draw.rectangle((CX - sc(72), neck_top, CX + sc(72), neck_top + sc(260)), fill=SKIN)
    draw.rectangle((CX - sc(72), neck_top, CX + sc(72), neck_top + sc(110)), fill=SKIN_SH)

    # ---------- 耳 ----------
    draw.ellipse((CX - RX - sc(30), CY - sc(40), CX - RX + sc(20), CY + sc(72)), fill=SKIN)
    draw.ellipse((CX + RX - sc(20), CY - sc(40), CX + RX + sc(30), CY + sc(72)), fill=SKIN)

    # ---------- 顔 ----------
    draw.polygon(face_poly(CX, CY, RX, RY), fill=SKIN)
    # 右側の面影（夕日）
    draw.polygon(face_poly(CX + sc(125), CY + sc(60), RX * 0.78, RY * 0.88), fill=(122, 66, 44, 24))

    # しわ（年齢）
    if char in ('setsuko', 'genzo'):
        alpha = (150, 108, 92, 150 if char == 'genzo' else 120)
        # 額
        line(draw, arc_pts(CX, CY - sc(150), sc(150), sc(34), 205, 335), alpha, sc(5))
        line(draw, arc_pts(CX, CY - sc(90), sc(185), sc(36), 210, 330), alpha, sc(5))
        # 目尻
        line(draw, arc_pts(CX - sc(262), CY + sc(30), sc(26), sc(18), 90, 230), alpha, sc(5))
        line(draw, arc_pts(CX + sc(262), CY + sc(30), sc(26), sc(18), -50, 90), alpha, sc(5))
        # ほうれい線
        line(draw, arc_pts(CX - sc(150), CY + sc(240), sc(60), sc(120), -70, 60), alpha, sc(5))
        line(draw, arc_pts(CX + sc(150), CY + sc(240), sc(60), sc(120), 120, 250), alpha, sc(5))

    # ---------- 目 ----------
    eye_y = sc(620)
    L, R = CX - sc(243), CX + sc(243)
    draw_eyes_full(img, draw, L, R, eye_y, expr, char)

    # ---------- 眉 ----------
    brow_y = sc(512)
    draw_brows(draw, brow_y, L, R, expr, char)

    # ---------- 鼻 ----------
    line(draw, [(CX - sc(8), sc(700)), (CX, sc(722)), (CX + sc(10), sc(700))], SKIN_DEEP, sc(6))

    # ---------- 口 ----------
    draw_mouth(draw, CX, sc(800), expr)

    # ---------- 涙 ----------
    if expr == 'crying':
        draw_tears(draw, L, R, eye_y)

    # ---------- 赤み（若いキャラのみ） ----------
    if char == 'tooru' and expr in ('smile', 'normal'):
        for ex in (L, R):
            draw.ellipse((ex - sc(70), sc(726), ex + sc(70), sc(758)), fill=(240, 132, 122, 40))

    # ---------- 髭（和田=薄い / 源三=白髭） ----------
    if char == 'wada':
        draw.pieslice((CX - sc(210), sc(760), CX + sc(210), sc(1010)), 30, 150, fill=(70, 60, 56, 26))
    if char == 'genzo':
        # 顎まわりの白い無精髭（半透明）
        draw.pieslice((CX - sc(222), sc(720), CX + sc(222), sc(1135)), 28, 152, fill=(232, 230, 234, 105))

    # ---------- 前髪（顔の上に） ----------
    draw_front_hair(draw, char, CX, CY)

    img = img.resize((W // S, H // S), Image.LANCZOS)
    img.save(f'/home/user/shougyou/public/assets/sprites/{out}.png')
    print('saved', out)

# ============ 目 ============

def draw_eyes_full(img, draw, L, R, eye_y, expr, char):
    iris_color = {'tooru': (92, 60, 36, 255), 'setsuko': (74, 62, 52, 255),
                  'wada': (58, 54, 50, 255), 'genzo': (66, 66, 72, 255)}[char]
    for ex in (L, R):
        w, h = sc(76), sc(42)
        if expr in ('smile', 'crying'):
            if expr == 'smile':
                line(draw, arc_pts(ex, eye_y + sc(4), w, sc(38), 195, 345), LINE, sc(11))
            else:
                line(draw, arc_pts(ex, eye_y - sc(4), w, sc(36), 15, 165), LINE, sc(11))
            continue
        open_ratio = {'normal': 1.02, 'gentle': 0.68, 'blank': 0.78, 'sad': 0.74,
                      'angry': 0.58, 'surprised': 1.38, 'serious': 0.62}[expr]
        hh = sc(int(42 * open_ratio))
        almond = almond_poly(ex, eye_y, w, hh)
        draw.polygon(almond, fill=(250, 248, 247, 255))

        # 虹彩レイヤー
        layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        ld = ImageDraw.Draw(layer)
        ir = sc(31 if expr == 'surprised' else 26)
        iy = eye_y + (sc(8) if expr == 'blank' else 0)
        ix = ex + (sc(-11) if expr == 'blank' else 0)
        base = np.array(iris_color[:3], dtype=float)
        for i in range(26, 0, -1):
            f = i / 26
            rr_ = ir * f
            if f > 0.66:
                c = base * 0.32 * (1 - (1 - f) / 0.34) + base * 0.32 * ((1 - f) / 0.34) + base * 0.32
                c = base * 0.32 + (base * 0.92 - base * 0.32) * (1 - (f - 0.66) / 0.34)
                c = base * (0.32 + 0.6 * (1 - (f - 0.66) / 0.34))
            elif f > 0.30:
                c = base * 0.92 + (np.clip(base * 1.75 + 40, 0, 255) - base * 0.92) * ((0.66 - f) / 0.36) * 0.75
            else:
                c = np.clip(base * 1.75 + 40, 0, 255)
            ld.ellipse((ix - rr_, iy - rr_, ix + rr_, iy + rr_), fill=tuple(int(v) for v in c) + (255,))
        ld.ellipse((ix - sc(13), iy - sc(13), ix + sc(13), iy + sc(13)), fill=(18, 11, 9, 255))
        if expr != 'blank':
            ld.ellipse((ix - sc(10), iy - sc(12), ix - sc(2), iy - sc(4)), fill=(255, 255, 255, 235))
            ld.ellipse((ix + sc(3), iy + sc(5), ix + sc(8), iy + sc(10)), fill=(255, 255, 255, 150))
        mask = Image.new('L', (W, H), 0)
        ImageDraw.Draw(mask).polygon(almond, fill=255)
        img.paste(layer, (0, 0), mask)

        # まぶた
        lid = arc_pts(ex, eye_y - 1, w, hh * 0.94, 195, 345)
        line(draw, lid, LINE, sc(11 if expr in ('angry', 'serious') else 12))
        low = arc_pts(ex, eye_y + sc(3), w, hh * 0.8, 25, 155)
        line(draw, low, (98, 66, 58, 150), sc(4))
        if expr in ('gentle', 'blank', 'sad'):
            draw.pieslice((ex - w, eye_y - hh * 2.2, ex + w, eye_y + hh * 0.4), 180, 360, fill=(88, 52, 38, 88))

def draw_brows(draw, y, L, R, expr, char):
    color = {'tooru': (52, 44, 48, 255), 'setsuko': (140, 138, 150, 255),
             'wada': (50, 46, 43, 255), 'genzo': (230, 228, 234, 255)}[char]
    thick = 15 if char != 'genzo' else 22
    length = 60 if char != 'genzo' else 68

    def brow(ex, dy, slope):
        # 先細りの四角ポリゴン（外側太め・内側細め）
        x_out, y_out = ex - sc(length), y + dy + slope
        x_in, y_in = ex + sc(length), y + dy - slope
        t_out = sc(thick // 2)
        t_in = sc(thick // 4)
        # 垂直方向に厚みを持たせる（勾配に垂直な法線は簡略化: 垂直厚みで近似）
        pts = [(x_out, y_out - t_out), (x_in, y_in - t_in), (x_in, y_in + t_in), (x_out, y_out + t_out)]
        draw.polygon(pts, fill=color)

    dy = sc(-12) if expr == 'surprised' else 0
    if expr == 'normal':
        brow(L, dy, 6); brow(R, dy, -6)
    elif expr == 'smile':
        brow(L, sc(-12), 10); brow(R, sc(-12), -10)
    elif expr == 'gentle':
        brow(L, sc(-4), 8); brow(R, sc(-4), -8)
    elif expr == 'sad':
        brow(L, sc(-8), sc(26)); brow(R, sc(-8), sc(-26))
    elif expr == 'angry':
        brow(L, sc(14), sc(-28)); brow(R, sc(14), sc(28))
    elif expr == 'surprised':
        brow(L, sc(-30), 3); brow(R, sc(-30), -3)
    elif expr == 'blank':
        brow(L, sc(-2), 2); brow(R, sc(-2), -2)
    elif expr == 'crying':
        brow(L, sc(-12), sc(30)); brow(R, sc(-12), sc(-30))
    elif expr == 'serious':
        brow(L, sc(9), sc(-16)); brow(R, sc(9), sc(16))

# ============ 口 ============

def draw_mouth(draw, cx, y, expr):
    if expr in ('normal', 'gentle'):
        line(draw, arc_pts(cx, y - sc(10), sc(72), sc(26), 28, 152), LINE_SOFT, sc(7))
    elif expr == 'smile':
        draw.pieslice((cx - sc(86), y - sc(30), cx + sc(86), y + sc(56)), 18, 162, fill=(96, 50, 47, 255))
        draw.pieslice((cx - sc(86), y + sc(12), cx + sc(86), y + sc(52)), 18, 162, fill=(198, 108, 104, 255))
        draw.pieslice((cx - sc(86), y - sc(30), cx + sc(86), y + sc(16)), 18, 162, fill=(246, 242, 236, 255))
        line(draw, arc_pts(cx, y - sc(12), sc(86), sc(36), 18, 162), LINE, sc(6))
    elif expr == 'sad':
        line(draw, arc_pts(cx, y + sc(24), sc(62), sc(24), 208, 332), LINE_SOFT, sc(7))
    elif expr == 'angry':
        draw.pieslice((cx - sc(64), y - sc(10), cx + sc(64), y + sc(48)), 12, 168, fill=(96, 50, 47, 255))
        draw.pieslice((cx - sc(64), y + sc(16), cx + sc(64), y + sc(46)), 12, 168, fill=(198, 108, 104, 255))
        line(draw, arc_pts(cx, y - sc(12), sc(64), sc(28), 12, 168), LINE, sc(6))
    elif expr == 'surprised':
        draw.ellipse((cx - sc(29), y - sc(14), cx + sc(29), y + sc(34)), fill=(96, 50, 47, 255))
        draw.ellipse((cx - sc(16), y + sc(2), cx + sc(16), y + sc(23)), fill=(178, 94, 90, 255))
    elif expr == 'blank':
        line(draw, [(cx - sc(42), y + sc(4)), (cx + sc(42), y + sc(4))], LINE_SOFT, sc(6))
    elif expr == 'crying':
        draw.pieslice((cx - sc(68), y - sc(4), cx + sc(68), y + sc(54)), 8, 172, fill=(96, 50, 47, 255))
        draw.pieslice((cx - sc(68), y + sc(18), cx + sc(68), y + sc(48)), 8, 172, fill=(198, 108, 104, 255))
        line(draw, arc_pts(cx, y - sc(6), sc(68), sc(24), 8, 172), LINE, sc(6))
    elif expr == 'serious':
        line(draw, [(cx - sc(52), y + sc(8)), (cx + sc(52), y + sc(8))], LINE_SOFT, sc(7))

def draw_tears(draw, L, R, eye_y):
    for ex in (L, R):
        pts = [(ex, eye_y + sc(20)), (ex - sc(13), eye_y + sc(60)), (ex, eye_y + sc(86)), (ex + sc(13), eye_y + sc(60))]
        draw.polygon(pts, fill=(170, 219, 246, 205))
        draw.ellipse((ex - sc(4), eye_y + sc(42), ex + sc(3), eye_y + sc(53)), fill=(255, 255, 255, 220))
    # 目の下の濡れ
    for ex in (L, R):
        draw.pieslice((ex - sc(70), eye_y, ex + sc(70), eye_y + sc(70)), 15, 165, fill=(150, 200, 235, 60))

# ============ 前髪 ============

def draw_front_hair(draw, char, cx, cy):
    if char == 'tooru':
        base = (36, 34, 46, 255)
        hi = (96, 94, 118, 255)
        mid = (56, 54, 70, 255)
        # 前髪：生え際は眉上（sc(385〜475)）
        pts = [(cx - sc(310), sc(420)), (cx - sc(325), sc(215)), (cx - sc(235), sc(115)),
               (cx - sc(110), sc(65)), (cx, sc(35)), (cx + sc(110), sc(65)),
               (cx + sc(235), sc(115)), (cx + sc(325), sc(215)), (cx + sc(310), sc(420))]
        fringe = [(cx + sc(310), sc(420)), (cx + sc(258), sc(468)), (cx + sc(215), sc(388)),
                  (cx + sc(162), sc(475)), (cx + sc(112), sc(392)), (cx + sc(58), sc(466)),
                  (cx, sc(385)), (cx - sc(58), sc(462)), (cx - sc(112), sc(390)),
                  (cx - sc(168), sc(470)), (cx - sc(218), sc(388)), (cx - sc(265), sc(445)), (cx - sc(310), sc(420))]
        draw.polygon(pts + fringe, fill=base)
        # サイドロック
        draw.polygon([(cx - sc(322), sc(215)), (cx - sc(238), sc(235)), (cx - sc(280), sc(905)), (cx - sc(352), sc(830))], fill=base)
        draw.polygon([(cx + sc(322), sc(215)), (cx + sc(238), sc(235)), (cx + sc(280), sc(905)), (cx + sc(352), sc(830))], fill=base)
        # ハイライト
        line(draw, arc_pts(cx - sc(30), sc(40), sc(205), sc(62), 195, 330), hi, sc(11))
        line(draw, arc_pts(cx + sc(140), sc(115), sc(110), sc(40), 205, 330), hi, sc(8))
        line(draw, arc_pts(cx - sc(140), sc(115), sc(110), sc(42), 210, 335), mid, sc(9))

    elif char == 'setsuko':
        base = (203, 201, 211, 255)
        hi = (242, 241, 247, 255)
        sh = (152, 150, 166, 255)
        # シニヨン（顔より後ろ）
        draw.ellipse((cx - sc(168), sc(15), cx + sc(168), sc(255)), fill=(188, 186, 197, 255))
        draw.ellipse((cx - sc(130), sc(45), cx + sc(130), sc(225)), fill=base)
        # 帽子型の髪：生え際はsc(340〜440)の緩い波
        pts = [(cx - sc(302), sc(430)), (cx - sc(295), sc(215)), (cx - sc(210), sc(140)),
               (cx - sc(85), sc(105)), (cx + sc(85), sc(105)), (cx + sc(210), sc(140)),
               (cx + sc(295), sc(215)), (cx + sc(302), sc(430))]
        wave = [(cx + sc(302), sc(430)), (cx + sc(235), sc(440)), (cx + sc(185), sc(362)),
                (cx + sc(110), sc(435)), (cx + sc(30), sc(365)), (cx - sc(50), sc(430)),
                (cx - sc(130), sc(360)), (cx - sc(205), sc(428)), (cx - sc(255), sc(375)), (cx - sc(302), sc(430))]
        draw.polygon(pts + wave, fill=base)
        # サイドの流れ
        draw.polygon([(cx - sc(302), sc(255)), (cx - sc(222), sc(270)), (cx - sc(252), sc(890)), (cx - sc(335), sc(800))], fill=base)
        draw.polygon([(cx + sc(302), sc(255)), (cx + sc(222), sc(270)), (cx + sc(252), sc(890)), (cx + sc(335), sc(800))], fill=base)
        # ハイライト
        line(draw, arc_pts(cx, sc(140), sc(160), sc(45), 200, 335), hi, sc(10))
        line(draw, arc_pts(cx - sc(130), sc(215), sc(70), sc(125), 160, 285), hi, sc(8))
        line(draw, arc_pts(cx + sc(130), sc(215), sc(70), sc(125), 255, 20), sh, sc(9))

    elif char == 'wada':
        base = (54, 48, 45, 255)
        patch = (158, 156, 154, 255)
        hi = (94, 88, 84, 255)
        pts = [(cx - sc(295), sc(345)), (cx - sc(288), sc(205)), (cx - sc(168), sc(135)),
               (cx, sc(110)), (cx + sc(168), sc(135)), (cx + sc(288), sc(205)), (cx + sc(295), sc(345))]
        fringe = [(cx + sc(295), sc(345)), (cx + sc(232), sc(400)), (cx + sc(180), sc(330)),
                  (cx + sc(118), sc(400)), (cx + sc(60), sc(330)), (cx, sc(392)),
                  (cx - sc(60), sc(330)), (cx - sc(118), sc(400)), (cx - sc(180), sc(330)),
                  (cx - sc(232), sc(400)), (cx - sc(295), sc(345))]
        draw.polygon(pts + fringe, fill=base)
        draw.ellipse((cx - sc(298), sc(240), cx - sc(212), sc(358)), fill=patch)
        draw.ellipse((cx + sc(212), sc(240), cx + sc(298), sc(358)), fill=patch)
        line(draw, arc_pts(cx, sc(160), sc(172), sc(40), 205, 335), hi, sc(8))

    elif char == 'genzo':
        base = (228, 226, 232, 255)
        hi = (250, 249, 252, 255)
        sh = (172, 170, 180, 255)
        pts = [(cx - sc(278), sc(300)), (cx - sc(250), sc(175)), (cx - sc(145), sc(118)),
               (cx, sc(95)), (cx + sc(145), sc(118)), (cx + sc(250), sc(175)), (cx + sc(278), sc(300))]
        fringe = [(cx + sc(278), sc(300)), (cx + sc(215), sc(330)), (cx + sc(150), sc(255)),
                  (cx + sc(78), sc(318)), (cx, sc(250)), (cx - sc(78), sc(318)),
                  (cx - sc(150), sc(255)), (cx - sc(215), sc(330)), (cx - sc(278), sc(300))]
        draw.polygon(pts + fringe, fill=base)
        line(draw, arc_pts(cx, sc(150), sc(158), sc(36), 205, 335), hi, sc(10))

# ============ 体 ============

def draw_torso(draw, char):
    cx = W // 2
    top = sc(880)      # 首の付け根あたり
    # 肩のライン：大きな楕円弧で
    def torso_path(shoulder_w, drop):
        # 左肩 → 右肩のベジェ風ポリゴン
        pts = []
        steps = 40
        for i in range(steps + 1):
            t = i / steps
            x = -shoulder_w + 2 * shoulder_w * t
            # 肩の丸み（コサイン）
            y = sc(1130) - sc(150) * math.cos(math.pi * (t - 0.5) * 0 + 0) - sc(240) * (1 - (2 * t - 1) ** 2) * 0
            y = sc(1130) - sc(235) * (1 - (2 * t - 1) ** 2) ** 0.8
            pts.append((cx + sc(x) if False else cx + x, y))
        return pts

    def torso(fill, shoulder_half=760, top_y=1110, peak=905):
        pts = []
        N = 60
        for i in range(N + 1):
            t = i / N
            x = -shoulder_half + 2 * shoulder_half * t
            # 肩の丸み：中央が高く端が下がる放物線
            y = top_y - (top_y - peak) * (1 - (2 * t - 1) ** 2) ** 0.72
            pts.append((cx + sc(x), sc(y)))
        pts.append((cx + sc(shoulder_half + 260), H + sc(50)))
        pts.append((cx - sc(shoulder_half + 260), H + sc(50)))
        draw.polygon(pts, fill=fill)

    if char == 'tooru':
        torso((70, 68, 80, 255))                     # カーディガン
        # シャツのV
        draw.polygon([(cx - sc(150), sc(905)), (cx + sc(150), sc(905)),
                      (cx + sc(70), sc(1240)), (cx - sc(70), sc(1240))], fill=(238, 235, 224, 255))
        # ネクタイ
        draw.polygon([(cx - sc(44), sc(935)), (cx + sc(44), sc(935)), (cx + sc(30), sc(1010)), (cx - sc(30), sc(1010))], fill=(56, 60, 84, 255))
        draw.polygon([(cx - sc(34), sc(1010)), (cx + sc(34), sc(1010)), (cx + sc(56), sc(1300)), (cx, sc(1400)), (cx - sc(56), sc(1300))], fill=(46, 50, 72, 255))
        # カーディガンの重なり（前立て）
        draw.polygon([(cx - sc(150), sc(905)), (cx - sc(60), sc(905)), (cx - sc(150), sc(1560)), (cx - sc(238), sc(1560))], fill=(58, 56, 68, 255))
        draw.polygon([(cx + sc(150), sc(905)), (cx + sc(60), sc(905)), (cx + sc(150), sc(1560)), (cx + sc(238), sc(1560))], fill=(58, 56, 68, 255))
        # 影（右側）
        draw.polygon([(cx + sc(300), sc(1000)), (cx + sc(760), sc(1130)), (cx + sc(980), H // S + sc(100)), (cx + sc(240), H // S + sc(100))], fill=(18, 16, 26, 56))
        # シワ
        line(draw, arc_pts(cx - sc(420), sc(1350), sc(150), sc(60), 20, 160), (24, 22, 32, 130), sc(5))
        line(draw, arc_pts(cx + sc(420), sc(1350), sc(150), sc(60), 20, 160), (24, 22, 32, 130), sc(5))

    elif char == 'setsuko':
        torso((236, 232, 222, 255))                  # ブラウス
        # エプロン
        apron = (107, 70, 50, 255)
        draw.polygon([(cx - sc(268), sc(1120)), (cx + sc(268), sc(1120)),
                      (cx + sc(470), H // S + sc(60)), (cx - sc(470), H // S + sc(60))], fill=apron)
        # 肩紐
        draw.polygon([(cx - sc(250), sc(905)), (cx - sc(150), sc(905)), (cx - sc(190), sc(1110)), (cx - sc(300), sc(1110))], fill=apron)
        draw.polygon([(cx + sc(250), sc(905)), (cx + sc(150), sc(905)), (cx + sc(190), sc(1110)), (cx + sc(300), sc(1110))], fill=apron)
        # 胸の切り替え（ヨーク）
        draw.rectangle((cx - sc(262), sc(1165), cx + sc(262), sc(1203)), fill=(92, 60, 43, 255))
        # ポケット
        rr(draw, (cx - sc(150), sc(1380), cx + sc(150), sc(1560)), sc(18), fill=(88, 58, 41, 255), outline=(70, 46, 33, 255), width=sc(4))
        # ポケットのペン
        draw.line([(cx - sc(80), sc(1330)), (cx - sc(80), sc(1420))], fill=(60, 60, 78, 255), width=sc(10))
        draw.line([(cx - sc(40), sc(1336)), (cx - sc(40), sc(1420))], fill=(150, 54, 48, 255), width=sc(10))
        # 首もとの影
        draw.polygon([(cx - sc(140), sc(905)), (cx + sc(140), sc(905)), (cx, sc(1010))], fill=(210, 204, 192, 255))
        # 右側の影
        draw.polygon([(cx + sc(280), sc(1010)), (cx + sc(700), sc(1130)), (cx + sc(920), H // S + sc(100)), (cx + sc(220), H // S + sc(100))], fill=(40, 22, 12, 40))
        # 手拭い（左肩に）
        draw.polygon([(cx - sc(520), sc(1060)), (cx - sc(330), sc(1000)), (cx - sc(260), sc(1180)), (cx - sc(470), sc(1260))], fill=(244, 242, 235, 255))
        draw.line([(cx - sc(480), sc(1120)), (cx - sc(290), sc(1052))], fill=(196, 60, 54, 255), width=sc(12))

    elif char == 'wada':
        torso((201, 122, 58, 255))                   # オレンジポロ
        # 襟
        draw.polygon([(cx - sc(120), sc(905)), (cx + sc(120), sc(905)), (cx, sc(1015))], fill=(178, 106, 48, 255))
        # 濃紺エプロン
        draw.polygon([(cx - sc(262), sc(1258)), (cx + sc(262), sc(1258)),
                      (cx + sc(430), H // S + sc(60)), (cx - sc(430), H // S + sc(60))], fill=(43, 55, 82, 255))
        draw.rectangle((cx - sc(258), sc(1312), cx + sc(258), sc(1344)), fill=(32, 42, 64, 255))
        # 右側の影
        draw.polygon([(cx + sc(260), sc(1010)), (cx + sc(700), sc(1130)), (cx + sc(920), H // S + sc(100)), (cx + sc(200), H // S + sc(100))], fill=(50, 28, 8, 46))
        # 日焼け感
        draw.polygon([(cx - sc(320), sc(1000)), (cx + sc(320), sc(1000)), (cx + sc(200), sc(1080)), (cx - sc(200), sc(1080))], fill=(168, 96, 40, 60))

    elif char == 'genzo':
        torso((51, 64, 92, 255))                     # 紺の作業着
        # 開襟シャツ（白）
        draw.polygon([(cx - sc(150), sc(905)), (cx + sc(150), sc(905)), (cx, sc(1060))], fill=(226, 224, 218, 255))
        # 開襟の割れ
        draw.line([(cx, sc(905)), (cx, sc(1060))], fill=(40, 50, 74, 255), width=sc(8))
        # スカーフ（白）
        draw.ellipse((cx - sc(88), sc(858), cx + sc(88), sc(946)), fill=(238, 237, 233, 255))
        draw.ellipse((cx - sc(30), sc(884), cx + sc(30), sc(960)), fill=(203, 201, 196, 255))
        # ボタン
        for yy in (1250, 1400, 1550):
            draw.ellipse((cx - sc(14), sc(yy), cx + sc(14), sc(yy + 28)), fill=(30, 38, 60, 255))
        # 右側の影
        draw.polygon([(cx + sc(260), sc(1010)), (cx + sc(700), sc(1130)), (cx + sc(920), H // S + sc(100)), (cx + sc(200), H // S + sc(100))], fill=(16, 20, 38, 55))

# ============ 実行 ============

JOBS = [
    ('tooru', 'normal', 'sp_tooru_normal'),
    ('tooru', 'smile', 'sp_tooru_smile'),
    ('tooru', 'sad', 'sp_tooru_sad'),
    ('tooru', 'angry', 'sp_tooru_angry'),
    ('tooru', 'surprised', 'sp_tooru_surprised'),
    ('setsuko', 'normal', 'sp_setsuko_normal'),
    ('setsuko', 'smile', 'sp_setsuko_smile'),
    ('setsuko', 'gentle', 'sp_setsuko_gentle'),
    ('setsuko', 'blank', 'sp_setsuko_blank'),
    ('setsuko', 'crying', 'sp_setsuko_crying'),
    ('wada', 'normal', 'sp_wada_normal'),
    ('wada', 'smile', 'sp_wada_smile'),
    ('wada', 'serious', 'sp_wada_serious'),
    ('genzo', 'normal', 'sp_genzo_normal'),
    ('genzo', 'smile', 'sp_genzo_smile'),
]

if __name__ == '__main__':
    for char, expr, out in JOBS:
        render(char, expr, out)
