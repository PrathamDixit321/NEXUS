import hashlib
import logging
import math
import httpx

from app.core.config import get_settings

logger = logging.getLogger("nexusai.ai_service")
settings = get_settings()


def get_mock_embedding(text: str, dimension: int = 768) -> list[float]:
    """Generate a deterministic normalized vector for offline testing."""
    vector = []
    for i in range(dimension):
        h = hashlib.md5(f"{text}:{i}".encode("utf-8")).hexdigest()
        val = int(h[:8], 16) / 4294967295.0
        vector.append(val * 2.0 - 1.0)
    
    magnitude = math.sqrt(sum(v * v for v in vector))
    if magnitude > 0:
        vector = [v / magnitude for v in vector]
    return vector


def cosine_similarity(v1: list[float], v2: list[float]) -> float:
    """Calculate the cosine similarity between two float vectors."""
    if len(v1) != len(v2):
        return 0.0
    dot_product = sum(a * b for a, b in zip(v1, v2))
    magnitude1 = math.sqrt(sum(a * a for a in v1))
    magnitude2 = math.sqrt(sum(a * a for a in v2))
    if magnitude1 * magnitude2 == 0:
        return 0.0
    return dot_product / (magnitude1 * magnitude2)


def get_embedding(text: str) -> list[float]:
    """Retrieve text embedding from API (Gemini/OpenAI) or fallback to mock vector."""
    if settings.gemini_api_key:
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key={settings.gemini_api_key}"
            payload = {
                "model": "models/text-embedding-004",
                "content": {
                    "parts": [{"text": text}]
                }
            }
            with httpx.Client(timeout=10.0) as client:
                response = client.post(url, json=payload)
                response.raise_for_status()
                return response.json()["embedding"]["values"]
        except Exception as e:
            logger.error(f"Failed to fetch Gemini embedding: {e}. Falling back to mock embedding.")
            
    elif settings.openai_api_key:
        try:
            url = "https://api.openai.com/v1/embeddings"
            headers = {"Authorization": f"Bearer {settings.openai_api_key}"}
            payload = {
                "input": text,
                "model": "text-embedding-3-small"
            }
            with httpx.Client(timeout=10.0) as client:
                response = client.post(url, headers=headers, json=payload)
                response.raise_for_status()
                return response.json()["data"][0]["embedding"]
        except Exception as e:
            logger.error(f"Failed to fetch OpenAI embedding: {e}. Falling back to mock embedding.")

    # Fallback mode
    return get_mock_embedding(text)


def generate_completion(system_prompt: str, user_prompt: str) -> str:
    """Generate LLM completion from active API (Gemini/OpenAI) or fallback to local templates."""
    if settings.gemini_api_key:
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={settings.gemini_api_key}"
            payload = {
                "systemInstruction": {
                    "parts": [{"text": system_prompt}]
                },
                "contents": [
                    {
                        "role": "user",
                        "parts": [{"text": user_prompt}]
                    }
                ]
            }
            with httpx.Client(timeout=30.0) as client:
                response = client.post(url, json=payload)
                response.raise_for_status()
                return response.json()["candidates"][0]["content"]["parts"][0]["text"]
        except Exception as e:
            logger.error(f"Failed Gemini completion: {e}. Falling back to mock completion.")

    elif settings.openai_api_key:
        try:
            url = "https://api.openai.com/v1/chat/completions"
            headers = {"Authorization": f"Bearer {settings.openai_api_key}"}
            payload = {
                "model": "gpt-4o-mini",
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ]
            }
            with httpx.Client(timeout=30.0) as client:
                response = client.post(url, headers=headers, json=payload)
                response.raise_for_status()
                return response.json()["choices"][0]["message"]["content"]
        except Exception as e:
            logger.error(f"Failed OpenAI completion: {e}. Falling back to mock completion.")

    # Fallback mock responses
    return get_mock_completion(system_prompt, user_prompt)


def get_mock_completion(system_prompt: str, user_prompt: str) -> str:
    """Generate local rules-based simulation response utilizing context chunks."""
    context_text = ""
    if "Context information:" in system_prompt:
        parts = system_prompt.split("Context information:")
        if len(parts) > 1:
            context_text = parts[1].strip()
            # Clean up instructions at the end of the prompt if present
            if "Rules to follow:" in context_text:
                context_text = context_text.split("Rules to follow:")[0].strip()

    if context_text:
        # Extract first source filename and content for display
        # Sample context format: [Source: file.pdf (Page 1)]
        source_name = "Retrieved Document"
        if "[Source:" in context_text:
            try:
                source_name = context_text.split("[Source:")[1].split("]")[0]
            except Exception:
                pass
        
        # Take a cleaned preview of the text
        preview = context_text.replace("[Source:", "").replace("]", "")
        if len(preview) > 350:
            preview = preview[:350] + "..."
            
        return (
            f"[Demo Mode Response — Offline]\n\n"
            f"Based on the retrieved context from **{source_name}**:\n\n"
            f"\"{preview}\"\n\n"
            f"I have formulated this response to answer your question: \"{user_prompt}\".\n"
            f"(Note: Put your Gemini or OpenAI API keys in the `backend/.env` file to enable live AI responses.)"
        )

    return (
        f"[Demo Mode Response — Offline]\n\n"
        f"I received your question: \"{user_prompt}\". However, I couldn't find any relevant context documents in the workspace database.\n"
        f"Please upload documents in the **Documents** tab first so I can find relevant answers!"
    )
