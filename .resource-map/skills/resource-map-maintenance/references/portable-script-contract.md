# Portable Script Contract

A resource-local script must be cross-platform where practical, consume the owning scripts/.env, verify RESOURCE_ID/RESOURCE_KIND/ENVIRONMENT, default to bounded read-only behavior, expose timeout/limit inputs, redact sensitive output and exit nonzero on missing identity/configuration. Do not add platform-only .cmd/.bat/.ps1 entrypoints. Any mutation mode needs an explicit confirmation flag, prior user authorization and operation logging.
