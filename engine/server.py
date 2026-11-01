#!/usr/bin/env python3
"""Serveur local pour CYBERSCOPE NEXT GEN."""

import json
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

BASE_DIR = Path(__file__).resolve().parent.parent
MAX_BODY_SIZE = 2 * 1024 * 1024
ALLOWED_ORIGINS = {
    "http://127.0.0.1:8000",
    "http://localhost:8000",
}

sys.path.insert(0, str(Path(__file__).resolve().parent))
from analyzer import analyze_log
from analyzer_v2 import analyze_log as analyze_log_v2
from ip_analyzer import analyze_ip
from assistant import explain_request


class CyberScopeHandler(BaseHTTPRequestHandler):
    def send_json(self, status, data):
        payload = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Cache-Control", "no-store")
        origin = self.headers.get("Origin")
        if origin in ALLOWED_ORIGINS:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
        self.end_headers()
        self.wfile.write(payload)

    def do_OPTIONS(self):
        path = urlparse(self.path).path
        origin = self.headers.get("Origin")

        if path not in {"/api/analyze", "/api/analyze-v2", "/api/ip-analyze", "/api/assistant"} or origin not in ALLOWED_ORIGINS:
            self.send_json(403, {"error": "Origine ou route non autorisée"})
            return

        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", origin)
        self.send_header("Vary", "Origin")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Max-Age", "600")
        self.end_headers()

    def do_GET(self):
        path = urlparse(self.path).path

        if path == "/api/health":
            self.send_json(200, {
                "status": "ok",
                "product": "CYBERSCOPE NEXT GEN",
                "engine": "defensive_log_analysis",
            })
            return

        if path == "/api/ip-analyze":
            self.send_json(200, {
                "status": "ok",
                "module": "ip_intelligence",
                "description": "Analyse défensive d'adresses IP"
            })
            return

        self.send_json(404, {"error": "Route introuvable"})

    def do_POST(self):
        path = urlparse(self.path).path

        if path == "/api/assistant":
            try:
                size = int(self.headers.get("Content-Length", "0"))
            except ValueError:
                self.send_json(400, {"error": "Taille de requête invalide"})
                return

            if size <= 0 or size > 16384:
                self.send_json(413, {"error": "Requête limitée à 16 Ko"})
                return

            try:
                raw = self.rfile.read(size)
                body = json.loads(raw.decode("utf-8"))
                result = explain_request(body)
            except (UnicodeDecodeError, json.JSONDecodeError):
                self.send_json(400, {"error": "JSON invalide"})
                return
            except ValueError as exc:
                self.send_json(400, {"error": str(exc)})
                return

            self.send_json(200, result)
            return

        if path == "/api/ip-analyze":
            try:
                size = int(self.headers.get("Content-Length", "0"))
            except ValueError:
                self.send_json(400, {"error": "Taille de requête invalide"})
                return

            if size <= 0 or size > 4096:
                self.send_json(413, {"error": "Envoyez une adresse IP valide"})
                return

            try:
                body = json.loads(self.rfile.read(size).decode("utf-8"))
            except (UnicodeDecodeError, json.JSONDecodeError):
                self.send_json(400, {"error": "JSON invalide"})
                return

            if not isinstance(body, dict) or not isinstance(body.get("ip"), str):
                self.send_json(400, {"error": "Le champ ip doit être une chaîne de caractères"})
                return

            report = analyze_ip(body["ip"])
            self.send_json(200, report)
            return

        if path == "/api/analyze-v2":
            try:
                size = int(self.headers.get("Content-Length", "0"))
            except ValueError:
                self.send_json(400, {"error": "Taille de requête invalide"})
                return

            if size <= 0 or size > MAX_BODY_SIZE:
                self.send_json(413, {
                    "error": "Le contenu doit peser entre 1 octet et 2 Mo"
                })
                return

            try:
                raw = self.rfile.read(size)
                body = json.loads(raw.decode("utf-8"))
            except (UnicodeDecodeError, json.JSONDecodeError):
                self.send_json(400, {"error": "JSON invalide"})
                return

            if not isinstance(body, dict) or not isinstance(body.get("text"), str):
                self.send_json(400, {
                    "error": "Le champ text doit contenir le journal à analyser"
                })
                return

            threshold = body.get("threshold", 5)
            if type(threshold) is not int or not 1 <= threshold <= 1000:
                self.send_json(400, {
                    "error": "threshold doit être un entier entre 1 et 1000"
                })
                return

            report = analyze_log_v2(body["text"], threshold)
            self.send_json(200, report)
            return

        if path != "/api/analyze":
            self.send_json(404, {"error": "Route introuvable"})
            return

        try:
            size = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            self.send_json(400, {"error": "Taille de requête invalide"})
            return

        if size <= 0 or size > MAX_BODY_SIZE:
            self.send_json(413, {
                "error": "Le contenu doit peser entre 1 octet et 2 Mo"
            })
            return

        try:
            raw = self.rfile.read(size)
            body = json.loads(raw.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            self.send_json(400, {"error": "JSON invalide"})
            return

        if not isinstance(body, dict) or not isinstance(body.get("text"), str):
            self.send_json(400, {
                "error": "Le champ text doit contenir le journal à analyser"
            })
            return

        threshold = body.get("threshold", 5)
        if type(threshold) is not int or not 1 <= threshold <= 1000:
            self.send_json(400, {
                "error": "threshold doit être un entier entre 1 et 1000"
            })
            return

        report = analyze_log(body["text"], threshold)
        self.send_json(200, report)

    def log_message(self, format_string, *args):
        print("[CYBERSCOPE]", format_string % args)


def main():
    host = "127.0.0.1"
    port = 8765
    server = ThreadingHTTPServer((host, port), CyberScopeHandler)

    print("CYBERSCOPE NEXT GEN — serveur local")
    print(f"Adresse : http://{host}:{port}")
    print("Arrêt : Ctrl+C")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nArrêt du serveur...")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
