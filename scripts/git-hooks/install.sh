#!/bin/sh
# Install the local half of the branch guard for this clone.
#
#   sh scripts/git-hooks/install.sh
#
# This points Git at scripts/git-hooks instead of .git/hooks, so the hook is
# versioned with the repository. Undo with:
#
#   git config --unset core.hooksPath

set -eu

root="$(git rev-parse --show-toplevel)"
hooks="$root/scripts/git-hooks"

chmod +x "$hooks/pre-push"
git config core.hooksPath "$hooks"

printf 'Git hooks installed from %s\n' "$hooks"
printf '  - main can only receive G\n'
printf '  - interns can never receive white_label_os\n'
printf 'Undo with: git config --unset core.hooksPath\n'
