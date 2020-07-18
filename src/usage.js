module.exports = usage

function usage () {
  console.log('🐦 cherp 🐦 - a tool for CHecking github RePos')
  console.log('Usage: ')
  console.log(`
    $ cherp -h
      show this help output

    $ cherp add-file --license=GPL-2.0 --repo=my-repo
      opens a PR to add a GPL-2.0 license file to "my-repo"
  `)
}
