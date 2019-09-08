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

const env = {
  SKIP_PREPARE_COMMIT_MSG: true,
}

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
  try {
    const result = sync(
      'yarn',
      [
        'lerna',
        'publish',
        '--registry=http://localhost:4873',
        '--yes',
        '--conventional-commits',
      ],
      { env }
    )

    console.log(result.stdout)
  } catch (e) {}
}

function deployPrerelease() {
  try {
    const result = sync(
      'yarn',
      [
        'lerna',
        'publish',
        '--registry=http://localhost:4873',
        '--canary',
        '--preid=rc',
        '--pre-dist-tag=next',
        //
        // '--yes',
        '--no-git-tag-version',
      ],
      { env }
    )

    console.log(result.stdout)
  } catch (e) {
    console.error(e)
  }
}

function createBackfillPR() {}

function createPrereleasePR() {}

deploy()
