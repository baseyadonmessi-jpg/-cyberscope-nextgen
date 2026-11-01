#!/usr/bin/env python3
"""Assistant défensif local de CYBERSCOPE NEXT GEN."""

from datetime import datetime, timezone


def explain_alert(alert):
    """Explique une alerte à partir de ses éléments observés."""
    if not isinstance(alert, dict):
        raise ValueError("L'alerte doit être un objet JSON.")

    alert_type = str(alert.get("type", "unknown"))
    severity = str(alert.get("severity", "unknown")).lower()
    reason = str(alert.get("reason", "")).strip()
    evidence = str(alert.get("evidence", "")).strip()

    if alert_type == "repeated_authentication_failures":
        title = "Échecs d'authentification répétés"
        explanation = (
            "Plusieurs tentatives de connexion ont échoué pour une même "
            "adresse source. Cela peut correspondre à une erreur de saisie, "
            "à un service mal configuré ou à une activité suspecte."
        )
        checks = [
            "Vérifier les heures et la fréquence des tentatives.",
            "Identifier les comptes concernés et rechercher les connexions réussies voisines.",
            "Comparer les événements avec les activités habituelles du système.",
        ]

    elif alert_type == "security_log_keyword":
        title = "Mot-clé d'erreur dans un journal"
        explanation = (
            "Le journal contient un terme signalant une erreur ou un événement "
            "important. Ce seul élément ne suffit pas à confirmer un incident de sécurité."
        )
        checks = [
            "Lire les lignes précédentes et suivantes pour comprendre le contexte.",
            "Vérifier si le service concerné fonctionne normalement.",
            "Rechercher des événements similaires à la même période.",
        ]

    else:
        title = "Alerte à examiner"
        explanation = (
            "Le type d'alerte n'est pas reconnu par les règles locales. "
            "L'assistant ne doit pas inventer une cause."
        )
        checks = [
            "Consulter la définition de cette alerte dans l'analyseur source.",
            "Vérifier les éléments observés et leur contexte.",
            "Faire valider l'interprétation avant toute action importante.",
        ]

    priorities = {
        "high": "Élevée",
        "medium": "Moyenne",
        "low": "Faible",
    }
    priority = priorities.get(severity, "À déterminer")

    return {
        "assistant": "CYBERSCOPE DEFENSIVE ASSISTANT",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "alert_type": alert_type,
        "title": title,
        "priority": priority,
        "explanation": explanation,
        "observed_reason": reason[:1000],
        "evidence": evidence[:300],
        "recommended_checks": checks,
        "limitations": [
            "L'explication repose sur des règles locales, pas sur un modèle d'IA générative.",
            "Une alerte est un indice à vérifier, pas une preuve d'attaque.",
            "Ne bloquez pas une adresse et ne désactivez pas un compte sur cette seule base.",
        ],
    }


def explain_request(data):
    """Valide la requête et renvoie l'explication."""
    if not isinstance(data, dict):
        raise ValueError("La requête doit être un objet JSON.")

    alert = data.get("alert")
    if not isinstance(alert, dict):
        raise ValueError("Le champ 'alert' doit être un objet JSON.")

    if len(str(alert)) > 12000:
        raise ValueError("L'alerte est trop volumineuse.")

    return explain_alert(alert)
