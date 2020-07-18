const { Octokit } = require('@octokit/rest')
const { throttling } = require('@octokit/plugin-throttling')
const spdxLicenseList = require('spdx-license-list/simple')
const LOGGER = require('./logger.js')
const CherpOctokit = Octokit.plugin(throttling)

/** Cherp
 * Extends the Github API client octokit/rest.js
 * with some helper methods
 *
 * @param {Object} opts -
 *    opts.userAgent: string - the user agent string included in API calls; default "cherp"
 *    opts.githubOrg: string - the github org of repos being operated on. Overrides opts.owner
 *    opts.owner: string - the github owner of the repo being operated on. Is overridden by opts.owner
 */
class Cherp extends CherpOctokit {
  constructor (opts) {
    super({
      auth: opts.GITHUB_TOKEN || process.env.GITHUB_TOKEN,
      userAgent: opts.userAgent || 'cherp',
      logger: LOGGER,
      throttle: {
        onRateLimit,
        onAbuseLimit,
      },
      ...opts
    })
    this.opts = opts
    this.owner = this.opts.githubOrg || this.opts.owner || process.env.GITHUB_ORG
  }

  async getLatestCommit (repo) {
    /**
     * getLatestCommit
    * lists commits on a repo
    * @params {String} repo - the name of the repo to list commits on
    * @returns {String} the most recent commit SHA from the repo
    */
    try {
      var { data } = await this.repos.listCommits({ owner: this.owner, repo: repo, per_page: 3 })
      const res = data.map(d => ({ sha: d.sha, tree: d.commit.tree.sha }))
      return res[0]
    } catch (err) {
      LOGGER.error('error: getLatestCommit;', err)
      LOGGER.debug(err)
    }
  }

  async listAllReposMissingLicense (org = '') {
    /**
     * listAllReposMissingLicense
     * lists all repos belonging to an org
     * @params {String} org; optional - the org to list repos for
     * @returns {Array} list of repos data
     */
    try {
      const _org = org || this.owner
      var res = await this.repos.listForOrg({ org: _org })
      var repos = res.data.map(r => ({ id: r.id, name: r.name, full_name: r.full_name }))
      return repos
    } catch (err) {
      LOGGER.error('error: listAllReposMissingLicense;', err)
    }
  }

  async _addLicense (repo, _license) {
    /**
     * _addLicense
     * private method for adding a license file to a repo
     *
     * @params {String} repo - the repo being added to
     * @params {String} _license - the SPDX license key id for the license to add
     * @returns {Object} the successful pull request data
     */
    const errMsg = `LicenseError: ${_license} is not a valid SPDX license code.
        \nSee: https://spdx.org/licenses/ for the list of accecpted ids`

    // check we are given a recongized SPDX license id
    // and throw if not.
    if (!spdxLicenseList.has(_license.toUpperCase())) {
      LOGGER.error('error: addLicense;', { name: 'licenseError', status: 400, message: errMsg })
      return
    }
    try {
      // get the license body
      const licenseBlob = await this.licenses.get({ license: _license })

      // make a blob
      const { sha } = await this._createBlob(repo, licenseBlob.data.body)

      // make a tree
      const treeResponse = await this.createTree(repo, 'LICENSE', sha)

      // commit it
      const commitResponse = await this._createCommit(repo, treeResponse.sha)

      // create a branch
      const refResponse = await this._createRef(repo, commitResponse.sha)

      // open a PR from that branch
      return await this.createPullRequest(repo, refResponse.data.ref)
    } catch (err) {
      LOGGER.error('Error adding license:', err)
    }
  }

  async _createBlob (repo, file) {
    /**
     * _createBlob
     * @param {String} repo - the repo to create a blob on
     * @param {File} file - the file object that we create a blob from
     * @returns {Object} the create blob api response
     */
    try {
      const response = await this.git.createBlob({
        owner: this.owner,
        repo,
        content: file,
        encoding: 'utf-8'
      })
      return response.data
    } catch (err) {
      LOGGER.error('error _createBlob;', err)
      LOGGER.debug(err)
      return err
    }
  }

  async createTree (repo, repoFilePath, blobSha) {
    /** create a git tree from a git blob object contents
     * see: https://git-scm.com/book/en/v2/Git-Internals-Git-Objects#_tree_objects
     *
     * @params {String} repo - the repo
     * @params {String} repoFilePath - the file path to where in the repo the tree should point to.
     * @params {String} blobSha - the SHA of the git blob we create a tree from
     * @returns {Object} the api response from git create tree
     */
    try {
      const parents = await this.getLatestCommit(repo)
      const { data } = await this.git.createTree({
        owner: this.owner,
        repo: repo,
        tree: [
          { path: repoFilePath, mode: '100644', type: 'blob', sha: blobSha }
        ],
        base_tree: parents.sha
      })
      LOGGER.debug(`Created tree with sha ${data.sha}, filename: ${repoFilePath}, blob: ${blobSha}`)
      return data
    } catch (err) {
      LOGGER.error('createTree error', err)
      LOGGER.debug(err)
      process.exit(1)
    }
  }

  async _createCommit (repo, treeSha, msg) {
    /**
     * create a commit object from the tree SHA
     * @params {String} repo - the repo to commit to
     * @params {String} the SHA of the tree created and returned by _createTree
     * @params {String} msg; optional - optional commit message; defaults to a preset generic message
     * @returns {Object} response of API call to create commit
     */
    const parents = await this.getLatestCommit(repo)
    LOGGER.debug(`createCommit from parents commit object: ${JSON.stringify(parents)}`)
    try {
      const { data } = await this.git.createCommit({
        owner: this.owner,
        repo: repo,
        message: msg || 'bot user: automated commit',
        tree: treeSha,
        parents: [parents.sha],
        author: {
          name: 'cherp',
          email: 'automation@beepboop.org'
        },
        commiter: {
          name: 'cherp',
          email: 'automation@beepboop.org'
        }
      })
      return data
    } catch (err) {
      LOGGER.error('Create Commit error: ', err)
    }
  }

  async _createRef (repo, branchSha = '') {
    /** _createRef
     * create a git ref on a repo from an optional branch SHA. Default to cutting from HEAD
     * @params {String} repo - the repo we create a branch on
     * @params {String} branchSha; optional - a specific branch SHA to cut from; defaults to latest HEAD commit on repo
     * @returns {Object} the api response
     */

    // hardcoded branch name for branches made by Cherp
    // in case we need to check or clean them later
    const cherpRef = 'heads/cherp-add-file'
    try {
      let refSha = ''
      if (branchSha === '') {
        // we should just get the latest commit on HEAD to create ref from
        const latestCommit = await this.getLatestCommit(repo)
        refSha = latestCommit.sha
      } else {
        refSha = branchSha
      }

      const res = await this.git.createRef({
        owner: this.owner,
        repo: repo,
        ref: `refs/${cherpRef}`,
        sha: refSha
      })
      LOGGER.info(`success: createRef, ref_url: ${res.data.object.url}`)
      return res
    } catch (err) {
      if (err.status === 422) {
        LOGGER.warn(`Create Ref error; status: ${err.status}, type: ${err.name}, trying again...`)
        // the ref already exists
        // delete it and try again
        await this.git.deleteRef({ owner: this.owner, repo: repo, ref: cherpRef })
        return this._createRef(repo, branchSha)
      }
      LOGGER.error('error: createRef;', err)
      LOGGER.debug(err)
    }
  }

  async createPullRequest (repo, refBranch, msg = '') {
    /**
     * creates a pull request to repo from a branch
     * @param {String} repo - the name of the github repo being targeted for PR
     * @param {String} refBranch - the name of the ref
     * @returns {Object} - the api response of the pull request
     */
    const _msg = msg || '# summary\n hello :wave:. I am opening this PR to add a file that\'s good to have in a repo. Please feel free to ignore this.\nI\'m just a script so if I am broken please open an issue in [hackforla/github-automation](https://github.com/hackforla/github-automation).'
    try {
      var { data } = await this.pulls.create({
        owner: this.owner,
        repo: repo,
        title: '🐦 Adding a file to this repo 🐦',
        head: refBranch,
        base: 'master',
        body: _msg
      })
      return data
    } catch (err) {
      LOGGER.error('error: createPullRequest, ', err)
      LOGGER.debug(err)
    }
  }

  async addFile (args) {
    /**
     * open a PR to target repo to add a file.
     * takes some known files via options or a path
     * @param args - Object
     */
    try {
      if (args.repo === undefined) {
        throw Error('No repo name provided.\nUsage:\n\tcherp add-file --repo=my-repo')
      }
      if (args.license !== undefined) {
        const res = await this._addLicense(args.repo, args.license)
        LOGGER.info(res)
      } else {
        throw Error('NotImplemented')
      }
    } catch (err) {
      console.log(err)
      return err
    }
  }

  membersMissing2fa () {
      let membersMissing2fa = this.paginate(this.orgs.listMembers, {
        org: this.owner,
        filter: '2fa_disabled'
      },
      (members) => members.data.map(member => ({login: member.login, url: member.url, html_url: member.html_url })))
      .then((members) => {
        LOGGER.debug(`Found ${members.length} without 2fa`)
        return members
      })
      .catch((err) => {
        LOGGER.error('Error: membersMissing2fa', err)
        return []
      })
      return membersMissing2fa
  }

  async _orgRepos () {
    /**
     * get the list of repos belonging to org
     */
    return this.paginate('GET /orgs/{org}/repos', {
        org: this.owner
      },
      (repos) => repos.data.map((repo) => ({
        name: repo.name,
        full_name: repo.full_name,
        issues_url: repo.issues_url,
        default_branch: repo.default_branch,
        collaborators_url: repo.collaborators_url
      })))
      .then((repos) => {
        LOGGER.debug(`Found ${repos.length} belonging to this github org`)
        return repos
      })
      .catch((err) => {
        LOGGER.error('Error: _orgRepos', err)
        return []
      })
  }

  _mapOrgReposAndCollaborators (orgRepos) {
    /**
     * close over organization repos list
     * and return function for handling resolve promise
     * of all repos collaborators
     * @param orgRepos - Array
     * @returns function
     */
    const result = {}
    return function (allReposCollaborators) {
      for (let i = 0; i < orgRepos.length; i++) {
        // zip them with org repos
        result[orgRepos[i].name] = allReposCollaborators[i].map(collaborator => collaborator.login)
      }
      return result
    }
  }

  async orgReposCollaborators () {
    /**
     * a key value pair of repos and their collaborators belonging to a github org
     * @returns Object { repoName: [list of collaborators on that repo ]}
     */
    const orgRepos = await this._orgRepos()
    const orgCollaboratorMapper = this._mapOrgReposAndCollaborators(orgRepos)
    // list of pending calls to each repo to get its list of collaborators
    const promises = orgRepos.map(repo => this.paginate('GET /repos/{owner}/{repo}/collaborators', {
        owner: this.owner,
        repo: repo.name
      }))

    return Promise.all(promises)
      .then((collaborators) => orgCollaboratorMapper(collaborators))
      .catch((err) => {
        LOGGER.error('Error: orgReposCollaborators', err)
        return []
      })
  }

  reposThatMembersBelongTo (members) {
    /**
     * given a list of members, for each member return a list of repos
     * that they are members of within the `GITHUB_ORG`
     * @param members - Array; a list of members objects as {login: String, url: String}
     * @returns Object; a key/value pair of { memberLogin: [list of repos they are members of]}
     */
    }
}

// throttling behaviors for rate limits
function onRateLimit (retryAfter, opts, octokit) {
  octokit.log.warn(`Request quota exhausted for request ${options.method} ${options.url}`)

  if (options.request.retryCount === 0) { // only retries once
    octokit.log.info(`Retrying after ${retryAfter} seconds!`)
    return true
  }
}

function onAbuseLimit (retryAfter, opts, octokit) {
  octokit.log.warn(`Abuse detected for request ${options.method} ${options.url}`)
}

module.exports = Cherp
