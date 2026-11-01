import unittest
from engine.analyzer import analyze_log


class AnalyzerTests(unittest.TestCase):
    def test_empty_log(self):
        result = analyze_log("")
        self.assertEqual(result["input_lines"], 0)
        self.assertEqual(result["alerts_count"], 0)

    def test_failed_authentication_count(self):
        result = analyze_log("Failed password for user from 192.0.2.10")
        self.assertEqual(result["summary"]["failed_authentication"], 1)

    def test_successful_authentication_count(self):
        result = analyze_log("Accepted password for demo from 192.0.2.10")
        self.assertEqual(result["summary"]["successful_authentication"], 1)

    def test_repeated_failures_alert(self):
        log = "\n".join(
            f"Failed password for user{i} from 192.0.2.10"
            for i in range(5)
        )
        result = analyze_log(log, threshold=5)
        alerts = [
            alert for alert in result["alerts"]
            if alert["type"] == "repeated_authentication_failures"
        ]
        self.assertEqual(len(alerts), 1)
        self.assertEqual(alerts[0]["count"], 5)

    def test_error_keyword_alert(self):
        result = analyze_log("server: ERROR unable to complete operation")
        self.assertTrue(
            any(alert["type"] == "security_log_keyword"
                for alert in result["alerts"])
        )


if __name__ == "__main__":
    unittest.main()
