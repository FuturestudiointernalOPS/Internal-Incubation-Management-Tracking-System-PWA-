#!/usr/bin/env python3
"""Rebuild graphify graph for a path, AST-only (no LLM/subagent cost).
Refuses if the corpus contains doc/paper/image files (those need Claude
semantic extraction) so it never silently produces an incomplete graph.
Usage: python3 graphify_rebuild.py <path>
"""
import sys
import json
from pathlib import Path
from datetime import datetime, timezone

TARGET = sys.argv[1] if len(sys.argv) > 1 else "src"


def fail(msg):
    print(f"ERROR: {msg}", file=sys.stderr)
    sys.exit(1)


def main():
    from graphify.detect import detect, save_manifest
    from graphify.extract import collect_files, extract
    from graphify.build import build_from_json
    from graphify.cluster import cluster, score_all
    from graphify.analyze import god_nodes, surprising_connections, suggest_questions
    from graphify.report import generate
    from graphify.export import to_json

    detection = detect(Path(TARGET))

    non_code = sum(
        len(v) for k, v in detection.get("files", {}).items() if k != "code"
    )
    if non_code:
        fail(
            f"{non_code} non-code file(s) found (docs/papers/images). "
            "Those need Claude semantic extraction (subagents) - "
            "ask Claude to run the full /graphify pipeline manually instead "
            "of this script."
        )

    code_files = []
    for f in detection.get("files", {}).get("code", []):
        p = Path(f)
        code_files.extend(collect_files(p) if p.is_dir() else [p])

    if not code_files:
        fail("No code files found - nothing to rebuild.")

    ast = extract(code_files)
    print(f"AST: {len(ast['nodes'])} nodes, {len(ast['edges'])} edges")

    extraction = {
        "nodes": ast["nodes"],
        "edges": ast["edges"],
        "input_tokens": 0,
        "output_tokens": 0,
    }

    G = build_from_json(extraction)
    if G.number_of_nodes() == 0:
        fail("Graph is empty - extraction produced no nodes.")

    communities = cluster(G)
    cohesion = score_all(G, communities)
    gods = god_nodes(G)
    surprises = surprising_connections(G, communities)
    labels = {cid: f"Community {cid}" for cid in communities}
    questions = suggest_questions(G, communities, labels)
    tokens = {"input": 0, "output": 0}

    Path("graphify-out").mkdir(exist_ok=True)
    report = generate(
        G, communities, cohesion, labels, gods, surprises, detection, tokens,
        TARGET, suggested_questions=questions,
    )
    Path("graphify-out/GRAPH_REPORT.md").write_text(report)
    to_json(G, communities, "graphify-out/graph.json")

    save_manifest(detection["files"])

    cost_path = Path("graphify-out/cost.json")
    cost = (
        json.loads(cost_path.read_text())
        if cost_path.exists()
        else {"runs": [], "total_input_tokens": 0, "total_output_tokens": 0}
    )
    cost["runs"].append({
        "date": datetime.now(timezone.utc).isoformat(),
        "input_tokens": 0,
        "output_tokens": 0,
        "files": detection.get("total_files", 0),
    })
    cost_path.write_text(json.dumps(cost, indent=2))

    print(
        f"Graph: {G.number_of_nodes()} nodes, {G.number_of_edges()} edges, "
        f"{len(communities)} communities"
    )
    print("Rebuild complete (AST-only, 0 LLM tokens).")


if __name__ == "__main__":
    main()
