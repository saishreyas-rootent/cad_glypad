"""
Test suite for Gemini-powered CAD Drawing Analysis
"""

import os
import sys
import pytest
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from eDOCr.tools.gemini_analyzer import GeminiAnalyzer
from eDOCr.tools.standards_db import StandardsDB
from eDOCr.tools.hybrid_pipeline import HybridPipeline, analyze_drawing


# Test samples directory
SAMPLES_DIR = Path(__file__).parent / 'test_samples'
RESULTS_DIR = Path(__file__).parent / 'test_Results'


class TestStandardsDB:
    """Test the standards database"""
    
    def test_iso2768_linear_tolerances(self):
        """Test ISO 2768 linear tolerance lookup"""
        # Fine class
        assert StandardsDB.get_linear_tolerance(5, 'f') == 0.05
        assert StandardsDB.get_linear_tolerance(20, 'f') == 0.1
        
        # Medium class
        assert StandardsDB.get_linear_tolerance(5, 'm') == 0.1
        assert StandardsDB.get_linear_tolerance(50, 'm') == 0.3
        
        # Coarse class
        assert StandardsDB.get_linear_tolerance(10, 'c') == 0.5
    
    def test_fit_tolerance_calculation(self):
        """Test fit tolerance calculations"""
        # H7 hole, 20mm nominal
        h7_tol = StandardsDB.get_fit_tolerance(20, 'H7')
        assert h7_tol is not None
        assert h7_tol.lower == 0
        assert h7_tol.upper > 0
        
        # H12 hole, 38mm nominal (from Candle holder drawing)
        h12_tol = StandardsDB.get_fit_tolerance(38, 'H12')
        assert h12_tol is not None
    
    def test_gauge_requirement(self):
        """Test go/no-go gauge requirement detection"""
        assert StandardsDB.requires_gauge('H7') == True
        assert StandardsDB.requires_gauge('H12') == False
        assert StandardsDB.requires_gauge('h6') == True
    
    def test_measurement_methods(self):
        """Test GDT measurement method lookup"""
        runout_method = StandardsDB.get_measurement_method('Circular Runout')
        assert 'dial indicator' in runout_method['instrument']
        assert runout_method['requires_fixture'] == True


class TestGeminiAnalyzer:
    """Test the Gemini analyzer (requires API key)"""
    
    @pytest.fixture
    def analyzer(self):
        """Create analyzer instance"""
        try:
            return GeminiAnalyzer()
        except ValueError:
            pytest.skip("GEMINI_API_KEY not set")
    
    def test_analyzer_initialization(self, analyzer):
        """Test analyzer can be initialized"""
        assert analyzer is not None
        assert analyzer.model is not None
    
    @pytest.mark.skipif(not (SAMPLES_DIR / 'Candle_holder.jpg').exists(),
                       reason="Sample file not found")
    def test_candle_holder_analysis(self, analyzer):
        """Test analysis of Candle_holder.jpg"""
        image_path = str(SAMPLES_DIR / 'Candle_holder.jpg')
        result = analyzer.analyze_drawing(image_path)
        
        # Check structure
        assert 'dimensions' in result or 'info_block' in result
        
        # Should detect some dimensions
        if 'dimensions' in result:
            dims = result['dimensions']
            print(f"Found {len(dims)} dimensions")
            for dim in dims:
                print(f"  - {dim.get('value')}")
    
    @pytest.mark.skipif(not (SAMPLES_DIR / 'Candle_holder.jpg').exists(),
                       reason="Sample file not found")
    def test_dimension_extraction(self, analyzer):
        """Test dimension extraction with tolerance application"""
        image_path = str(SAMPLES_DIR / 'Candle_holder.jpg')
        dimensions = analyzer.extract_dimensions_with_tolerances(image_path, 'm')
        
        print(f"Extracted {len(dimensions)} dimensions with tolerances")
        for dim in dimensions:
            print(f"  {dim.value}: {dim.nominal} ±{dim.upper_tolerance}/{dim.lower_tolerance}")
    
    @pytest.mark.skipif(not (SAMPLES_DIR / 'Candle_holder.jpg').exists(),
                       reason="Sample file not found") 
    def test_inspection_report(self, analyzer):
        """Test inspection report generation"""
        image_path = str(SAMPLES_DIR / 'Candle_holder.jpg')
        report = analyzer.generate_inspection_report(image_path)
        
        assert len(report) > 0
        assert 'INSPECTION REPORT' in report
        print(report)


class TestHybridPipeline:
    """Test the hybrid eDOCr + Gemini pipeline"""
    
    @pytest.fixture
    def pipeline(self):
        """Create pipeline instance"""
        try:
            return HybridPipeline()
        except ValueError:
            pytest.skip("GEMINI_API_KEY not set")
    
    @pytest.mark.skipif(not (SAMPLES_DIR / 'Candle_holder.jpg').exists(),
                       reason="Sample file not found")
    def test_full_pipeline(self, pipeline):
        """Test complete pipeline processing"""
        image_path = str(SAMPLES_DIR / 'Candle_holder.jpg')
        dest_dir = str(RESULTS_DIR / 'hybrid_test')
        
        result = pipeline.process_drawing(image_path, dest_dir, 'm')
        
        # Check outputs
        assert 'dimensions' in result
        assert 'gdts' in result
        assert 'manufacturing' in result
        assert 'output_files' in result
        
        # Check files were created
        for file_type, file_path in result['output_files'].items():
            assert os.path.exists(file_path), f"Missing output: {file_type}"
        
        print(f"\nAnalysis Results:")
        print(f"  Dimensions: {len(result['dimensions'])}")
        print(f"  GDTs: {len(result['gdts'])}")
        print(f"  Critical dims: {result['manufacturing']['critical_dimension_count']}")
        print(f"  Runout features: {result['manufacturing']['runout_features']}")


def run_quick_test():
    """Quick test to verify setup"""
    print("=" * 50)
    print("CAD Drawing Analysis - Quick Test")
    print("=" * 50)
    
    # Test 1: Standards DB
    print("\n1. Testing Standards Database...")
    tol = StandardsDB.get_linear_tolerance(25, 'm')
    print(f"   ISO 2768-m tolerance for 25mm: ±{tol}mm")
    
    h12 = StandardsDB.get_fit_tolerance(38, 'H12')
    if h12:
        print(f"   H12 tolerance for ⌀38: +{h12.upper:.3f}/{h12.lower:.3f}mm")
    
    # Test 2: Gemini Analyzer
    print("\n2. Testing Gemini Connection...")
    try:
        analyzer = GeminiAnalyzer()
        print("   ✓ Gemini API connected successfully")
        
        # Test 3: Analyze a sample
        sample = SAMPLES_DIR / 'Candle_holder.jpg'
        if sample.exists():
            print(f"\n3. Analyzing {sample.name}...")
            result = analyzer.analyze_drawing(str(sample))
            
            if 'error' not in result:
                print("   ✓ Analysis successful!")
                print(f"   Dimensions found: {len(result.get('dimensions', []))}")
                print(f"   GDTs found: {len(result.get('gdts', []))}")
                
                # Print some details
                info = result.get('info_block', {})
                if info:
                    print(f"\n   Drawing Info:")
                    print(f"     Title: {info.get('title', 'N/A')}")
                    print(f"     Material: {info.get('material', 'N/A')}")
                    print(f"     Standard: {info.get('standard', 'N/A')}")
            else:
                print(f"   ⚠ Analysis returned with note: {result.get('error')}")
        else:
            print(f"   Sample file not found: {sample}")
            
    except ValueError as e:
        print(f"   ✗ {e}")
    except Exception as e:
        print(f"   ✗ Error: {e}")
    
    print("\n" + "=" * 50)


if __name__ == '__main__':
    run_quick_test()
