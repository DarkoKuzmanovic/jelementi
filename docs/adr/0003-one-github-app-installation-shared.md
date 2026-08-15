# One GitHub App installation shared across environments

Studio uses one GitHub App, installed once on `DarkoKuzmanovic/jelementi`, shared by all environments (dev, preview, production). Credentials live only in server-side secrets; installation tokens are short-lived and request-scoped.

The alternative — an App install per environment — doubles the credential surface (two private keys, two installations, two rotation paths) while all environments operate on the same repository, so an environment-separated install buys isolation that M3's single-repo, single-operator scope does not need. One install keeps rotation a single operator action at Checkpoint A and keeps the branch/PR topology identical across environments. If environment-isolated installs are ever needed, that is a new explicit security decision.
