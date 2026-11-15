#!/usr/bin/env python3
"""GHOSTUSB read-only preflight v1.0.

Independent of GHOSTos, GHOSTremote and GHOSTaccess.
No writes, mounts, network requests, privilege escalation or device changes.
"""
import argparse
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys

VERSION = "1.0.0"
TARGET_GLOBS = (
    "ghostos-native-build.*", "ghostos-native.*", "ghostusb*", "GHOST*"
)


def command(argv, timeout=6):
    if not shutil.which(argv[0]):
        return {"available": False, "reason": f"{argv[0]} not installed"}
    try:
        p = subprocess.run(argv, text=True, capture_output=True,
                           timeout=timeout, check=False)
        return {"available": True, "exit_code": p.returncode,
                "stdout": p.stdout[:28000], "stderr": p.stderr[:1000]}
    except (OSError, subprocess.TimeoutExpired) as exc:
        return {"available": True, "error": type(exc).__name__}


def scan_paths(home):
    findings = []
    seen = set()
    for glob in TARGET_GLOBS:
        for path in home.glob(glob):
            if path.name in seen:
                continue
            seen.add(path.name)
            item = {"name": path.name, "is_directory": path.is_dir(),
                    "is_symlink": path.is_symlink()}
            if path.is_dir() and not path.is_symlink():
                try:
                    children = sorted(path.iterdir(), key=lambda p: p.name.lower())
                    item["top_level_entries"] = [p.name for p in children[:45]]
                    item["entries_truncated"] = len(children) > 45
                except OSError as exc:
                    item["error"] = type(exc).__name__
            findings.append(item)
    return sorted(findings, key=lambda item: item["name"])


def main():
    p = argparse.ArgumentParser(description="Read-only GHOSTUSB/GHOSTos host preflight")
    p.add_argument("--scan", action="store_true", help="Inspect disks and existing build directories")
    p.add_argument("--json", action="store_true", help="Print machine-readable JSON only")
    args = p.parse_args()
    if not args.scan:
        p.print_help()
        return 0
    home = Path.home()
    disk = command(["lsblk", "--json", "--bytes", "-o",
                    "NAME,PATH,TYPE,SIZE,TRAN,FSTYPE,LABEL,MOUNTPOINTS,MODEL,RM"])
    if disk.get("exit_code") == 0:
        try:
            disk["devices"] = json.loads(disk.pop("stdout"))["blockdevices"]
        except (ValueError, KeyError, TypeError):
            disk["error"] = "Unable to parse lsblk JSON"
    boot_mode = "UEFI" if Path("/sys/firmware/efi").is_dir() else "Legacy/unknown"
    secure_boot = command(["mokutil", "--sb-state"])
    result = {
        "tool": "GHOSTUSB read-only preflight", "version": VERSION,
        "run_as_root": os.geteuid() == 0 if hasattr(os, "geteuid") else False,
        "host_platform": sys.platform, "boot_mode": boot_mode,
        "secure_boot": secure_boot, "disks": disk,
        "home_build_inventory": scan_paths(home),
        "checks_not_performed": [
            "Native GHOSTos boot", "GHOSTremote pairing and authorization",
            "GHOSTaccess identity-provider SSO", "USB backup integrity",
            "ISO signature verification", "bootloader installation",
        ],
        "status": "INVENTORY_ONLY; NOT BOOT OR SECURITY CERTIFICATION",
        "changes_made": "None"
    }
    if args.json:
        print(json.dumps(result, indent=2, default=str))
    else:
        print("=== GHOSTUSB / GHOSTos READ-ONLY PREFLIGHT ===")
        print("Boot:", boot_mode)
        print("Secure Boot:", secure_boot.get("stdout", "not available").strip() or "not determined")
        print("\nExisting build candidates in:", home)
        for item in result["home_build_inventory"]:
            print(" -", item["name"], "(directory)" if item["is_directory"] else "(file)")
            if "top_level_entries" in item:
                print("   Contents:", ", ".join(item["top_level_entries"]) or "(empty)")
        if not result["home_build_inventory"]:
            print("  No matching build folders in the current home directory")
        print("\nBlock devices (inventory only):")
        devices = disk.get("devices", [])
        def display(items, indent=0):
            for item in items:
                print("  " * indent, item.get("path", item.get("name")),
                      "type=", item.get("type"), "size_bytes=", item.get("size"),
                      "transport=", item.get("tran"), "label=", item.get("label"),
                      "mountpoints=", item.get("mountpoints"))
                display(item.get("children", []), indent + 1)
        display(devices)
        if not devices:
            print("  lsblk could not be read:", disk.get("error") or disk.get("stderr") or "no devices")
        print("\nRESULT: Inventory only. No files, partitions, or boot entries changed.")
        print("DO NOT flash/repartition before verifying backup and device identity.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
