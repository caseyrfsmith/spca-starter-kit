#!/usr/bin/env python3
"""Optional post-edit adapter. See README.md before enabling."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'tools'))
from hook import main
if __name__ == '__main__':
    sys.exit(main('claude'))
