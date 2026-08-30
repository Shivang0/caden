# caden video worker on Modal.
# POST /video { image_urls: [..], prompt, audio_b64 } -> { call_id }
# GET /result/{call_id} -> 202 while rendering, then video/mp4 bytes.
# Animates the founder's photo with LTX-Video (image to video) on an H100,
# then loops the clip under the ElevenLabs voiceover and muxes with ffmpeg.
#
# Weights are baked into the image at build time and the pipeline is loaded
# once per container, so warm requests only pay for generation.
#
# Deploy: modal deploy caden_video.py

import base64
import subprocess
import tempfile
from pathlib import Path

import modal

app = modal.App("caden-video")


MODEL_ID = "Wan-AI/Wan2.2-I2V-A14B-Diffusers"


def download_weights():
    from huggingface_hub import snapshot_download

    snapshot_download(MODEL_ID)


gpu_image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("ffmpeg")
    .pip_install(
        "torch==2.5.1",
        "diffusers==0.35.1",
        "transformers==4.47.1",
        "accelerate==1.2.1",
        "sentencepiece",
        "ftfy",
        "pillow",
        "requests",
        "imageio",
        "imageio-ffmpeg",
        "huggingface_hub",
    )
    .run_function(download_weights)
)

web_image = modal.Image.debian_slim(python_version="3.11").pip_install("fastapi[standard]")

# 49 frames at 16 fps is a 3 second clip. It loops under the voiceover, so a
# short clip keeps the H200 render fast without shortening the final video.
MAX_AREA, FRAMES, FPS, STEPS = 480 * 832, 49, 16, 25

# UGC default: a founder talking to their own phone, not a commercial. The
# genuine-review feedback was that cinematic output reads as AI slop; handheld
# imperfection reads as real.
DEFAULT_PROMPT = (
    "Handheld selfie video from a phone front camera, slightly off-center framing. "
    "The person talks to the camera with natural energy, blinking, small head tilts, "
    "an occasional hand gesture. Real workspace behind them, window daylight from one "
    "side, subtle handheld wobble, ordinary phone exposure with mild grain. Looks like "
    "a founder's quick vlog story, not a commercial. No studio lighting, no color "
    "grading, no readable text or logos."
)

NEGATIVE = (
    "cinematic color grading, studio lighting, slow motion, dolly zoom, dramatic rim light, "
    "perfume ad, static, blurred details, subtitles, paintings, overall gray, worst quality, "
    "low quality, JPEG compression residue, ugly, incomplete, extra fingers, poorly drawn "
    "hands, poorly drawn faces, deformed, disfigured, misshapen limbs, fused fingers, "
    "still picture, frozen face"
)


def _fetch_image(urls):
    import io

    import requests
    from PIL import Image

    headers = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"}
    for url in urls:
        try:
            r = requests.get(url, headers=headers, timeout=12, allow_redirects=True)
            if not r.ok or len(r.content) < 4096:
                continue
            img = Image.open(io.BytesIO(r.content)).convert("RGB")
            if img.width < 200 or img.height < 200:
                continue
            return img
        except Exception:
            continue
    return None


@app.cls(
    image=gpu_image,
    gpu="H200",
    memory=131072,
    timeout=900,
    scaledown_window=600,
)
class Generator:
    @modal.enter()
    def load(self):
        import torch
        from diffusers import AutoencoderKLWan, WanImageToVideoPipeline

        vae = AutoencoderKLWan.from_pretrained(MODEL_ID, subfolder="vae", torch_dtype=torch.float32)
        self.pipe = WanImageToVideoPipeline.from_pretrained(
            MODEL_ID, vae=vae, torch_dtype=torch.bfloat16
        )
        self.pipe.to("cuda")

    @modal.method()
    def generate(self, image_urls: list, prompt: str, audio_b64: str, image_b64: str = "") -> bytes:
        import io
        import math

        import torch
        from diffusers.utils import export_to_video
        from PIL import Image

        img = None
        if image_b64:
            try:
                img = Image.open(io.BytesIO(base64.b64decode(image_b64))).convert("RGB")
            except Exception:
                img = None
        if img is None:
            img = _fetch_image(image_urls)
        if img is None:
            raise ValueError("no usable photo: upload failed to decode and no url worked")

        # aspect-preserving resize onto the VAE/patch grid, as the Wan docs do
        aspect = img.height / img.width
        mod = self.pipe.vae_scale_factor_spatial * self.pipe.transformer.config.patch_size[1]
        height = round(math.sqrt(MAX_AREA * aspect)) // mod * mod
        width = round(math.sqrt(MAX_AREA / aspect)) // mod * mod
        img = img.resize((width, height))

        frames = self.pipe(
            image=img,
            prompt=prompt or DEFAULT_PROMPT,
            negative_prompt=NEGATIVE,
            height=height,
            width=width,
            num_frames=FRAMES,
            num_inference_steps=STEPS,
            guidance_scale=3.5,
            generator=torch.Generator("cuda").manual_seed(7),
        ).frames[0]

        with tempfile.TemporaryDirectory() as td:
            clip = str(Path(td) / "clip.mp4")
            voice = str(Path(td) / "voice.mp3")
            out = str(Path(td) / "final.mp4")
            export_to_video(frames, clip, fps=FPS)
            Path(voice).write_bytes(base64.b64decode(audio_b64))
            # loop the clip under the voiceover, end with the audio
            subprocess.run(
                [
                    "ffmpeg", "-y",
                    "-stream_loop", "-1", "-i", clip,
                    "-i", voice,
                    "-map", "0:v:0", "-map", "1:a:0",
                    "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p",
                    "-c:a", "aac", "-b:a", "128k",
                    "-shortest", "-movflags", "+faststart",
                    out,
                ],
                check=True,
                timeout=120,
            )
            return Path(out).read_bytes()


@app.function(image=web_image, timeout=900)
@modal.asgi_app()
def api():
    from fastapi import FastAPI, HTTPException
    from fastapi.middleware.cors import CORSMiddleware
    from fastapi.responses import Response

    web = FastAPI()
    web.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # The GPU render takes minutes, longer than a browser-friendly HTTP
    # response can stay open through Modal's ingress. So: submit returns a
    # call id at once and the browser polls /result until the mp4 is ready.
    @web.post("/video")
    def video(body: dict):
        urls = body.get("image_urls") or []
        audio_b64 = (body.get("audio_b64") or "").strip()
        image_b64 = (body.get("image_b64") or "").strip()
        if (not urls and not image_b64) or not audio_b64:
            raise HTTPException(400, "audio_b64 plus image_b64 or image_urls are required")
        call = Generator().generate.spawn(urls[:6], body.get("prompt") or "", audio_b64, image_b64)
        return {"call_id": call.object_id}

    @web.get("/result/{call_id}")
    def result(call_id: str):
        fc = modal.FunctionCall.from_id(call_id)
        try:
            data = fc.get(timeout=0)
        except TimeoutError:
            return Response(status_code=202)
        except Exception as err:
            raise HTTPException(502, str(err)[:300])
        return Response(content=data, media_type="video/mp4")

    @web.get("/health")
    def health():
        return {"ok": True}

    return web
