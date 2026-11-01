#!/usr/bin/env python3
"""CYBERSCOPE NEXT GEN — moteur défensif d'analyse de journaux."""

import argparse
import json
import re
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

FAILED_PATTERNS = [
    r"failed password",
    r"authentication failure",
    r"login failed",
    r"invalid user",
    r"failed login",
]

SUCCESS_PATTERNS = [
    r"accepted password",
    r"authentication successful",
    r"login successful",
    r"logged in successfully",
]

IP_PATTERN = re.compile(r"\b(?:\d{1,3}\.){3}\d{1,3}\b")


def valid_ipv4(value):
    parts = value.split(".")
    return (
        len(parts) == 4
        and all(part.isdigit() and 0 <= int(part) <= 255 for part in parts)
    )


def analyze_log(text, threshold=5):
    lines = text.splitlines()
    failed_by_ip = Counter()
    failed_lines_by_ip = defaultdict(list)
    alerts = []
    event_counts = Counter()

    for line_number, line in enumerate(lines, start=1):
        lower = line.lower()

        is_failed = any(re.search(pattern, lower) for pattern in FAILED_PATTERNS)
        is_success = any(re.search(pattern, lower) for pattern in SUCCESS_PATTERNS)

        if is_failed:
            event_counts["failed_authentication"] += 1
        elif is_success:
            event_counts["successful_authentication"] += 1
        else:
            event_counts["other"] += 1

        if is_failed:
            addresses = [
                match.group(0)
                for match in IP_PATTERN.finditer(line)
                if valid_ipv4(match.group(0))
            ]

            if addresses:
                ip = addresses[0]
                failed_by_ip[ip] += 1
                failed_lines_by_ip[ip].append(line_number)

        if re.search(r"\b(error|critical|fatal)\b", lower):
            alerts.append({
                "severity": "medium",
                "type": "security_log_keyword",
                "line": line_number,
                "reason": "La ligne contient un mot-clé d'erreur à examiner.",
                "evidence": line[:300],
            })

    for ip, count in failed_by_ip.items():
        if count >= threshold:
            alerts.append({
                "severity": "high",
                "type": "repeated_authentication_failures",
                "source_ip": ip,
                "count": count,
                "lines": failed_lines_by_ip[ip],
                "reason": (
                    f"{count} échecs d'authentification associés à cette IP ; "
                    "cela peut indiquer une activité suspecte, sans la prouver."
                ),
            })

    return {
        "product": "CYBERSCOPE NEXT GEN",
        "report_type": "defensive_log_analysis",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "input_lines": len(lines),
        "threshold": threshold,
        "summary": dict(event_counts),
        "alerts_count": len(alerts),
        "alerts": alerts,
        "limitations": [
            "Les résultats dépendent des motifs textuels reconnus.",
            "Une alerte est un indice à vérifier, pas une preuve d'attaque.",
            "Les adresses IP présentes dans les journaux ne prouvent pas "
            "l'identité d'une personne."
        ],
    }


def main():
    parser = argparse.ArgumentParser(
        description="Analyse défensive de journaux de sécurité."
    )
    parser.add_argument("file", help="Chemin du fichier journal à analyser")
    parser.add_argument(
        "--threshold",
        type=int,
        default=5,
        help="Nombre d'échecs avant alerte (défaut : 5)",
    )
    parser.add_argument(
        "--output",
        help="Chemin du rapport JSON à créer",
    )
    args = parser.parse_args()

    if args.threshold < 1:
        parser.error("--threshold doit être supérieur ou égal à 1")

    source = Path(args.file)
    if not source.is_file():
        parser.error(f"Fichier introuvable : {source}")

    try:
        text = source.read_text(encoding="utf-8", errors="replace")
    except OSError as error:
        parser.error(f"Lecture impossible : {error}")

    report = analyze_log(text, args.threshold)
    output = json.dumps(report, indent=2, ensure_ascii=False)

    if args.output:
        destination = Path(args.output)
        try:
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_text(output + "\n", encoding="utf-8")
        except OSError as error:
            parser.error(f"Écriture du rapport impossible : {error}")

        print(f"Rapport enregistré : {destination}")

    print(output)


if __name__ == "__main__":
    main()
