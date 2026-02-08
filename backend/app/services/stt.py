"""Speech-to-Text service using Gradium API."""

from __future__ import annotations

import asyncio
import base64
import io
import logging
import struct
import wave

from app.core.env import load_settings

logger = logging.getLogger(__name__)

settings = load_settings()

# Gradium expects 24kHz mono 16-bit PCM
GRADIUM_SAMPLE_RATE = 24000
GRADIUM_FRAME_SIZE = 1920  # 80ms at 24kHz


def _wav_to_pcm_bytes(audio_bytes: bytes) -> bytes:
    """Convert WAV audio to raw PCM bytes at 24kHz mono 16-bit."""
    try:
        with wave.open(io.BytesIO(audio_bytes), "rb") as wf:
            raw = wf.readframes(wf.getnframes())
            src_rate = wf.getframerate()
            src_channels = wf.getnchannels()
            src_width = wf.getsampwidth()

            # Convert to mono if stereo
            if src_channels == 2 and src_width == 2:
                samples = struct.unpack(f"<{len(raw) // 2}h", raw)
                mono = []
                for i in range(0, len(samples), 2):
                    mono.append((samples[i] + samples[i + 1]) // 2)
                raw = struct.pack(f"<{len(mono)}h", *mono)

            # Simple resample if needed (nearest-neighbor for hackathon speed)
            if src_rate != GRADIUM_SAMPLE_RATE and src_width == 2:
                samples = struct.unpack(f"<{len(raw) // 2}h", raw)
                ratio = src_rate / GRADIUM_SAMPLE_RATE
                new_len = int(len(samples) / ratio)
                resampled = [samples[min(int(i * ratio), len(samples) - 1)] for i in range(new_len)]
                raw = struct.pack(f"<{len(resampled)}h", *resampled)

            return raw
    except Exception:
        # If it's already raw PCM, return as-is
        return audio_bytes


async def transcribe_audio(audio_bytes: bytes, filename: str = "audio.wav") -> str:
    """Transcribe audio using Gradium WebSocket STT API.

    Args:
        audio_bytes: Raw audio file bytes (WAV or PCM format)
        filename: Original filename for format detection

    Returns:
        Transcribed text string
    """
    if not settings.gradium_api_key:
        raise ValueError("GRADIUM_API_KEY not configured")

    try:
        import gradium
    except ImportError:
        raise ValueError("gradium package not installed. Run: pip install gradium")

    # Convert to PCM if WAV
    if filename.lower().endswith(".wav") or audio_bytes[:4] == b"RIFF":
        pcm_data = await asyncio.to_thread(_wav_to_pcm_bytes, audio_bytes)
        input_format = "pcm"
    else:
        pcm_data = audio_bytes
        input_format = "pcm"

    # Stream audio to Gradium and collect transcription
    client = gradium.client.GradiumClient(
        api_key=settings.gradium_api_key,
        base_url="https://us.api.gradium.ai/api/",
    )

    async def audio_generator():
        for i in range(0, len(pcm_data), GRADIUM_FRAME_SIZE * 2):  # *2 for 16-bit
            yield pcm_data[i: i + GRADIUM_FRAME_SIZE * 2]

    setup = {
        "model_name": "default",
        "input_format": input_format,
        "json_config": {"language": "en"},
    }

    stream = await client.stt_stream(setup, audio_generator())

    text_parts: list[str] = []
    async for msg in stream._stream:
        if isinstance(msg, dict) and msg.get("type") == "text":
            text_parts.append(msg.get("text", ""))

    return " ".join(text_parts).strip()
