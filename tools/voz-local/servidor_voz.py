"""Servidor local de voz clonada (Chatterbox multilingüe) para MetaPulse.

Corre en el PC del dueño (necesita GPU). Contabo lo llama por un túnel SSH inverso
(ver tunel_contabo.bat). Escucha solo en 127.0.0.1.

  GET  /health            -> {ok, device, voices, busy}
  POST /tts {text,voice}  -> audio/wav (PCM16 mono 24 kHz)

Las voces son archivos WAV de referencia en VOZ_LOCAL_VOCES (p. ej. andrea.wav).
Esos audios son de una persona real: NO se versionan en el repo.
"""
import io
import json
import os
import re
import sys
import threading
import time
import wave
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import torch
from chatterbox.mtl_tts import ChatterboxMultilingualTTS

PORT = int(os.environ.get('VOZ_LOCAL_PUERTO', '18765'))
VOCES_DIR = os.environ.get('VOZ_LOCAL_VOCES', r'F:\voces-test\voces')
# Poco énfasis + puntuación sobria: con más énfasis la entonación se vuelve "caribeña"
EXAGGERATION = float(os.environ.get('VOZ_LOCAL_EXAGGERATION', '0.45'))
CFG_WEIGHT = float(os.environ.get('VOZ_LOCAL_CFG', '0.5'))
MAX_CHARS = 2000

GEN_LOCK = threading.Lock()
MODEL = None
DEVICE = 'cuda' if torch.cuda.is_available() else 'cpu'

# ───────── Números a palabras (Chatterbox lee mal los dígitos) ─────────
_UNI = ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce',
        'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve', 'veinte', 'veintiuno',
        'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve']
_DEC = {3: 'treinta', 4: 'cuarenta', 5: 'cincuenta', 6: 'sesenta', 7: 'setenta', 8: 'ochenta', 9: 'noventa'}
_CEN = {1: 'ciento', 2: 'doscientos', 3: 'trescientos', 4: 'cuatrocientos', 5: 'quinientos', 6: 'seiscientos',
        7: 'setecientos', 8: 'ochocientos', 9: 'novecientos'}


def _menor_mil(n):
    if n == 100:
        return 'cien'
    partes = []
    c, r = divmod(n, 100)
    if c:
        partes.append(_CEN[c])
    if r:
        if r < 30:
            partes.append(_UNI[r])
        else:
            d, u = divmod(r, 10)
            partes.append(_DEC[d] + (' y ' + _UNI[u] if u else ''))
    return ' '.join(partes)


def _apocopa(s):
    if s.endswith('veintiuno'):
        return s[:-9] + 'veintiún'
    if s.endswith('uno'):
        return s[:-3] + 'un'
    return s


def numero_a_palabras(n):
    if n == 0:
        return 'cero'
    if n >= 1_000_000_000:
        return str(n)
    partes = []
    millones, resto = divmod(n, 1_000_000)
    if millones:
        partes.append('un millón' if millones == 1 else _apocopa(numero_a_palabras(millones)) + ' millones')
    miles, resto = divmod(resto, 1000)
    if miles:
        partes.append('mil' if miles == 1 else _apocopa(_menor_mil(miles)) + ' mil')
    if resto:
        partes.append(_menor_mil(resto))
    return ' '.join(partes)


def _entero(txt):
    return int(txt.replace('.', ''))


_FEM = {'noche', 'noches', 'suite', 'suites', 'tarde', 'tardes', 'mujer', 'mujeres', 'vez', 'veces', 'clase', 'clases'}
_MASC_EN_A = {'día', 'días', 'mapa', 'mapas', 'sofá', 'sofás', 'idioma', 'idiomas'}


def _con_genero(num_txt, siguiente):
    """21 personas -> veintiuna personas; 31 cabañas -> treinta y una cabañas; 1 día -> un día."""
    p = numero_a_palabras(_entero(num_txt))
    sig = (siguiente or '').strip().lower()
    if not sig or not p.endswith('uno'):
        return p
    fem = sig not in _MASC_EN_A and (sig.endswith(('a', 'as', 'ción', 'ciones', 'sión', 'siones', 'dad', 'dades')) or sig in _FEM)
    if p.endswith('veintiuno'):
        return p[:-9] + ('veintiuna' if fem else 'veintiún')
    return p[:-3] + ('una' if fem else 'un')


def normalizar(texto):
    t = re.sub(r'\s+', ' ', str(texto or '')).strip()
    # Exclamaciones empujan a entonación exagerada: se pasan a puntuación sobria
    t = t.replace('¡', '').replace('!', '.')
    t = re.sub(r'\.{2,}', '...', t)
    # Dinero y porcentajes
    t = re.sub(r'\$\s*(\d{1,3}(?:\.\d{3})+|\d+)', lambda m: numero_a_palabras(_entero(m.group(1))) + ' pesos', t)
    t = re.sub(r'(\d+)\s*%', lambda m: numero_a_palabras(int(m.group(1))) + ' por ciento', t)
    t = re.sub(r'(\d+),(\d{1,2})\b', lambda m: numero_a_palabras(int(m.group(1))) + ' coma ' + numero_a_palabras(int(m.group(2))), t)
    t = re.sub(r'(\d{1,3}(?:\.\d{3})+|\d+)(?=(\s+[A-Za-zÁÉÍÓÚáéíóúñÑ]+)?)',
               lambda m: _con_genero(m.group(1), m.group(2)), t)
    t = re.sub(r'\s+', ' ', t).strip()
    if t and t[-1] not in '.?…':
        t += '.'
    return t


def partir(texto, maximo=220):
    frases = re.split(r'(?<=[.?…])\s+', texto)
    trozos, actual = [], ''
    for f in frases:
        if actual and len(actual) + 1 + len(f) > maximo:
            trozos.append(actual)
            actual = f
        else:
            actual = (actual + ' ' + f).strip()
    if actual:
        trozos.append(actual)
    return trozos


def generar_trozo(texto, ref):
    palabras = max(1, len(texto.split()))
    max_dur = palabras * 0.7 + 2.5  # si dura mucho más, el modelo balbuceó: se reintenta
    mejor = None
    for intento in range(3):
        wav = MODEL.generate(texto, language_id='es', audio_prompt_path=ref,
                             exaggeration=EXAGGERATION, cfg_weight=CFG_WEIGHT)
        dur = wav.shape[-1] / MODEL.sr
        if mejor is None or dur < mejor[1]:
            mejor = (wav, dur)
        if dur <= max_dur:
            break
        print(f'  intento {intento + 1}: {dur:.1f}s para {palabras} palabras (máx {max_dur:.1f}s), reintento', flush=True)
    return mejor[0]


def sintetizar(texto, ref):
    trozos = partir(normalizar(texto))
    pausa = torch.zeros(1, int(0.18 * MODEL.sr))
    partes = []
    for i, tz in enumerate(trozos):
        if i:
            partes.append(pausa)
        partes.append(generar_trozo(tz, ref).cpu())
    return torch.cat(partes, dim=-1)


def a_wav(tensor, sr):
    pcm = (tensor.squeeze().clamp(-1, 1) * 32767).short().numpy().tobytes()
    buf = io.BytesIO()
    with wave.open(buf, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(pcm)
    return buf.getvalue()


def voces_disponibles():
    try:
        return sorted(f[:-4] for f in os.listdir(VOCES_DIR) if f.lower().endswith('.wav'))
    except OSError:
        return []


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        print('[http]', fmt % args, flush=True)

    def _enviar(self, code, body, ctype='application/json'):
        if isinstance(body, (dict, list)):
            body = json.dumps(body, ensure_ascii=False).encode('utf-8')
        try:
            self.send_response(code)
            self.send_header('Content-Type', ctype)
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def do_GET(self):
        if self.path.split('?')[0] == '/health':
            return self._enviar(200, {'ok': True, 'device': DEVICE, 'voices': voces_disponibles(), 'busy': GEN_LOCK.locked()})
        self._enviar(404, {'error': 'no existe'})

    def do_POST(self):
        if self.path.split('?')[0] != '/tts':
            return self._enviar(404, {'error': 'no existe'})
        try:
            n = int(self.headers.get('Content-Length') or 0)
            datos = json.loads(self.rfile.read(n) or b'{}')
        except Exception:
            return self._enviar(400, {'error': 'JSON inválido'})
        texto = str(datos.get('text') or '').strip()
        voz = str(datos.get('voice') or 'andrea')
        if not texto:
            return self._enviar(400, {'error': 'texto vacío'})
        if len(texto) > MAX_CHARS:
            return self._enviar(400, {'error': f'texto demasiado largo (máx {MAX_CHARS})'})
        if not re.fullmatch(r'[A-Za-z0-9_-]+', voz):
            return self._enviar(400, {'error': 'voz inválida'})
        ref = os.path.join(VOCES_DIR, voz + '.wav')
        if not os.path.isfile(ref):
            return self._enviar(404, {'error': f'no existe la voz {voz}'})
        t0 = time.time()
        try:
            with GEN_LOCK:
                audio = sintetizar(texto, ref)
            wav = a_wav(audio, MODEL.sr)
        except Exception as e:  # noqa: BLE001
            print('[error]', e, flush=True)
            return self._enviar(500, {'error': str(e)[:300]})
        print(f'[tts] {voz}: {audio.shape[-1] / MODEL.sr:.1f}s de audio en {time.time() - t0:.1f}s · "{texto[:60]}"', flush=True)
        self._enviar(200, wav, 'audio/wav')


def main():
    global MODEL
    voces = voces_disponibles()
    if not voces:
        print(f'No hay voces: pon archivos .wav de referencia en {VOCES_DIR}', flush=True)
        sys.exit(1)
    print(f'Cargando Chatterbox en {DEVICE}... (la primera vez puede tardar)', flush=True)
    t0 = time.time()
    MODEL = ChatterboxMultilingualTTS.from_pretrained(device=DEVICE)
    print(f'Modelo listo en {time.time() - t0:.0f}s · voces: {", ".join(voces)}', flush=True)
    srv = ThreadingHTTPServer(('127.0.0.1', PORT), Handler)
    print(f'Voz local escuchando en http://127.0.0.1:{PORT}  (deja esta ventana abierta)', flush=True)
    srv.serve_forever()


if __name__ == '__main__':
    main()
