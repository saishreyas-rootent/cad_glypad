"""CAD Analyzer Package."""

__version__ = "2.0.0"
__all__ = ["CADAnalyzer", "analyze_cad_drawing"]


def __getattr__(name):
    if name in __all__:
        from .core import CADAnalyzer, analyze_cad_drawing

        exports = {
            "CADAnalyzer": CADAnalyzer,
            "analyze_cad_drawing": analyze_cad_drawing,
        }
        return exports[name]
    raise AttributeError(f"module 'cad_analyzer' has no attribute {name!r}")
