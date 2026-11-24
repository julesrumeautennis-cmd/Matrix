# Chapel recordings

The chapel uses stock synthetic English voices. The captions and recordings use the same `buildChapelService(profile, run)` script. The bundled audio covers the public Matrix screening, Louis’s thirty archived lives, and Jules’s two authored lives. The priest’s readings and the spouse’s testimony also play in personalized lives with the same outcomes. A line unique to a visitor’s run uses an available English device voice, with a preference for enhanced and neural voices.

| Role in the archive     | Kokoro voice |
| ----------------------- | ------------ |
| Priest                  | `bm_george`  |
| Inès                    | `af_kore`    |
| Maman and Anne          | `bf_emma`    |
| Papa                    | `am_fenrir`  |
| Theo                    | `am_puck`    |
| Camille                 | `af_heart`   |
| Léa                     | `af_bella`   |
| Louis’s cofounder Jules | `am_michael` |

## Record the archives

Run `npm run voices` from the repository root to check and reuse the engine in the published manifest. Previously recorded passages are reused by their exact script, voice settings and pronunciation overrides. The manifest also stores the SHA-256 digest of the finished audio.

New passages use the pinned Python dependencies declared in `render-funeral-voices.py`. Install uv or set `EULOGY_VOICE_PYTHON` to an interpreter with `kokoro-onnx==0.6.1` and `soundfile==0.13.1`. The generator also recognizes `.local/voices/.venv` in the checkout. For offline synthesis, `npm run voices -- --kokoro` downloads the public ONNX model and stock voice pack on first use, validates their SHA-256 digests and caches them in `.local/voices/models`. Set `EULOGY_VOICE_MODEL_DIR` to choose another cache. Local inference produces 24 kHz mono MP3s. [uv installation](https://docs.astral.sh/uv/)

The model weights use Apache 2.0. The ONNX runtime wrapper uses the MIT license. The project distributes the speech recordings. [Kokoro model card](https://huggingface.co/hexgrad/Kokoro-82M) · [Publisher’s voice list](https://huggingface.co/hexgrad/Kokoro-82M/blob/main/VOICES.md) · [ONNX model release](https://github.com/thewh1teagle/kokoro-onnx/releases/tag/model-files-v1.0) · [Runtime license](https://github.com/thewh1teagle/kokoro-onnx/blob/main/LICENSE)

## Record with ElevenLabs

Set `ELEVENLABS_API_KEY` in the repository’s ignored `.env` file. Text to Speech access is sufficient for the included cast. `npm run voices -- --elevenlabs --plan` reports the unique passages and their character count, including performance directions. `npm run voices -- --elevenlabs` records them with Eleven v4 and publishes the manifest after every clip has been decoded and measured. An interrupted render reuses completed takes. The website serves the recorded MP3s as static assets. [Eleven v4](https://elevenlabs.io/docs/overview/capabilities/text-to-speech/eleven-v4) · [Speech API](https://elevenlabs.io/docs/api-reference/text-to-speech/convert)

George reads the priest and Lily plays the spouse. The remaining seven voices and the delivery cues for each testimony are in `scripts/chapel-readings.ts`. You can override a casting choice with a library voice ID in `ELEVENLABS_VOICE_<PERFORMER>`. Overrides outside the included cast need Voices Read access so the generator can verify the premade or shared professional voice. [Voice metadata](https://elevenlabs.io/docs/api-reference/voices/get)
