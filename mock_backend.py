"""
간이 Mock Backend — QnA 저장 엔드포인트 확인용.
Agent가 POST /internal/v1/interviews/sessions/{id}/qnas 로 보내는 요청을 수신·출력한다.

실행: python mock_backend.py
"""

from http.server import HTTPServer, BaseHTTPRequestHandler
import json


class Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length)
        try:
            data = json.loads(body)
        except json.JSONDecodeError:
            data = body.decode("utf-8", errors="replace")

        print(f"\n{'='*60}")
        print(f"[QnA 수신] {self.path}")
        print(f"  turnNumber : {data.get('turnNumber')}")
        print(f"  question   : {data.get('question', '')[:80]}")
        print(f"  answer     : {data.get('answer', '')[:80]}")
        print(f"  intent     : {data.get('intent', '')}")
        print(f"  isFollowUp : {data.get('isFollowUp')}")
        print(f"{'='*60}\n")

        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps({"success": True}).encode())

    def log_message(self, format, *args):
        pass  # 기본 로그 숨김


if __name__ == "__main__":
    port = 8080
    server = HTTPServer(("0.0.0.0", port), Handler)
    print(f"Mock Backend 실행 중 — http://localhost:{port}")
    print("Agent의 QnA 저장 요청을 기다리는 중...\n")
    server.serve_forever()
