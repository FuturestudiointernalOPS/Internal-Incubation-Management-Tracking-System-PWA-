#!/usr/bin/env python3
"""Run the synthetic Programmes checks in a bounded, disposable offline database.
Requires an already-installed postgres:16-alpine Docker image. No .env loading,
network, host mounts, production connections or application server.
"""
import argparse
import json
import signal
import subprocess
import sys
import uuid
import time
from pathlib import Path


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', required=True)
    parser.add_argument('--node', default='node')
    parser.add_argument('--metadata', help='Optional read-only catalog export; selects representative reconstruction instead of the synthetic suite')
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[2]
    subprocess.run(['docker', 'image', 'inspect', 'postgres:16-alpine'], check=True, capture_output=True, timeout=15)
    name = 'impactos-wl-synthetic-' + uuid.uuid4().hex[:12]
    container_id = None

    def interrupted(_signum, _frame):
        raise KeyboardInterrupt()
    signal.signal(signal.SIGTERM, interrupted)
    try:
        result = subprocess.run(['docker', 'run', '--rm', '-d', '--name', name,
            '--network', 'none', '--memory', '384m', '--cpus', '1', '--pids-limit', '128',
            '--tmpfs', '/var/lib/postgresql/data:rw,size=256m', '--tmpfs', '/var/run/postgresql:rw,size=16m',
            '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', '-e', 'POSTGRES_DB=impactos_wl_synthetic',
            'postgres:16-alpine'], check=True, capture_output=True, text=True, timeout=30)
        container_id = result.stdout.strip()
        if len(container_id) != 64 or any(c not in '0123456789abcdef' for c in container_id):
            raise RuntimeError('Unrecognised Docker container ID')
        if args.metadata:
            for _ in range(60):
                ready = subprocess.run(['docker','exec',container_id,'psql','-X','-qAt','-U','postgres','-d','impactos_wl_synthetic','-c','SELECT 1'], capture_output=True, timeout=10)
                if ready.returncode == 0: break
                time.sleep(0.5)
            else: raise RuntimeError('Isolated database did not become ready')
            command = [sys.executable, str(root/'scripts/white-label/test-representative-schema.py'), '--container', name, '--metadata', args.metadata, '--output', args.output]
        else:
            command = [sys.executable, str(root/'scripts/white-label/test-programs-migrations.py'), '--container', name, '--node', args.node, '--output', args.output]
        subprocess.run(command, check=True, timeout=300)
        report = json.loads(Path(args.output).read_text())
        report['resourceLimits'] = {'databaseMemoryMiB': 384, 'databaseCpus': 1, 'network': 'none'}
        Path(args.output).write_text(json.dumps(report, indent=2)+'\n')
    finally:
        if container_id:
            subprocess.run(['docker', 'stop', '-t', '3', container_id], capture_output=True, timeout=15, check=False)


if __name__ == '__main__':
    main()
