module.exports = {usage, version}

const packagejson = require('../package.json')

function usage () {
  console.log('🐦 cherp 🐦 - a tool for Checking GitHub repos')
  console.log('\nUsage: ')
  console.log(`
    $ cherp -h
      show this help output

    $ cherp add-file --license=GPL-2.0 --repo=my-repo
      opens a PR to add a GPL-2.0 license file to "my-repo"
  `)
}

function version () {
  console.log(`cherp: ${packagejson.version}`)
}
