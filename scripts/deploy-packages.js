const { sync } = require('execa')
const Github = require('@octokit/rest')
const conventionalRecommendedBump = require('conventional-recommended-bump')
const semver = require('semver')

const releaseBranch = 'master'

const prereleaseBranch = 'develop'

const owner = 'farism'

const repo = 'semantic-lerna'

const { GH_TOKEN } = process.env

const gh = new Github({
  auth: GH_TOKEN,
})

const syncArgs = {
  env: {
    SKIP_PREPARE_COMMIT_MSG: true,
  },
  stdio: 'inherit',
}

function getCurrentBranch() {
  return sync('git', ['rev-parse', '--abbrev-ref', 'HEAD']).stdout
}

function getPrereleaseBump() {
  return new Promise(function(resolve, reject) {
    conventionalRecommendedBump(
      {
        preset: `angular`,
      },
      function(error, recommendation) {
        if (error) {
          return reject(error)
        }

        resolve(recommendation.releaseType)
      }
    )
  })
}

async function publish() {
  const branch = getCurrentBranch()

  if (branch === releaseBranch) {
    publishRelease()

    await createBackfillPR()
  } else if (branch === prereleaseBranch) {
    const prereleaseBump = await getPrereleaseBump()

    publishPrerelease(prereleaseBump)

    await createPrereleasePR(prereleaseBump)
  }
}

function publishRelease() {
  sync(
    'yarn',
    [
      'lerna',
      'publish',
      '--conventional-commits',
      '--create-release=github',
      // '--yes',
      '--registry=http://localhost:4873',
    ],
    syncArgs
  )
}

function publishPrerelease(bump) {
  sync(
    'yarn',
    [
      'lerna',
      'publish',
      bump,
      '--canary',
      '--include-merged-tags',
      '--no-git-tag-version',
      '--preid=rc',
      '--pre-dist-tag=next',
      // '--yes',
      '--registry=http://localhost:4873',
    ],
    syncArgs
  )
}

async function createBackfillPR() {
  const title = `chore: [ci-skip] backfill ${releaseBranch} -> ${prereleaseBranch}`

  try {
    const pr = await gh.pulls.create({
      owner,
      repo,
      head: releaseBranch,
      base: prereleaseBranch,
      title,
      body: title,
    })

    mergeBackfillPR(pr.data.number)
  } catch (e) {
    console.error('backfill PR create failed', e)
  }
}

function mergeBackfillPR(pull_number) {
  try {
    gh.pulls.merge({
      owner,
      repo,
      pull_number,
      commit_title: title,
      commit_message: `backfill version from ${releaseBranch}`,
    })

    console.log('backfill PR merged')
  } catch (e) {
    console.log('backfill PR merge failed', e)
  }
}

async function createPrereleasePR(bump) {
  const { version } = require('../lerna.json')

  const nextVersion = semver.inc(version, bump)

  const title = `chore: prerelease ${nextVersion}`

  try {
    await gh.pulls.create({
      owner,
      repo,
      head: prereleaseBranch,
      base: 'master',
      title,
      body: title,
    })

    console.log('prerelease PR created')
  } catch (e) {
    console.error('prerelease PR failed', e)
  }
}

publish()
