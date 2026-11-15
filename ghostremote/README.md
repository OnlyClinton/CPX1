# GHOSTremote ONE — v0.9.0 OWNER BETA (NOT LIVE)

**IMPORTANT: v0.8.0 was withdrawn** after a cleanup and installation-order audit. Do not use the old setup line. The updated source is staged on this separate branch, with no passwords or tokens embedded. Hardware and phone-to-HP acceptance still pending.

## One-line HP Ubuntu Live enrollment

Open Terminal on the existing BOOTFORGE Ubuntu Live session and paste the complete command below. It requires Python 3 (already available in Ubuntu Live), but no installed `curl`, no ZIP transfer, and no usable internal SSD. It retrieves the installer from an immutable Git commit and verifies the decompressed SHA-256 before execution.

```bash
python3 -c 'import urllib.request,base64,gzip,hashlib,pathlib,os;u="https://raw.githubusercontent.com/OnlyClinton/CPX1/aa5143ce942eb956b44248ad63a2f5ea57c825ed/ghostremote/ghostremote-one-v0.9.0.sh.gz.b64";d=gzip.decompress(base64.b64decode(urllib.request.urlopen(u,timeout=30).read()));assert hashlib.sha256(d).hexdigest()=="68125d8af3bca7b9ddb91135758bfb480ee8c2e42e073946c1ddf309099bbb7a","GHOSTremote checksum mismatch";p=pathlib.Path.home()/".local/bin/ghostremote";p.parent.mkdir(parents=True,exist_ok=True);q=p.with_suffix(".new");q.write_bytes(d);q.chmod(0o700);os.replace(q,p);os.execv("/bin/bash",["bash",str(p),"connect"])'
```

The installer **must be run locally and interactively on your own HP**; its checks block non-Live systems, unexpected existing services or accounts, and declared persistence. It will request the owner email prefix (as a Linux username), explicit confirmation that Ventoy persistence is disabled, a separate 16+ character remote password, a yes/no choice for granting administrator rights (default **NO**), and your **existing HP tunnel token** via a hidden terminal prompt. Never paste any credential into ChatGPT or GitHub.

Once it succeeds, use `ghostremote status`, `ghostremote doctor`, and `ghostremote disconnect`. For recovery of interrupted installation, use `~/.local/bin/ghostremote recover` locally. Browser portal: **https://ssh.hp.remote.cpx.agency**.

## Scope and limitations

- Ubuntu Live adapter only. Browser clients on Windows, macOS, Android, iOS and Linux are supported architecturally through Cloudflare browser SSH, but host adapters for installed Windows/macOS/Linux and GUI desktop control are **not ready**.
- The existing BOOTFORGE USB partitions, Ventoy config, bootloader, internal SSD and BIOS are not intentionally written or changed. A Live OS with hidden persistence might write to external storage; the operator must verify no persistence is enabled.
- The installer temporarily installs signed Ubuntu and Cloudflare APT packages in the Live overlay; the default SSH daemon is runtime-masked to avoid a LAN listener. The mask persists until reboot. Packages may remain in the Live overlay until reboot.
- SSH listens only at `127.0.0.1:22222`, disables root login and forwarding, and only permits the separate owner-matched account. Cloudflare token is stored in root-only `/run` tmpfs, passed to the service via systemd credentials, not in process args.
- **No unattended access after reboot.** Cloudflare sign-in and MFA, actual host service install, phone-to-HP browser SSH, and teardown on the physical HP remain unverified.

Installer SHA-256: `68125d8af3bca7b9ddb91135758bfb480ee8c2e42e073946c1ddf309099bbb7a`. Distribution content is matched to the published GitHub blob. This protects against accidental download changes but is not a code-signature or independent audit.
