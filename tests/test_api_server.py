from fastapi.testclient import TestClient

from cad_analyzer.api import server


client = TestClient(server.app)


class StubAnalyzer:
    def __init__(self, result):
        self.result = result

    def analyze(self, **kwargs):
        return self.result


def test_single_analyze_returns_502_when_analyzer_reports_error(monkeypatch):
    monkeypatch.setattr(server, "_analyzer", StubAnalyzer({"success": False, "error": "PDF parsing failed"}))

    response = client.post(
        "/analyze",
        files={"file": ("sample.pdf", b"%PDF-1.4 test", "application/pdf")},
        data={"tolerance_class": "m"},
    )

    assert response.status_code == 502
    assert response.json()["detail"] == "PDF parsing failed"


def test_single_analyze_includes_source_metadata(monkeypatch):
    monkeypatch.setattr(
        server,
        "_analyzer",
        StubAnalyzer({"success": True, "drawing_info": {"drawing_number": "ABC-123"}}),
    )

    response = client.post(
        "/analyze",
        files={"file": ("sample.pdf", b"%PDF-1.4 test", "application/pdf")},
        data={"tolerance_class": "m"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["_metadata"]["source_file"] == "sample.pdf"
    assert payload["drawing_info"]["drawing_number"] == "ABC-123"


def test_batch_analyze_keeps_item_error_visible(monkeypatch):
    monkeypatch.setattr(server, "_analyzer", StubAnalyzer({"success": False, "error": "No analysis generated"}))

    response = client.post(
        "/analyze/batch",
        files=[("files", ("sample.pdf", b"%PDF-1.4 test", "application/pdf"))],
        data={"tolerance_class": "m"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["results"][0]["error"] == "No analysis generated"
    assert payload["results"][0]["_metadata"]["source_file"] == "sample.pdf"
