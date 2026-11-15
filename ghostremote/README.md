# GHOSTremote ONE v1.0.0 — current owner-beta release candidate

**v0.8.0 and v0.9.0 are deprecated; do not run their installers.**

This is the SSD-less Ubuntu Live (BOOTFORGE) adapter, not a verified physical installation. It uses an existing owner-only Cloudflare Access SSH route. No internal SSD or BOOTFORGE partition change required.

## One command in the HP Ubuntu terminal

```bash
python3 -c 'import urllib.request,base64,gzip,hashlib,pathlib,os;u="https://raw.githubusercontent.com/OnlyClinton/CPX1/be239c78c0894580383a045852aca74de7b70c90/ghostremote/ghostremote-one-v1.0.0.sh.gz.b64";b=urllib.request.urlopen(u,timeout=30).read(100000);d=gzip.decompress(base64.b64decode(b,validate=True));assert len(d)<100000 and hashlib.sha256(d).hexdigest()=="048c7a8dbd10f08f83d525c7ce1cddec7274197cc79b49e0223b9eadbe8be432","GHOSTremote integrity check FAILED";p=pathlib.Path.home()/".local/bin/ghostremote";p.parent.mkdir(parents=True,exist_ok=True);t=p.with_suffix(".new");t.write_bytes(d);t.chmod(0o700);os.replace(t,p);os.execv("/bin/bash",["bash",str(p),"connect"])'
```

The command downloads a package from an immutable Git commit using Python, checks SHA-256 of the decompressed installer, then starts guided local enrollment. The installer asks for LIVE-ONLY authorization, your Cloudflare owner's email prefix, a separate new remote password (16+ characters), optional sudo (default no), and your existing HP Cloudflare tunnel token in a hidden local prompt. Never share passwords or tunnel tokens in chat.

After the connector reports ready, test from another browser at https://ssh.hp.remote.cpx.agency. Then use ghostremote status / ghostremote disconnect from the HP. This is SSH terminal only, not a GUI desktop. Reboot ends an ordinary Live session.

## Evidence and limits

- SHA-256 source: 048c7a8dbd10f08f83d525c7ce1cddec7274197cc79b49e0223b9eadbe8be432
- Immutable release commit: be239c78c0894580383a045852aca74de7b70c90
- Exact Git compressed blob SHA-1: 87f1f842d3b8e7fdfaa7d43e8e44b83efb197ea6
- 24 local/offline tests pass, including simulated cleanup; no physical HP installation or phone login tested.
- Owner-only Access policy exists; MFA enforcement remains unverified.
- Windows, macOS, installed Linux host adapters are diagnostics-only; cross-platform browser access is a design, not an acceptance result.
- Do not enable Ventoy persistence without verified backup and testing.
