#!/usr/bin/env python3
"""Local pre-submission quality gate. No external network calls or credentials."""
import argparse, hashlib, json, sys, uuid
from datetime import datetime, timezone
from pathlib import Path
from validate import validate


def prepare(path: Path):
    raw = path.read_bytes()
    text = raw.decode("utf-8")
    issues = validate(text)
    return {"source": str(path), "sha256": hashlib.sha256(raw).hexdigest(),
            "valid": not issues, "issues": issues, "ticket": text}


def submit(path: Path, receipt_dir: Path, approve=False, adapter="mock"):
    if adapter != "mock":
        return {"status": "blocked", "reason": "unsupported_adapter", "adapter": adapter}
    result = prepare(path)
    if not result["valid"]:
        return {"status": "blocked", "reason": "contract_validation_failed", **{k:v for k,v in result.items() if k!="ticket"}}
    if not approve:
        return {"status": "ready_for_approval", **{k:v for k,v in result.items() if k!="ticket"}}
    # Local demonstration only: never invokes Linear or an MCP server.
    ticket_id = "MOCK-" + uuid.uuid4().hex[:10].upper()
    receipt = {"status": "submitted_to_mock", "adapter": "mock", "ticket_id": ticket_id,
               "source": str(path), "sha256": result["sha256"],
               "validated": True, "approved": True,
               "timestamp": datetime.now(timezone.utc).isoformat(),
               "verification": "local_mock_receipt_only"}
    receipt_dir.mkdir(parents=True,exist_ok=True)
    out = receipt_dir / (ticket_id + ".json")
    out.write_text(json.dumps(receipt,indent=2)+"\n",encoding="utf-8")
    return {**receipt,"receipt_file":str(out)}


def main():
    p=argparse.ArgumentParser(description="Validate, preview, and optionally submit to a local mock adapter")
    p.add_argument("ticket",type=Path)
    p.add_argument("--approve",action="store_true",help="Explicitly authorize local mock submission")
    p.add_argument("--adapter",default="mock",help="Only mock is implemented")
    p.add_argument("--receipt-dir",type=Path,default=Path(".spca-receipts"))
    args=p.parse_args()
    try: outcome=submit(args.ticket,args.receipt_dir,args.approve,args.adapter)
    except (OSError,UnicodeError) as e: outcome={"status":"blocked","reason":"input_error","detail":str(e)}
    print(json.dumps(outcome,indent=2))
    return 0 if outcome["status"] in ("ready_for_approval","submitted_to_mock") else 1
if __name__=="__main__":sys.exit(main())
