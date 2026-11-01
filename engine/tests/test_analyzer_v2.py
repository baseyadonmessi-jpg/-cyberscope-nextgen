import unittest
from engine.analyzer_v2 import analyze_log


class AnalyzerV2Tests(unittest.TestCase):
    def test_empty_log(self):
        result = analyze_log("")
        self.assertEqual(result["input_lines"], 0)
        self.assertEqual(result["alerts_count"], 0)

    def test_failed_authentication(self):
        result = analyze_log("Failed password for demo from 192.0.2.10")
        self.assertEqual(result["summary"]["failed_authentication"], 1)

    def test_successful_authentication(self):
        result = analyze_log("Accepted password for demo from 192.0.2.10")
        self.assertEqual(result["summary"]["successful_authentication"], 1)

    def test_unique_ipv4_statistics(self):
        result = analyze_log(
            "Failed password from 192.0.2.10\n"
            "Accepted password from 198.51.100.20"
        )
        self.assertEqual(result["statistics"]["unique_ipv4_addresses"], 2)

    def test_repeated_failures_at_threshold(self):
        log = "\n".join(
            f"Failed password for user{i} from 192.0.2.10"
            for i in range(2)
        )
        result = analyze_log(log, threshold=2)
        alerts = [
            alert for alert in result["alerts"]
            if alert["type"] == "repeated_authentication_failures"
        ]
        self.assertEqual(len(alerts), 1)
        self.assertEqual(alerts[0]["count"], 2)
        self.assertIn("recommendation", alerts[0])

    def test_invalid_ipv4_is_ignored(self):
        result = analyze_log("Failed password from 999.999.999.999")
        self.assertEqual(result["statistics"]["unique_ipv4_addresses"], 0)

    def test_invalid_threshold_is_rejected(self):
        with self.assertRaises(ValueError):
            analyze_log("", threshold=0)

    def test_error_alert_has_recommendation(self):
        result = analyze_log("server: ERROR test operation")
        alert = next(
            item for item in result["alerts"]
            if item["type"] == "security_log_keyword"
        )
        self.assertIn("recommendation", alert)


if __name__ == "__main__":
    unittest.main()
