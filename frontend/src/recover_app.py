import json
import re

log_file = r"C:\Users\Dell\.gemini\antigravity-ide\brain\19f85927-9726-4b3e-9d62-66d4ea111662\.system_generated\logs\transcript.jsonl"
out_file = r"C:\Users\Dell\CAD-drawings-e6d565afe1da1b0f5ea65371f1a7757566818c71\frontend\src\App.jsx.recovered"

content_blocks = {} # line_start -> list of lines

with open(log_file, "r", encoding="utf-8") as f:
    for line in f:
        if "App.jsx" in line:
            try:
                data = json.loads(line)
                
                # Check for view_file response
                if data.get("type") == "VIEW_FILE" and "App.jsx" in data.get("content", ""):
                    content = data["content"]
                    m = re.search(r"Showing lines (\d+) to (\d+)", content)
                    if m:
                        start = int(m.group(1))
                        if "The following code has been modified" in content:
                            lines_part = content.split("The following code has been modified")[1].split("The above content")[0]
                            lines = []
                            for l in lines_part.strip().split("\n"):
                                if ":" in l:
                                    idx = l.find(":")
                                    lines.append(l[idx+2:])
                            content_blocks[start] = lines
                            print(f"Got VIEW_FILE block starting at {start} length {len(lines)}")
                
                # Check for replace_file_content targets
                if data.get("type") == "PLANNER_RESPONSE":
                    for tc in data.get("tool_calls", []):
                        if tc.get("name") in ["replace_file_content", "multi_replace_file_content"]:
                            args = tc.get("args", {})
                            if "App.jsx" in args.get("TargetFile", ""):
                                start = int(args.get("StartLine", 0))
                                target = args.get("TargetContent", "")
                                if start > 0 and target:
                                    content_blocks[start] = target.split("\n")
                                    print(f"Got replacement target block starting at {start} length {len(content_blocks[start])}")
                                    
                                if tc.get("name") == "multi_replace_file_content":
                                    for chunk in args.get("ReplacementChunks", []):
                                        start = int(chunk.get("StartLine", 0))
                                        target = chunk.get("TargetContent", "")
                                        if start > 0 and target:
                                            content_blocks[start] = target.split("\n")
                                            print(f"Got multi replacement target block starting at {start} length {len(content_blocks[start])}")
            except Exception as e:
                pass

print("Found blocks at lines:", sorted(content_blocks.keys()))

full_lines = [""] * 1500
for start in sorted(content_blocks.keys()):
    lines = content_blocks[start]
    for i, l in enumerate(lines):
        full_lines[start - 1 + i] = l

while full_lines and full_lines[-1] == "":
    full_lines.pop()

with open(out_file, "w", encoding="utf-8") as f:
    f.write("\n".join(full_lines))

print(f"Wrote recovered file to {out_file} with {len(full_lines)} lines")
