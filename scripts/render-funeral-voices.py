# /// script
# requires-python = ">=3.10,<3.14"
# dependencies = ["kokoro-onnx==0.6.1", "soundfile==0.13.1"]
# ///
"""Render the exact staged lines supplied by scripts/voices.ts into mono MP3s."""

import hashlib
import json
import os
from pathlib import Path
import shutil
import sys
import tempfile
import urllib.error
import urllib.request

import numpy as np
import soundfile as sf

RELEASE = "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/"
MODEL_FILES = {
    "kokoro-v1.0.onnx": "7d5df8ecf7d4b1878015a32686053fd0eebe2bc377234608764cc0ef3636a6c5",
    "voices-v1.0.bin": "bca610b8308e8d99f32e6fe4197e7ec01679264efed0cac9140fe9c29f1fbf7d",
}


def sha256(path):
    with path.open("rb") as stream:
        digest = hashlib.sha256()
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def model_path(cache, name):
    path = cache / name
    if not path.is_file():
        with tempfile.NamedTemporaryFile(dir=cache, delete=False) as temp:
            staging = Path(temp.name)
            try:
                request = urllib.request.Request(RELEASE + name, headers={"User-Agent": "Eulogy-voice-generator"})
                with urllib.request.urlopen(request, timeout=90) as response:
                    shutil.copyfileobj(response, temp)
                temp.close()
                if sha256(staging) != MODEL_FILES[name]:
                    raise RuntimeError("Model download checksum failed for " + name)
                staging.replace(path)
            finally:
                staging.unlink(missing_ok=True)
    if sha256(path) != MODEL_FILES[name]:
        raise RuntimeError("Model checksum failed for " + str(path))
    return path


def kokoro_model():
    from kokoro_onnx import Kokoro
    import onnxruntime as rt

    cache = Path(os.environ.get("EULOGY_VOICE_MODEL_DIR", ".local/voices/models"))
    cache.mkdir(parents=True, exist_ok=True)
    options = rt.SessionOptions()
    options.intra_op_num_threads = min(4, os.cpu_count() or 1)
    options.inter_op_num_threads = 1
    model = model_path(cache, "kokoro-v1.0.onnx")
    voices = model_path(cache, "voices-v1.0.bin")
    session = rt.InferenceSession(str(model), options, providers=["CPUExecutionProvider"])
    return Kokoro.from_session(session, str(voices))


def kokoro_take(model, job, path):
    text, voice = job["text"], job["voice"]
    lang = "en-gb" if voice.startswith("b") else "en-us"
    phonemes = model.tokenizer.phonemize(text, lang)
    for spelling, pronunciation in job["pronunciations"].items():
        phonemes = phonemes.replace(model.tokenizer.phonemize(spelling, lang), pronunciation)
    audio, rate = model.create(phonemes, voice=voice, speed=job["speed"], lang=lang, is_phonemes=True)
    if not len(audio) or not np.isfinite(audio).all():
        raise ValueError("The voice model returned empty or invalid audio.")
    rms = float(np.sqrt(np.mean(audio * audio)))
    peak = float(np.max(np.abs(audio)))
    if rms < 0.001 or peak < 0.01:
        raise ValueError("The voice model returned silence.")
    # Match spoken levels between performers while preserving their dynamics.
    audio *= min(10 ** (-20.5 / 20) / rms, 0.82 / peak, 1.45)
    fade = min(round(rate * 0.008), len(audio) // 2)
    if fade:
        audio[:fade] *= np.linspace(0, 1, fade)
        audio[-fade:] *= np.linspace(1, 0, fade)
    audio = np.pad(audio, (round(rate * 0.055), round(rate * 0.12)))
    sf.write(path, audio, rate, format="MP3", compression_level=0.30, bitrate_mode="VARIABLE")


def eleven_request(path, data=None):
    request = urllib.request.Request(
        "https://api.elevenlabs.io" + path,
        data=json.dumps(data).encode("utf-8") if data is not None else None,
        headers={"xi-api-key": os.environ["ELEVENLABS_API_KEY"], "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(request, timeout=90) as response:
            return response.read()
    except urllib.error.HTTPError as error:
        try:
            detail = json.loads(error.read()).get("detail", {})
            reason = detail.get("code") or detail.get("status") or error.reason
        except (ValueError, AttributeError):
            reason = error.reason
        raise RuntimeError(f"ElevenLabs returned HTTP {error.code} ({reason}).") from None


def check_library_voice(voice):
    from urllib.parse import quote

    metadata = json.loads(eleven_request("/v1/voices/" + quote(voice, safe="")))
    sharing = (metadata.get("sharing") or {}).get("status")
    shared_professional = metadata.get("category") == "professional" and sharing in {"enabled", "copied"}
    if metadata.get("category") != "premade" and not shared_professional:
        raise ValueError("Choose a premade or publicly shared professional voice from ElevenLabs.")


def eleven_take(job, path):
    from urllib.parse import quote

    endpoint = "/v1/text-to-speech/" + quote(job["voice"], safe="") + "?output_format=mp3_44100_128"
    path.write_bytes(eleven_request(endpoint, job["speech"]))


def duration_ms(path):
    audio, rate = sf.read(path, dtype="float32")
    if audio.ndim != 1 or len(audio) < rate / 5 or not np.isfinite(audio).all() or np.max(np.abs(audio)) < 0.01:
        raise ValueError("Invalid or silent recording at " + str(path))
    return round(1000 * len(audio) / rate)


def main():
    engine, plan, receipt, output = sys.argv[1:]
    jobs = json.loads(Path(plan).read_text())
    if engine == "kokoro-82m-v1.0":
        model = kokoro_model()
    elif engine == "eleven_v4":
        for voice in {job["voice"] for job in jobs if job.get("checkVoice")}:
            check_library_voice(voice)
    else:
        raise ValueError("Unknown speech engine")
    durations = {}
    for index, job in enumerate(jobs, start=1):
        path = Path(output) / job["filename"]
        valid = False
        if path.is_file() and not job.get("repair"):
            try:
                durations[path.name] = duration_ms(path)
                valid = True
            except (RuntimeError, ValueError):
                pass
        if not valid:
            fd, name = tempfile.mkstemp(dir=output, suffix=".tmp")
            os.close(fd)
            temporary = Path(name)
            try:
                if engine == "kokoro-82m-v1.0":
                    kokoro_take(model, job, temporary)
                else:
                    eleven_take(job, temporary)
                durations[path.name] = duration_ms(temporary)
                temporary.chmod(0o644)
                temporary.replace(path)
            finally:
                temporary.unlink(missing_ok=True)
        if index % 10 == 0 or index == len(jobs):
            print(f"{index}/{len(jobs)} recordings verified", flush=True)
    Path(receipt).write_text(json.dumps(durations))


if __name__ == "__main__":
    main()
