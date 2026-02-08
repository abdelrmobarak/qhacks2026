"""Text-to-Speech service using Gradium API."""

from __future__ import annotations

import logging

import gradium

from app.core.env import load_settings

logger = logging.getLogger(__name__)

settings = load_settings()


async def synthesize_speech(text: str, voice_id: str | None = None) -> bytes:
    """Synthesize text to WAV audio bytes using Gradium TTS API.

    Args:
        text: The text to synthesize into speech.
        voice_id: Optional override for the Gradium voice ID.
            Falls back to settings.gradium_tts_voice_id.

    Returns:
        Raw WAV audio bytes.
    """
    if not settings.gradium_api_key:
        raise ValueError("GRADIUM_API_KEY not configured")

    resolved_voice_id = voice_id or settings.gradium_tts_voice_id

    client = gradium.client.GradiumClient(
        api_key=settings.gradium_api_key,
        base_url="https://us.api.gradium.ai/api/",
    )

    result = await client.tts(
        setup={
            "voice_id": resolved_voice_id,
            "output_format": "wav",
            "model_name": "default",
        },
        text=text,
    )

    return result.raw_data
