import json
import os
import time
from io import BytesIO
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

from prompt_builder import SYSTEM_PROMPT, build_user_prompt
from template_exporter import build_workbook


HOST = "127.0.0.1"
PORT = 8090


def json_response(handler, status, payload):
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    handler.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
    handler.end_headers()
    handler.wfile.write(body)


def binary_response(handler, status, body, content_type, filename=None):
    handler.send_response(status)
    handler.send_header("Content-Type", content_type)
    handler.send_header("Content-Length", str(len(body)))
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.send_header("Access-Control-Expose-Headers", "Content-Disposition")
    if filename:
        safe_name = quote(filename)
        handler.send_header(
            "Content-Disposition",
            f"attachment; filename*=UTF-8''{safe_name}",
        )
    handler.end_headers()
    handler.wfile.write(body)


def normalize_chat_url(base_url):
    url = str(base_url or "").strip()
    if not url:
        return "https://api.openai.com/v1/chat/completions"
    if url.rstrip("/").endswith("/chat/completions"):
        return url
    return f"{url.rstrip('/')}/chat/completions"


def resolve_llm_config(payload):
    request_config = payload.get("llmConfig") or {}
    api_key = request_config.get("apiKey") or os.getenv("COSMIC_LLM_API_KEY", "")
    base_url = request_config.get("baseUrl") or os.getenv(
        "COSMIC_LLM_BASE_URL",
        "https://api.openai.com/v1/chat/completions",
    )
    model = request_config.get("model") or os.getenv("COSMIC_LLM_MODEL", "gpt-4o-mini")

    return {
        "api_key": str(api_key).strip(),
        "base_url": normalize_chat_url(base_url),
        "model": str(model).strip(),
    }


def describe_http_error(error):
    try:
        body = error.read().decode("utf-8", errors="replace")
    except Exception:
        body = ""

    if error.code in (401, 403):
        return f"大模型鉴权失败（HTTP {error.code}）：请检查 API Key、模型权限或账号余额。"
    if error.code == 404:
        return f"大模型接口不存在（HTTP 404）：请检查 Base URL 是否正确，通常需要指向 /chat/completions。"

    detail = " ".join(body.strip().split())
    if len(detail) > 180:
        detail = f"{detail[:180]}..."
    suffix = f"：{detail}" if detail else ""
    return f"大模型接口返回错误（HTTP {error.code}）{suffix}"


def describe_url_error(error, base_url):
    reason = str(getattr(error, "reason", error))
    reason_lower = reason.lower()

    if "winerror 10061" in reason_lower or "actively refused" in reason_lower:
        return f"大模型接口连接被拒绝：请检查 Base URL 是否可访问，当前地址为 {base_url}"
    if "timed out" in reason_lower or "timeout" in reason_lower:
        return f"大模型接口请求超时：请检查网络、代理或接口服务状态，当前地址为 {base_url}"
    if "name or service not known" in reason_lower or "nodename" in reason_lower:
        return f"大模型接口域名解析失败：请检查 Base URL 是否写错，当前地址为 {base_url}"

    return f"大模型接口请求失败：{reason}"


def post_chat_completion(config, messages, extra_payload=None, timeout=120):
    request_payload = {
        "model": config["model"],
        "messages": messages,
    }
    request_payload.update(extra_payload or {})

    request = Request(
        config["base_url"],
        data=json.dumps(request_payload, ensure_ascii=False).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {config['api_key']}",
        },
        method="POST",
    )

    try:
        with urlopen(request, timeout=timeout) as response:
            return json.loads(response.read().decode("utf-8"))
    except HTTPError as error:
        raise RuntimeError(describe_http_error(error)) from error
    except URLError as error:
        raise RuntimeError(describe_url_error(error, config["base_url"])) from error


def call_chat_api(payload):
    config = resolve_llm_config(payload)
    model = config["model"]

    if not config["api_key"]:
        raise RuntimeError("未配置 COSMIC_LLM_API_KEY")

    data = post_chat_completion(
        config,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": build_user_prompt(payload)},
        ],
        extra_payload={"temperature": 0.2},
        timeout=120,
    )

    choices = data.get("choices", [])
    if not choices:
        raise RuntimeError("模型未返回有效内容")

    message = choices[0].get("message", {})
    content = message.get("content", "")
    return {
        "raw": data,
        "content": content,
        "model": data.get("model", model),
    }


def test_chat_api(payload):
    config = resolve_llm_config(payload)
    if not config["api_key"]:
        raise RuntimeError("请先填写 API Key")
    if not config["model"]:
        raise RuntimeError("请先填写模型名称")

    start = time.monotonic()
    data = post_chat_completion(
        config,
        messages=[
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": "请只回复 OK。"},
        ],
        extra_payload={"temperature": 0, "max_tokens": 8, "stream": False},
        timeout=30,
    )
    elapsed_ms = int((time.monotonic() - start) * 1000)

    choices = data.get("choices", [])
    if not choices:
        raise RuntimeError("接口可连接，但模型未返回有效内容")

    message = choices[0].get("message", {})
    content = str(message.get("content", "")).strip()
    return {
        "ok": True,
        "model": data.get("model", config["model"]),
        "baseUrl": config["base_url"],
        "latencyMs": elapsed_ms,
        "preview": content[:80],
    }


class CosmicHandler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        json_response(self, 200, {"ok": True})

    def do_GET(self):
        if self.path == "/health":
            json_response(self, 200, {"ok": True, "service": "cosmic-splitter-backend"})
            return

        json_response(self, 404, {"error": "Not Found"})

    def do_POST(self):
        try:
            length = int(self.headers.get("Content-Length", "0"))
            raw_body = self.rfile.read(length).decode("utf-8") if length else "{}"
            payload = json.loads(raw_body or "{}")

            if self.path == "/api/generate":
                result = call_chat_api(payload)
                json_response(self, 200, result)
                return

            if self.path == "/api/test-llm":
                result = test_chat_api(payload)
                json_response(self, 200, result)
                return

            if self.path == "/api/export-template":
                rows = payload.get("rows") or []
                project_name = payload.get("projectName") or "COSMIC拆分结果"
                workbook = build_workbook(rows, project_name)
                buffer = BytesIO()
                workbook.save(buffer)
                filename = f"{project_name}-COSMIC拆分结果.xlsx"
                binary_response(
                    self,
                    200,
                    buffer.getvalue(),
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    filename=filename,
                )
                return

            json_response(self, 404, {"error": "Not Found"})
        except Exception as error:
            json_response(self, 500, {"error": str(error)})

    def log_message(self, format, *args):
        return


if __name__ == "__main__":
    server = ThreadingHTTPServer((HOST, PORT), CosmicHandler)
    print(f"Cosmic backend listening on http://{HOST}:{PORT}")
    server.serve_forever()
