# Chapel recordings

The chapel uses stock synthetic English voices. The captions and recordings use the same `buildChapelService(profile, run)` script. The bundled audio covers the public Matrix screening, Louis’s thirty archived lives, and Jules’s two authored lives. The priest’s readings and the spouse’s testimony also play in personalized lives with the same outcomes. Original lines use a device voice when available.

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

Run `npm run voices` from the repository root. Previously recorded passages are reused by their exact script, voice settings and pronunciation overrides. The manifest also stores the SHA-256 digest of the finished audio. After changes to the model or mastering, increment the rendition version in `scripts/voices.ts`.

New passages use the pinned Python dependencies declared in `render-funeral-voices.py`. Install uv or set `EULOGY_VOICE_PYTHON` to an interpreter with `kokoro-onnx==0.6.1` and `soundfile==0.13.1`. The generator also recognizes `.local/voices/.venv` in the checkout. It downloads the public ONNX model and stock voice pack on first use, validates their SHA-256 digests and caches them in `.local/voices/models`. Set `EULOGY_VOICE_MODEL_DIR` to choose another cache. Local inference produces 24 kHz mono MP3s. [uv installation](https://docs.astral.sh/uv/)

The model weights use Apache 2.0. The ONNX runtime wrapper uses the MIT license. The project distributes the speech recordings. [Kokoro model card](https://huggingface.co/hexgrad/Kokoro-82M) · [Publisher’s voice list](https://huggingface.co/hexgrad/Kokoro-82M/blob/main/VOICES.md) · [ONNX model release](https://github.com/thewh1teagle/kokoro-onnx/releases/tag/model-files-v1.0) · [Runtime license](https://github.com/thewh1teagle/kokoro-onnx/blob/main/LICENSE)

## Optional ElevenLabs rendering

`npm run voices -- --elevenlabs` selects Eleven v3. Supply `ELEVENLABS_API_KEY` and one `ELEVENLABS_VOICE_<PERFORMER>` environment variable for each cast voice above, such as `ELEVENLABS_VOICE_BM_GEORGE`. Values are ElevenLabs library voice IDs. The generator checks each ID against the account’s voice metadata before sending the deduplicated public script lines. It accepts premade voices and active professional library voices, including copies added to the account from the library. [Voice metadata](https://elevenlabs.io/docs/api-reference/voices/get) · [Speech API](https://elevenlabs.io/docs/api-reference/text-to-speech/convert)
