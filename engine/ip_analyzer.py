import ipaddress
from datetime import datetime, timezone


def analyze_ip(value: str) -> dict:
    """Analyse défensive d'une adresse IPv4 ou IPv6."""

    value = value.strip()

    result = {
        "input": value,
        "valid": False,
        "version": None,
        "classification": "inconnue",
        "is_private": False,
        "is_global": False,
        "is_reserved": False,
        "is_loopback": False,
        "is_multicast": False,
        "recommendations": [],
        "analyzed_at": datetime.now(timezone.utc).isoformat(),
    }

    try:
        address = ipaddress.ip_address(value)
    except ValueError:
        result["recommendations"].append(
            "Adresse invalide : vérifiez le format IPv4 ou IPv6."
        )
        return result

    result["valid"] = True
    result["version"] = address.version
    result["is_private"] = address.is_private
    result["is_global"] = address.is_global
    result["is_reserved"] = address.is_reserved
    result["is_loopback"] = address.is_loopback
    result["is_multicast"] = address.is_multicast

    if address.is_loopback:
        classification = "boucle locale"
    elif address.is_multicast:
        classification = "multidiffusion"
    elif address.is_reserved:
        classification = "réservée"
    elif address.is_global:
        classification = "publique"
    elif address.is_private:
        classification = "privée"
    else:
        classification = "spéciale ou non globale"

    result["classification"] = classification

    if address.is_global:
        result["recommendations"].append(
            "Une adresse publique peut être exposée sur Internet. "
            "Cela ne signifie pas qu'elle est malveillante."
        )

    if address.is_private:
        result["recommendations"].append(
            "Adresse privée : elle est généralement utilisée dans un réseau local."
        )

    if address.is_loopback:
        result["recommendations"].append(
            "Adresse de boucle locale : elle désigne l'appareil lui-même."
        )

    if address.is_reserved or not address.is_global:
        result["recommendations"].append(
            "Cette classification ne prouve pas qu'une adresse est dangereuse."
        )

    result["recommendations"].append(
        "Cette analyse examine uniquement le format et les propriétés de l'adresse. "
        "Elle ne vérifie pas la réputation de l'IP ni son activité réelle."
    )

    return result


if __name__ == "__main__":
    import json

    examples = [
        "8.8.8.8",
        "192.168.1.1",
        "127.0.0.1",
        "adresse-invalide",
    ]

    for example in examples:
        print(json.dumps(analyze_ip(example), indent=2, ensure_ascii=False))
