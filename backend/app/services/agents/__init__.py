"""Agent network for evidence processing and story generation.

This module implements the multi-agent architecture described in AGENT_NETWORK.md:
- Thread Agent (A): Summarizes email threads
- Meeting Agent (B): Summarizes calendar events
- Dossier Agent (C): Creates entity dossiers from thread/meeting summaries
- Theme Agent (D): Extracts global themes from snapshot
- Story Writer (E): Generates grounded relationship stories
- Verifier (F): Fact-checks stories against evidence
"""

from app.services.agents.thread_agent import summarize_thread, summarize_threads_batch
from app.services.agents.meeting_agent import summarize_meeting, summarize_meetings_batch
from app.services.agents.dossier_agent import create_dossier
from app.services.agents.theme_agent import extract_global_themes
from app.services.agents.story_agent import generate_story, verify_story, fix_claims

__all__ = [
    "summarize_thread",
    "summarize_threads_batch",
    "summarize_meeting",
    "summarize_meetings_batch",
    "create_dossier",
    "extract_global_themes",
    "generate_story",
    "verify_story",
    "fix_claims",
]
