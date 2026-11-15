# GHOSTremote ONE v1.1.0 — GUI enrollment (current owner beta)

**Older v0.8 through v1.0.1 installers are superseded.** Use the exact v1.1.0 command below from the HP's local graphical Ubuntu Live session.

This release is tailored for SSD-less HP Spectre booted from BOOTFORGE Live Ubuntu. No changes to BOOTFORGE partitions or the internal SSD.

## One-command installer

```bash
GHOSTREMOTE_OWNER=onlyclinton python3 -c 'import urllib.request,base64,gzip,hashlib,pathlib,os;u="https://raw.githubusercontent.com/OnlyClinton/CPX1/e51e54d330a2d2e7dfbd01318866e4e6773fc262/ghostremote/ghostremote-one-v1.1.0.gui.sh.gz.b64";b=urllib.request.urlopen(u,timeout=30).read(100000);d=gzip.decompress(base64.b64decode(b,validate=True));assert len(d)<100000 and hashlib.sha256(d).hexdigest()=="94454ec25e18658d7f490a8337c70a885eb9aa74e37d283ba0d55d816dd9ecd4","GHOSTremote integrity check FAILED";p=pathlib.Path.home()/".local/bin/ghostremote";p.parent.mkdir(parents=True,exist_ok=True);t=p.with_suffix(".new");t.write_bytes(d);t.chmod(0o700);os.replace(t,p);os.execv("/bin/bash",["bash",str(p),"connect"])'
```

The command pins an immutable Git commit, verifies SHA-256 of the decompressed script, and launches the native GTK wizard. The approved Cloudflare owner username is **preselected**, never requested as text input. The user sees a consent popup, two masked password popups, optional admin-access question (off by default), and a masked token-paste popup. If the passwords differ, the wizard retries without recreating any accounts; cancellation triggers cleanup.

The package uses Ubuntu-signed Zenity if needed and may require your local Ubuntu password for sudo. Cloudflare's existing HP tunnel token must be pasted locally in the hidden popup. Never send it to chat, GitHub or the web page.

## Operator use

- After success, GHOSTremote ONE appears in the Ubuntu applications menu as a local popup control center.
- Terminal commands remain `ghostremote status`, `ghostremote doctor`, and `ghostremote disconnect`.
- Browser client: https://ssh.hp.remote.cpx.agency, protected by owner-restricted Cloudflare Access.
- Shutdown ends the Live session; HP tunnel and phone login are not verified until the user completes setup.

## Release evidence

- Decompressed source SHA-256: `94454ec25e18658d7f490a8337c70a885eb9aa74e37d283ba0d55d816dd9ecd4`
- Git blob SHA-1: `c7eb4f39fc859f80ec444938da8c2e9fb62fc56a` (verified by live GitHub fetch)
- Immutable release commit: `e51e54d330a2d2e7dfbd01318866e4e6773fc262`
- 39 local offline tests pass; actual Ubuntu/GTK dialogs and phone-to-HP connection remain pending.
- This adapter supports Ubuntu Live as remote host. Windows/macOS installed-host components are not claimed working.
