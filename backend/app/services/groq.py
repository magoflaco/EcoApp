import base64
import requests

GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions"

def groq_chat(api_key: str, model: str, messages: list, temperature: float = 0.3, max_tokens: int = 700) -> str:
    if not api_key:
        return "⚠️ Katara no está configurada (falta GROQ_API_KEY_CHAT)."
    payload = {"model": model, "messages": messages, "temperature": temperature, "max_tokens": max_tokens}
    r = requests.post(GROQ_ENDPOINT, headers={"Authorization": f"Bearer {api_key}", "Content-Type":"application/json"}, json=payload, timeout=60)
    r.raise_for_status()
    return r.json()["choices"][0]["message"]["content"]

def groq_vision(api_key: str, model: str, prompt: str, image_bytes: bytes, mime: str = "image/jpeg") -> str:
    if not api_key:
        return '{"error":"missing GROQ_API_KEY_VISION"}'
    data_url = f"data:{mime};base64," + base64.b64encode(image_bytes).decode("utf-8")
    messages = [{
        "role":"user",
        "content":[
            {"type":"text","text":prompt},
            {"type":"image_url","image_url":{"url":data_url}},
        ],
    }]
    payload = {"model": model, "messages": messages, "temperature": 0.2, "max_tokens": 700}
    r = requests.post(GROQ_ENDPOINT, headers={"Authorization": f"Bearer {api_key}", "Content-Type":"application/json"}, json=payload, timeout=90)
    r.raise_for_status()
    return r.json()["choices"][0]["message"]["content"]
