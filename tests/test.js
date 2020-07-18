const test = require('tape')
const sinon = require('sinon')
const cp = require('child_process')
const path = require('path')
const Cherp = require('../src/repo')

const CMD_PATH = path.resolve(__dirname, '..', 'cherp.js')
const CMD = `node ${CMD_PATH}`

test('it should boot', (t) => {
  t.plan(1)

  var cherp = new Cherp({ githubOrg: 'testcherp' })
  t.ok(cherp instanceof Cherp, 'isntance of cherp')
})

test('it should add a license', async function (t) {
  /*
   * test adds license
   * - stub out all the github api calls
   * - assert that can create a license
   * - assert invalid license fails
   */
  var cherp = new Cherp({ githubOrg: 'testcherp' })

  var stubGetLicense = sinon.stub(cherp.licenses, 'get')
  stubGetLicense.returns(require('./stubs/get-license.json'))

  var stubCreateBlob = sinon.stub(cherp.git, 'createBlob')
  stubCreateBlob.returns(require('./stubs/create-blob.json'))

  var stubCreateTree = sinon.stub(cherp.git, 'createTree')
  stubCreateTree.returns(require('./stubs/create-tree.json'))

  var stubCreateCommit = sinon.stub(cherp.git, 'createCommit')
  stubCreateCommit.returns(require('./stubs/create-commit.json'))

  var stubCreateRef = sinon.stub(cherp.git, 'createRef')
  stubCreateRef.returns(require('./stubs/create-ref.json'))

  var stubCreatePullRequest = sinon.stub(cherp.pulls, 'create')
  stubCreatePullRequest.returns(require('./stubs/create-pull-request.json'))

  var stubGetLatestCommits = sinon.stub(cherp.repos, 'listCommits')
  stubGetLatestCommits.returns(require('./stubs/get-latest-commits.json'))

  const test0 = await cherp._addLicense('test', 'GPL-2.0')
  t.ok(test0, 'it adds a license for valid SPDX license key')

  const test1 = await cherp._addLicense('test', 'unrecognized-license-key')
  t.notOk(test1, 'should exit with error on unrecognized license')
  t.end()
})

test('test CLI', function (t) {
  t.plan(6)
  cp.exec(`${CMD} -h`, (err, result) => {
    t.error(err, 'does not throw error')
    t.ok(/Usage:/.test(result), 'it should print usage from -h')
  })

  cp.exec(`${CMD} --help`, (err, result) => {
    t.error(err, 'does not throw error')
    t.ok(/Usage:/.test(result), 'it should print usage from --help')
  })

  cp.exec(`${CMD} add-file`, (err, result) => {
    t.error(err, 'it should not err')
    t.ok(/Error: No repo name provided/.test(result), 'it should error if no options provided')
  })
})
