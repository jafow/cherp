# cherp
check that repos have common files, and add them via PR if they are missing.

# example
```bash
$ ./cherp.js -h
🐦 cherp 🐦 - a tool for CHEcking github RePos
----------------------------------------------
Usage:

    $ ./cherp.js -h
      show this help output

    $ cherp add-file --license GPL-2.0 --repo my-repo
      adds add GPL-2.0 license file to "my-repo"
```

List repos in an org not having a license
```bash
$ ./cherp.js license
[
  { id: 202489481, name: 'my-repo', full_name: 'my-org/my-repo' },
  { id: 253125888, name: 'my-other-repo', full_name: 'my-org/my-other-repo' }
]
```

Add a GPLv2.0 license file to a repo
```bash
$ ./cherp.js add-file --repo=my-other-repo --license=GPL-2.0
```

# install
```bash
git clone https://github.com/hackforla/github-automation ~
cd ~/github-automation/check-repo
npm i
```

# configuration
Running `cherp` requires minimal configuration of `GITHUB_TOKEN` set into a `.env` file
(see [.env.example](.env.example))
or exported to the process environment, e.g. `export GITHUB_TOKEN=<your github
personal access token>`

`GITHUB_TOKEN - required`
`GITHUB_ORG - the org or owner of a repo or set of repos`

[Read more here about creating a Github Personal Access
Token](https://github.com/settings/tokens)

# API
check-repo exposes a small command line interface aliased as :bird: `cherp` :bird:.

### `cherp add-file --repo=my-repo --license=GPL-2.0`
opens a PR to my-repo with a GPL-2.0 license

### `cherp license`
check all repos in `GITHUB_ORG` that do not have a recognizable LICENSE file

# LICENSE
GPL-2.0
hackforla © 2020
