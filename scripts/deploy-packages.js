const { sync } = require('execa')
const Github = require('@octokit/rest')
const conventionalRecommendedBump = require('conventional-recommended-bump')
const semver = require('semver')

console.log('hellow')

const { GITHUB_TOKEN } = process.env

console.log('world')

if (!GITHUB_TOKEN) {
  throw new Error('Missing `GITHUB_TOKEN` env variable')
}

const releaseBranch = 'master'

const prereleaseBranch = 'develop'

const owner = 'farism'

const repo = 'semantic-lerna'

const gh = new Github({
  auth: GITHUB_TOKEN,
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

function getUnreleasedChangelog() {
  return sync('yarn', ['--silent', 'conventional-changelog', '-u']).stdout
}

function formatErrors(e) {
  return JSON.stringify(e.errors, null, 2)
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
      '--yes',
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
      '--yes',
      '--registry=http://localhost:4873',
    ],
    syncArgs
  )
}

async function createBackfillPR() {
  console.log('creating backfill PR...')

  const title = `chore: backfill ${releaseBranch} -> ${prereleaseBranch}`

  try {
    const pr = await gh.pulls.create({
      owner,
      repo,
      head: releaseBranch,
      base: prereleaseBranch,
      title,
      body: title,
    })

    console.log('backfill PR created')

    mergeBackfillPR(pr.data.number, title)
  } catch (e) {
    console.error('backfill PR create failed:\n', formatErrors(e))
  }
}

function mergeBackfillPR(pull_number, commit_title) {
  console.log('merging backfill PR...')

  try {
    gh.pulls.merge({
      owner,
      repo,
      pull_number,
      commit_title,
      merge_method: 'merge',
    })

    console.log('backfill PR merged')
  } catch (e) {
    console.error('backfill PR merge failed', formatErrors(e))
  }
}

async function fetchExistingPrereleasePR() {
  console.log('checking for existing prerelease PR...')

  try {
    const res = await gh.pulls.list({
      owner,
      repo,
      head: `${owner}:${prereleaseBranch}`,
    })

    if (res.status === 200 && res.data[0]) {
      console.log('found existing prerelease PR with id: ', res.data[0].number)

      return res.data[0]
    }
  } catch (e) {
    console.error('fetching existing prerelease pr failed', formatErrors(e))
  }

  console.log('could not find an existing prerelease PR')

  return null
}

async function createPrereleasePR(bump) {
  const { version } = require('../lerna.json')

  const nextVersion = semver.inc(version, bump)

  const title = `chore: prerelease ${nextVersion}`

  const body = getUnreleasedChangelog()

  const existingPrereleasePr = await fetchExistingPrereleasePR()

  if (existingPrereleasePr) {
    console.log('updating existing prerelease PR...')

    try {
      await gh.pulls.update({
        owner,
        repo,
        pull_number: existingPrereleasePr.number,
        title,
        body,
      })

      console.log('prerelease PR updated')
    } catch (e) {
      console.error('updating prerelease PR failed', formatErrors(e))
    }

    // return early so we don't run the create
    return
  }

  console.log('creating prerelease PR...')

  try {
    await gh.pulls.create({
      owner,
      repo,
      head: prereleaseBranch,
      base: releaseBranch,
      title,
      body,
    })

    console.log('prerelease PR created')
  } catch (e) {
    console.error('prerelease PR failed', formatErrors(e))
  }
}

publish()
