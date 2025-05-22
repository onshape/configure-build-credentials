'use strict';

const util = require('node:util');
const { join } = require('node:path');
const fs = require('node:fs/promises');
const core = require('@actions/core');
const childProcess = require('node:child_process');
const exec = util.promisify(childProcess.exec);

const AWS_DEFAULT_PROFILE = 'default';
const DEFAULT_FILE_MODE = 0o600;

//////////

const INPUT_AWS_PROFILE = core.getInput('aws-profile');
const INPUT_AWS_ACCESS_KEY = core.getInput('aws-access-key-id');
const INPUT_AWS_SECRET_KEY = core.getInput('aws-secret-access-key');
const INPUT_AWS_REGION = core.getInput('aws-region');

const INPUT_ECR_PROFILE = core.getInput('ecr-profile');
const INPUT_ECR_REGION = core.getInput('ecr-region');
const INPUT_ECR_REGISTRY = core.getInput('ecr-registry');

const INPUT_NPM_TOKEN = core.getInput('npm-token');

const INPUT_SSH_KEY = core.getInput('ssh-key');
const INPUT_SSH_KEY_NAME = core.getInput('ssh-key-name');

const INPUT_SSH_KNOWN_HOSTS = core.getInput('ssh-known-hosts');

const INPUT_SIGNED_COMMITS_EMAIL = core.getInput('signed-commits-email');

//////////

async function configureAwsCredentials () {
  const directory = join(process.env.HOME, '.aws');
  await fs.mkdir(directory, { recursive: true });

  // ~/.aws/config
  const profileName = INPUT_AWS_PROFILE === AWS_DEFAULT_PROFILE ? INPUT_AWS_PROFILE :
    `profile ${ INPUT_AWS_PROFILE }`;

  const configFile = join(directory, 'config');
  const config = `[${ profileName }]\n` +
        `region = ${ INPUT_AWS_REGION }\noutput = json\n`;

  await fs.writeFile(configFile, config);
  await fs.chmod(configFile, DEFAULT_FILE_MODE);

  // ~/.aws/credentials
  const credentialsFile = join(directory, 'credentials');

  const credentials = `[${ INPUT_AWS_PROFILE }]\n` +
        `aws_access_key_id = ${ INPUT_AWS_ACCESS_KEY }\n` +
        `aws_secret_access_key = ${ INPUT_AWS_SECRET_KEY }\n`;

  await fs.writeFile(credentialsFile, credentials);
  await fs.chmod(credentialsFile, DEFAULT_FILE_MODE);

  core.exportVariable('AWS_ACCESS_KEY_ID', INPUT_AWS_ACCESS_KEY);
  core.exportVariable('AWS_SECRET_ACCESS_KEY', INPUT_AWS_SECRET_KEY);
  core.exportVariable('AWS_DEFAULT_REGION', INPUT_AWS_REGION);

  console.log(`Configured AWS credentials for [${ INPUT_AWS_PROFILE }]`);
}

async function loginToECR () {
  let profile = INPUT_ECR_PROFILE || INPUT_AWS_PROFILE;
  if (profile && profile !== AWS_DEFAULT_PROFILE) {
    profile = `--profile ${ profile }`;
  } else {
    profile = '';
  }

  let region = INPUT_ECR_REGION || INPUT_AWS_REGION;
  if (INPUT_ECR_REGISTRY.includes('.amazonaws.com')) {
    region = INPUT_ECR_REGISTRY.replace(/^.*\.dkr\.ecr\.(.*?)\.amazonaws\.com$/, '$1');
  }

  const registry = INPUT_ECR_REGISTRY.includes('.amazonaws.com') ? INPUT_ECR_REGISTRY :
    `${ INPUT_ECR_REGISTRY }.dkr.ecr.${ region }.amazonaws.com`;

  await exec(`aws ecr get-login-password ${ profile } --region ${ region } | ` +
             `docker login --username AWS --password-stdin ${ registry }`, { shell: '/bin/bash' });

  console.log(`Successfully logged into ECR registry ${ registry } [${ profile }]`);
}

async function configureNpmToken () {
  const file = join(process.env.HOME, '.npmrc');
  await fs.writeFile(file, `//registry.npmjs.org/:_authToken=${ INPUT_NPM_TOKEN }\n`);
  await fs.chmod(file, DEFAULT_FILE_MODE);

  console.log(`Configured npm token in ${ file }`);
}

async function configureSshKey () {
  const directory = join(process.env.HOME, '.ssh');
  await fs.mkdir(directory, { recursive: true });

  const file = join(directory, INPUT_SSH_KEY_NAME);
  await fs.writeFile(file, INPUT_SSH_KEY);
  await fs.chmod(file, DEFAULT_FILE_MODE);

  console.log(`Configured SSH key "${ INPUT_SSH_KEY_NAME }"`);
}

async function configureSshKnownHosts () {
  const directory = join(process.env.HOME, '.ssh');
  await fs.mkdir(directory, { recursive: true });

  const file = join(directory, 'known_hosts');
  await fs.writeFile(file, INPUT_SSH_KNOWN_HOSTS);
  await fs.chmod(file, DEFAULT_FILE_MODE);

  console.log(`Configured SSH key "${ INPUT_SSH_KEY_NAME }"`);
}

async function configureSignedCommitsEmail () {
  const sshDir = join(process.env.HOME, '.ssh');
  const privateKeyPath = join(sshDir, INPUT_SSH_KEY_NAME);

  // Generate public key from private key
  const pubKeyPath = `${ privateKeyPath }.pub`;
  await exec(`ssh-keygen -y -f ${ privateKeyPath } > ${ pubKeyPath }`);
  const pubKeyContent = (await fs.readFile(pubKeyPath, 'utf8')).trim();

  // Configure Git to use SSH for signing
  await exec('git config --global gpg.format ssh');
  await exec(`git config --global user.signingkey ${ pubKeyPath }`);

  // Setup allowed_signers file
  const allowedSignersPath = join(sshDir, 'allowed_signers');
  const allowedSignerEntry = `${ INPUT_SIGNED_COMMITS_EMAIL } namespaces="git" ${ pubKeyContent }\n`;
  await fs.writeFile(allowedSignersPath, allowedSignerEntry);

  // Configure Git to use allowed_signers file
  await exec(`git config --global gpg.ssh.allowedSignersFile ${ allowedSignersPath }`);
  await exec('git config --global commit.gpgsign true');
  await exec('git config --global tag.gpgSign true');

  console.log(`Configured Signed Commits for "${ INPUT_SIGNED_COMMITS_EMAIL }"`);
}

//////////

async function main () {
  try {
    if (INPUT_AWS_ACCESS_KEY && INPUT_AWS_SECRET_KEY) {
      await configureAwsCredentials();
    }

    if (INPUT_ECR_REGISTRY) {
      await loginToECR();
    }

    if (INPUT_NPM_TOKEN) {
      await configureNpmToken();
    }

    if (INPUT_SSH_KEY) {
      await configureSshKey();
    }

    if (INPUT_SSH_KNOWN_HOSTS) {
      await configureSshKnownHosts();
    }

    if (INPUT_SIGNED_COMMITS_EMAIL) {
      if (INPUT_SSH_KEY && INPUT_SSH_KEY_NAME) {
        await configureSignedCommitsEmail();
      } else {
        throw new Error('signed-commits-email requires: ssh-key and ssh-key-name');
      }
    }
  } catch (error) {
    core.setFailed(error.message);
  }
}

main();
