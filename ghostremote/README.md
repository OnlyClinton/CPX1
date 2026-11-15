# GHOSTremote ONE v0.8.0 — HP Ubuntu Live deployment

## Scope

Only the Ubuntu Live version of GHOSTremote ONE is currently prepared. It supports temporary outbound tunnel + browser SSH to the HP without internal SSD. Not verified on physical hardware, NOT a persistent installation, and not evidence that Windows or macOS host adapters work.

## Single command from Ubuntu Live Terminal

Run locally on BOOTFORGE, never remotely. It masks the standard SSH port 22 in systemd runtime to prevent unintentional LAN exposure, downloads a static gzip-base64 script from this isolated branch, verifies **SHA-256 of the decompressed script** against a fixed digest, installs a local CLI, and launches guided enrollment. It does NOT need curl or a ZIP.

```bash
sudo systemctl mask --runtime ssh.service ssh.socket && python3 -c 'import urllib.request,gzip,base64,hashlib,pathlib,os;u="https://raw.githubusercontent.com/OnlyClinton/CPX1/ghostremote-one-bootstrap-20261115/ghostremote/ghostremote-one-v0.8.0.sh.gz.b64";d=gzip.decompress(base64.b64decode(urllib.request.urlopen(u,timeout=30).read()));assert hashlib.sha256(d).hexdigest()=="2238490066c422731f960bbf555ee8e3a1d96792e59d31ab93f6145c174bf4ad","GHOSTremote installer hash mismatch";p=pathlib.Path.home()/".local/bin/ghostremote";p.parent.mkdir(parents=True,exist_ok=True);q=p.with_suffix(".new");q.write_bytes(d);q.chmod(0o700);q.replace(p);os.execv("/bin/bash",["bash",str(p),"connect"])'
```

## Next prompts

The script asks you to confirm LIVE-ONLY with no persistence; input your Cloudflare owner Access email locally (for SSH username matching), choose a different 16+ character SSH password, optionally permit sudo (default NO), and enter the existing HP tunnel token in a hidden prompt. Do not transmit credentials to ChatGPT or GitHub.

## Operation

```bash
~/.local/bin/ghostremote status
~/.local/bin/ghostremote disconnect
```

Client browser: https://ssh.hp.remote.cpx.agency. Existing owner-only Cloudflare Access and outbound tunnel staging. Browser sign-in not tested. Shutdown ends Live mode. No BOOTFORGE partition modifications. Commands only work if internet and signed apt repositories can be reached and on a truly nonpersistent Live session.

## Verification

SHA-256 of decompressed script: `2238490066c422731f960bbf555ee8e3a1d96792e59d31ab93f6145c174bf4ad`
Source is packed for portable bootstrap; a readable script is also included in the GHOSTremote ONE ZIP artifact from ChatGPT. The code has passed shell syntax and offline structural checks, not a physical install or an external browser SSH login.
