"""
Performance Diagnostic Tool - Identifies bottlenecks in CAD analysis
"""

import time
import base64
from pathlib import Path
from cad_analyzer.core.analyzer import CADAnalyzer


def diagnose_single_file(file_path: str):
    """
    Diagnose performance bottlenecks for a single file analysis.
    Breaks down timing for each step.
    """
    print("=" * 70)
    print(f"DIAGNOSING: {Path(file_path).name}")
    print("=" * 70)
    
    analyzer = CADAnalyzer()
    
    # Step 1: File reading
    start = time.time()
    with open(file_path, 'rb') as f:
        file_bytes = f.read()
    file_read_time = time.time() - start
    file_size_mb = len(file_bytes) / (1024 * 1024)
    print(f"✓ File Read: {file_read_time:.2f}s (Size: {file_size_mb:.2f} MB)")
    
    # Step 2: Base64 encoding
    start = time.time()
    suffix = Path(file_path).suffix.lower()
    is_pdf = suffix == '.pdf'
    mime_type = 'application/pdf' if is_pdf else 'image/jpeg' if suffix in ['.jpg', '.jpeg'] else 'image/png'
    file_payload = base64.b64encode(file_bytes).decode('utf-8')
    encoding_time = time.time() - start
    encoded_size_mb = len(file_payload) / (1024 * 1024)
    print(f"✓ Base64 Encoding: {encoding_time:.2f}s (Encoded: {encoded_size_mb:.2f} MB)")
    
    # Step 3: API call timing
    print(f"\n⏳ Starting Gemini API call ({mime_type})...")
    start = time.time()
    
    try:
        result = analyzer._execute_ai_analysis(file_payload, mime_type)
        api_time = time.time() - start
        
        if result.get('success'):
            print(f"✓ Gemini API: {api_time:.2f}s - SUCCESS")
            
            # Step 4: JSON parsing
            json_size = len(str(result))
            print(f"✓ Response Size: {json_size / 1024:.1f} KB")
            
        else:
            print(f"✗ Gemini API: {api_time:.2f}s - FAILED")
            print(f"  Error: {result.get('error', 'Unknown error')}")
            
    except Exception as e:
        api_time = time.time() - start
        print(f"✗ Gemini API: {api_time:.2f}s - EXCEPTION")
        print(f"  Exception: {str(e)}")
    
    # Summary
    total_time = file_read_time + encoding_time + api_time
    print("\n" + "=" * 70)
    print("TIMING BREAKDOWN:")
    print(f"  File Read:       {file_read_time:6.2f}s ({file_read_time/total_time*100:5.1f}%)")
    print(f"  Base64 Encode:   {encoding_time:6.2f}s ({encoding_time/total_time*100:5.1f}%)")
    print(f"  Gemini API:      {api_time:6.2f}s ({api_time/total_time*100:5.1f}%)")
    print(f"  TOTAL:           {total_time:6.2f}s")
    print("=" * 70)
    
    # Recommendations
    print("\nRECOMMENDATIONS:")
    if api_time > 50:
        print("⚠️  API call taking >50s - this is unusually slow")
        print("    - Check your internet connection")
        print("    - Try a different Gemini model (gemini-1.5-flash vs gemini-1.5-pro)")
        print("    - Consider reducing GEMINI_TIMEOUT_SECONDS if it's waiting too long")
    
    if file_size_mb > 5:
        print(f"⚠️  Large file ({file_size_mb:.2f} MB)")
        print("    - Consider compressing images before analysis")
        print("    - For multi-page PDFs, extract single pages if possible")
    
    if encoding_time > 2:
        print("⚠️  Base64 encoding is slow (shouldn't be >2s)")
        print("    - This might indicate CPU bottleneck")
    
    return total_time


def diagnose_batch(file_paths: list, max_workers: int = 5):
    """
    Test batch processing with different worker counts to find optimal setting.
    """
    from cad_analyzer.core.analyzer import CADAnalyzer
    
    print("\n" + "=" * 70)
    print(f"BATCH PROCESSING TEST: {len(file_paths)} files")
    print("=" * 70)
    
    # Test with different worker counts
    for workers in [1, 3, 5, 10]:
        if workers > len(file_paths):
            break
            
        print(f"\nTesting with {workers} workers...")
        files = [{'file_path': fp} for fp in file_paths]
        
        completed = [0]
        def progress(done, total):
            completed[0] = done
            print(f"  Progress: {done}/{total} files", end='\r')
        
        start = time.time()
        results = analyze_cad_batch(files, max_workers=workers, progress_callback=progress)
        elapsed = time.time() - start
        
        successful = sum(1 for r in results if r.get('success'))
        failed = len(results) - successful
        
        print(f"\n  ✓ Completed in {elapsed:.1f}s")
        print(f"    - Average: {elapsed/len(file_paths):.1f}s per file")
        print(f"    - Success: {successful}, Failed: {failed}")
        
        if workers == 1:
            sequential_time = elapsed
        else:
            speedup = sequential_time / elapsed if elapsed > 0 else 0
            print(f"    - Speedup: {speedup:.1f}x faster than sequential")
    
    print("\n" + "=" * 70)
    print("RECOMMENDATION:")
    print("  If speedup is minimal (<1.5x), the bottleneck is likely:")
    print("    1. API rate limiting (not allowing parallel requests)")
    print("    2. Network bandwidth")
    print("    3. API processing time (not parallelizable)")
    print("=" * 70)


def quick_test_api_speed():
    """
    Quick test to see if Gemini API is responding quickly.
    """
    import google.generativeai as genai
    import os
    
    print("\n" + "=" * 70)
    print("QUICK API SPEED TEST")
    print("=" * 70)
    
    api_key = os.getenv('GEMINI_API_KEY')
    if not api_key:
        print("✗ GEMINI_API_KEY not found in environment")
        return
    
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel('gemini-3-flash-preview')
    
    # Simple text prompt (should be fast)
    print("\nTest 1: Simple text prompt...")
    start = time.time()
    try:
        response = model.generate_content(
            "Say 'hello' and nothing else",
            request_options={"timeout": 30}
        )
        elapsed = time.time() - start
        print(f"✓ Response in {elapsed:.2f}s: {response.text[:50]}")
    except Exception as e:
        elapsed = time.time() - start
        print(f"✗ Failed in {elapsed:.2f}s: {str(e)}")
    
    # Small image prompt
    print("\nTest 2: Small image analysis...")
    try:
        from PIL import Image
    except ImportError:
        print("⚠️  PIL not installed - skipping image test")
        print("   Install with: pip install Pillow")
        return
    
    import base64
    import io
    
    img = Image.new('RGB', (100, 100), color='red')
    buffer = io.BytesIO()
    img.save(buffer, format='PNG')
    img_data = base64.b64encode(buffer.getvalue()).decode('utf-8')
    
    start = time.time()
    try:
        response = model.generate_content(
            ["What color is this image?", {'mime_type': 'image/png', 'data': img_data}],
            request_options={"timeout": 30}
        )
        elapsed = time.time() - start
        print(f"✓ Response in {elapsed:.2f}s: {response.text[:50]}")
    except Exception as e:
        elapsed = time.time() - start
        print(f"✗ Failed in {elapsed:.2f}s: {str(e)}")
    
    print("\n" + "=" * 70)
    print("If both tests are fast (<5s), the issue is:")
    print("  - Large file sizes being analyzed")
    print("  - Complex prompt requiring more processing")
    print("  - Network latency to Gemini servers")
    print("=" * 70)


# MAIN DIAGNOSTIC MENU
if __name__ == "__main__":
    import sys
    
    print("""
    CAD Analyzer Performance Diagnostic Tool
    ==========================================
    
    This tool helps identify why your analysis is slow.
    
    Options:
    1. Diagnose single file (detailed timing breakdown)
    2. Test batch processing (find optimal worker count)
    3. Quick API speed test (check Gemini API responsiveness)
    """)
    
    choice = input("Enter choice (1/2/3): ").strip()
    
    if choice == "1":
        file_path = input("Enter file path: ").strip()
        if Path(file_path).exists():
            diagnose_single_file(file_path)
        else:
            print(f"File not found: {file_path}")
    
    elif choice == "2":
        print("Enter file paths (one per line, empty line to finish):")
        file_paths = []
        while True:
            path = input().strip()
            if not path:
                break
            if Path(path).exists():
                file_paths.append(path)
            else:
                print(f"  Warning: {path} not found, skipping")
        
        if file_paths:
            diagnose_batch(file_paths)
        else:
            print("No valid files provided")
    
    elif choice == "3":
        quick_test_api_speed()
    
    else:
        print("Invalid choice")