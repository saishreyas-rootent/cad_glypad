import os
from flask import Flask, request, jsonify, send_from_directory, render_template
from flask_cors import CORS
from werkzeug.utils import secure_filename
from analyzer import analyze_drawing

app = Flask(__name__)
CORS(app)

app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['RESULT_FOLDER'] = 'static/results'
app.config['MAX_CONTENT_LENGTH'] = 32 * 1024 * 1024 # 32MB

os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs(app.config['RESULT_FOLDER'], exist_ok=True)
os.makedirs('templates', exist_ok=True)

@app.route('/')
def index():
    return render_template('dashboard.html')

@app.route('/api/analyze', methods=['POST'])
def api_analyze():
    if 'file' not in request.files:
        return jsonify({"error": "No file uploaded"}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "Empty filename"}), 400
    
    filename = secure_filename(file.filename)
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    file.save(filepath)
    
    result_filename = f"result_{os.path.splitext(filename)[0]}.jpg"
    result_path = os.path.join(app.config['RESULT_FOLDER'], result_filename)
    
    try:
        report = analyze_drawing(filepath, result_path)
        return jsonify({
            "success": True,
            "original_url": f"/files/uploads/{report['processed_image']}",
            "result_url": f"/files/results/{result_filename}",
            "status": report['status'],
            "items": report.get('items', [])
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/files/uploads/<filename>')
def get_upload(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

@app.route('/files/results/<filename>')
def get_result(filename):
    return send_from_directory(app.config['RESULT_FOLDER'], filename)

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5001))
    app.run(host='0.0.0.0', port=port, debug=True)
