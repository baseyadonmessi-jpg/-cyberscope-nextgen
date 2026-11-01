#!/usr/bin/env python3
"""CYBERSCOPE NEXT GEN V2 — analyse défensive de journaux."""

import argparse
import ipaddress
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

ERROR_PATTERN = re.compile(r"\b(error|critical|fatal)\b", re.I)
IP_PATTERN = re.compile(r"\b(?:\d{1,3}\.){3}\d{1,3}\b")


def find_ipv4_addresses(line):
    """Retourne les adresses IPv4 valides trouvées dans une ligne."""
    found = []
    for match in IP_PATTERN.finditer(line):
        value = match.group(0)
        try:
            ipaddress.IPv4Address(value)
            if value not in found:
                found.append(value)
        except ipaddress.AddressValueError:
            continue
    return found


def analyze_log(text, threshold=5):
    """Analyse un journal et retourne un rapport structuré."""
    if not isinstance(text, str):
        raise TypeError("Le journal doit être du texte.")
    if not isinstance(threshold, int) or threshold < 1:
        raise ValueError("Le seuil doit être un entier supérieur ou égal à 1.")

    lines = text.splitlines()
    counts = Counter()
    failed_by_ip = Counter()
    failed_lines_by_ip = defaultdict(list)
    observed_ips = set()
    alerts = []

    for number, line in enumerate(lines, start=1):
        lower = line.lower()
        addresses = find_ipv4_addresses(line)
        observed_ips.update(addresses)

        failed = any(re.search(p, lower) for p in FAILED_PATTERNS)
        success = any(re.search(p, lower) for p in SUCCESS_PATTERNS)

        if failed:
            counts["failed_authentication"] += 1
            if addresses:
                source_ip = addresses[0]
                failed_by_ip[source_ip] += 1
                failed_lines_by_ip[source_ip].append(number)
        elif success:
            counts["successful_authentication"] += 1
        else:
            counts["other"] += 1

        if ERROR_PATTERN.search(line):
            alerts.append({
                "severity": "medium",
                "type": "security_log_keyword",
                "line": number,
                "reason": "Un mot-clé d'erreur mérite une vérification.",
                "evidence": line[:300],
                "recommendation": (
                    "Consulter le contexte de l'événement et les journaux "
                    "associés avant de conclure à un incident."
                ),
            })

    for source_ip, count in failed_by_ip.items():
        if count >= threshold:
            alerts.append({
                "severity": "high",
                "type": "repeated_authentication_failures",
                "source_ip": source_ip,
                "count": count,
                "lines": failed_lines_by_ip[source_ip],
                "reason": (
                    f"{count} échecs d'authentification associés à cette IP. "
                    "Cela peut indiquer une activité suspecte, sans la prouver."
                ),
                "recommendation": (
                    "Vérifier les heures, les comptes concernés et les "
                    "événements voisins. Appliquer les procédures de sécurité "
                    "habituelles si l'activité est confirmée."
                ),
            })

    severity_counts = Counter(a["severity"] for a in alerts)

    recommendations = []
    if counts["failed_authentication"] > 0:
        recommendations.append(
            "Vérifier les échecs d'authentification, les heures et les comptes concernés."
        )
    if severity_counts["high"] > 0:
        recommendations.append(
            "Examiner en priorité les alertes de sévérité élevée et suivre la procédure de sécurité."
        )
    if severity_counts["medium"] > 0:
        recommendations.append(
            "Examiner le contexte des événements signalés avant de conclure à un incident."
        )
    if not recommendations:
        recommendations.append(
            "Aucune recommandation urgente générée par les règles actuelles ; poursuivre la surveillance habituelle."
        )

    return {
        "product": "CYBERSCOPE NEXT GEN",
        "engine_version": "2.0",
        "report_type": "defensive_log_analysis",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "input_lines": len(lines),
        "threshold": threshold,
        "summary": {
            "failed_authentication": counts["failed_authentication"],
            "successful_authentication": counts["successful_authentication"],
            "other": counts["other"],
        },
        "statistics": {
            "unique_ipv4_addresses": len(observed_ips),
            "ips_with_authentication_failures": len(failed_by_ip),
            "alerts_by_severity": {
                "high": severity_counts["high"],
                "medium": severity_counts["medium"],
                "low": severity_counts["low"],
            },
        },
        "alerts_count": len(alerts),
        "alerts": alerts,
        "recommendations": recommendations,
        "limitations": [
            "Les résultats dépendent des motifs textuels reconnus.",
            "Les alertes sont des indices à vérifier, pas des preuves d'attaque.",
            "Une adresse IP dans un journal ne prouve pas l'identité d'une personne.",
            "Les plages IP de documentation peuvent apparaître dans les tests.",
        ],
    }


def main():
    parser = argparse.ArgumentParser(
        description="CYBERSCOPE NEXT GEN V2 — analyse défensive de journaux."
    )
    parser.add_argument("file", help="Chemin du journal à analyser")
    parser.add_argument("--threshold", type=int, default=5)
    parser.add_argument("--output", help="Chemin d'un nouveau rapport JSON")
    args = parser.parse_args()

    if args.threshold < 1:
        parser.error("--threshold doit être supérieur ou égal à 1")

    source = Path(args.file)
    if not source.is_file():
        parser.error(f"Fichier introuvable : {source}")

    try:
        text = source.read_text(encoding="utf-8", errors="replace")
        report = analyze_log(text, args.threshold)
        output = json.dumps(report, indent=2, ensure_ascii=False)
        if args.output:
            destination = Path(args.output)
            if destination.exists():
                parser.error(f"Le rapport existe déjà : {destination}")
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_text(output + "\n", encoding="utf-8")
            print(f"Rapport enregistré : {destination}")
        print(output)
    except (OSError, ValueError) as error:
        parser.error(str(error))


if __name__ == "__main__":
    main()
