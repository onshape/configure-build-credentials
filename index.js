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
  } catch (error) {
    core.setFailed(error.message);
  }
}

main();
