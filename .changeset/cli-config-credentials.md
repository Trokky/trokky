---
"@trokky/trokky": minor
---

Add CLI configuration system for improved developer experience

This release introduces a new configuration system that allows developers to store and manage Trokky instance credentials, eliminating the need to pass --url and --token flags on every command.

New features:
- `trokky config add <name>` - Add a new instance configuration with URL and token
- `trokky config remove <name>` - Remove an instance configuration
- `trokky config list` - List all configured instances
- `trokky config use <name>` - Set the default instance
- `trokky config path` - Show the config file location

Credential resolution priority:
1. CLI flags (--url, --token) - highest priority
2. Environment variables (TROKKY_URL, TROKKY_TOKEN)
3. Configured default instance from ~/.trokky/config.yaml

Updated commands:
- `backup`, `restore`, `clean` - Now support --instance flag and automatic credential resolution
- `migrate` - Now supports --from-instance and --to-instance flags

Configuration is stored in ~/.trokky/config.yaml in a human-readable YAML format.
