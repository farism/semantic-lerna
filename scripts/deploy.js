const { sync } = require('execa')
const Github = require('@octokit/rest')

const { GITHUB_AUTH } = process.env

const ghParams = {
  owner: 'farism',
  repo: 'semantic-lerna',
}

const gh = new Github({
  auth: GITHUB_AUTH,
})

const releaseBranch = 'master'

const prereleaseBranch = 'develop'

function getCurrentBranch() {
  return sync('git', ['rev-parse', '--abbrev-ref', 'HEAD']).stdout
}

function deploy() {
  const branch = getCurrentBranch()

  if (branch === releaseBranch) {
    deployRelease()
  } else if (branch === prereleaseBranch) {
    deployPrerelease()
  }
}

function deployRelease() {
  sync('lerna', [
    'publish',
    '--registry=http://localhost:4873',
    '--yes',
    '--conventional-commits',
  ])
}

function deployPrerelease() {
  sync('lerna', [
    'publish',
    '--verbose',
    '--registry=http://localhost:4873',
    // '--yes',
    '--conventional-prerelease',
    '--canary',
  ])
}

function createBackfillPR() {}

function createPrereleasePR() {}

deploy()
