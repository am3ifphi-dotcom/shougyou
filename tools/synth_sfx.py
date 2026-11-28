import numpy as np, wave, struct, math

SR = 44100

def write_wav(path, samples):
    samples = samples / max(1e-9, np.max(np.abs(samples))) * 0.89
    pcm = (samples * 32767).astype(np.int16)
    with wave.open(path, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    print('wrote', path)

def env_exp(t, attack, decay):
    a = np.minimum(1.0, t / attack)
    return a * np.exp(-t / decay)

def tone(freq, dur, attack=0.005, decay=1.2, harmonics=((1,1.0),(2,0.45),(3,0.18),(4.2,0.07))):
    t = np.arange(int(SR*dur)) / SR
    sig = np.zeros_like(t)
    for mult, amp in harmonics:
        sig += amp * np.sin(2*np.pi*freq*mult*t + 0.3*mult)
    return sig * env_exp(t, attack, decay)

def mix(*parts):
    n = max(len(p) for p in parts)
    out = np.zeros(n)
    for p in parts:
        out[:len(p)] += p
    return out

def pad_to(sig, dur):
    n = int(SR*dur)
    if len(sig) < n: sig = np.pad(sig, (0, n-len(sig)))
    return sig[:n]

def reverb(sig, delay=0.135, decay=0.32, taps=5):
    out = sig.copy()
    for i in range(1, taps+1):
        d = int(SR * delay * i)
        if d < len(sig):
            out[d:] += sig[:len(sig)-d] * (decay ** i)
    return out

base = '/home/user/shougyou/public/assets/audio/se/'

# --- 1) Shop door chime: "ding-dong" (East Asian cafe bell, E5 -> B4) ---
chime = mix(pad_to(tone(659.25, 2.6, 0.008, 1.6), 2.6),
            pad_to(np.concatenate([np.zeros(int(SR*0.32)), tone(493.88, 2.4, 0.008, 1.7)]), 2.72))
write_wav(base + 'se_chime.wav', reverb(chime, 0.14, 0.30, 4))

# --- 2) Coffee pour: bandpassed filtered noise with slow envelope + slight wander ---
dur = 2.3
t = np.arange(int(SR*dur)) / SR
noise = np.random.default_rng(7).standard_normal(len(t))
# one-pole band-ish: difference of two lowpasses
from numpy import cumsum
# simple resonant bandpass via FFT
X = np.fft.rfft(noise)
freqs = np.fft.rfftfreq(len(noise), 1/SR)
center = 900 + 700*np.sin(2*np.pi*1.35*t) # slowly wandering pitch
bw = 550.0
# apply time-varying filter approximately by smoothing noise then shaping
bp = band = None
lo = np.convolve(noise, np.ones(60)/60, mode='same')     # ~750Hz-ish lowpass
bp = noise - np.convolve(noise, np.ones(6)/6, mode='same')  # high detail
env = np.clip(t/0.25, 0, 1) * np.clip((dur-t)/0.45, 0, 1)
env *= (0.75 + 0.25*np.sin(2*np.pi*6*t))                  # pour gurgle
pour = (0.55*bp + 0.35*lo) * env
write_wav(base + 'se_pour.wav', reverb(pour, 0.09, 0.22, 3))

# --- 3) Cup clink: ceramic tap (2.05kHz + partials) ---
clink = mix(*[pad_to(tone(f, 0.9, 0.002, 0.32, [(1,1.0),(2.7,0.42),(5.3,0.16)]), 0.9) for f in (2050,)])
write_wav(base + 'se_clink.wav', reverb(clink, 0.10, 0.28, 3))

# --- 4) "Stardust" sparkle arpeggio (C6 E6 G6 B6 D7, music-box) ---
note = lambda f, d: pad_to(tone(f, d, 0.004, 1.35, [(1,1.0),(2,0.5),(3,0.28),(4.1,0.12),(5.4,0.05)]), d)
sparkle = np.zeros(int(SR*3.4))
t0 = 0.0
for f in (1046.5, 1318.5, 1568.0, 1975.5, 2349.3):
    seg = note(f, 2.6)
    idx = int(SR*t0)
    sparkle[idx:idx+len(seg)] += seg
    t0 += 0.16
write_wav(base + 'se_star.wav', reverb(sparkle, 0.17, 0.38, 5))

# --- 5) Kettle whistle (tea preparation): rising soft whistle ---
t = np.arange(int(SR*1.6)) / SR
freq = 1900 + 500*(1 - np.exp(-t/0.7))
ket = np.sin(2*np.pi*np.cumsum(freq)/SR) * np.clip(t/0.5,0,1) * np.exp(-((t-1.25)**2)/0.09)
ket += 0.35*np.sin(2*np.pi*np.cumsum(freq*1.5)/SR) * np.clip(t/0.5,0,1) * np.exp(-((t-1.25)**2)/0.12)
write_wav(base + 'se_kettle.wav', reverb(ket, 0.10, 0.30, 3))

# --- 6) Distant train pass (epilogue / departure) ---
t = np.arange(int(SR*6.0)) / SR
noise = np.random.default_rng(11).standard_normal(len(t))
lo = np.convolve(noise, np.ones(90)/90, mode='same')
tone_sig = np.sin(2*np.pi*55*t) * 0.6 + np.sin(2*np.pi*82.5*t) * 0.3
env = np.exp(-((t-3.0)**2)/2.6**2)
train = (0.5*lo + 0.8*tone_sig*np.abs(np.sin(2*np.pi*2.1*t))**1.5 + 0.12*noise) * env
write_wav(base + 'se_train.wav', reverb(train, 0.16, 0.4, 4))

# --- 7) Page turn (already have Kenney ogg; also a soft album flip) ---
t = np.arange(int(SR*0.45)) / SR
noise = np.random.default_rng(3).standard_normal(len(t))
flip = noise * np.exp(-((t-0.16)**2)/0.028) * 0.8
flip += np.convolve(noise, np.ones(30)/30, mode='same') * np.exp(-t/0.10) * 0.35
write_wav(base + 'se_flip.wav', flip)
