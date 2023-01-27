'use strict';

const util = require('node:util');
const { join } = require('node:path');
const fs = require('node:fs/promises');
const core = require('@actions/core');
const childProcess = require('node:child_process');
const exec = util.promisify(childProcess.exec);

//////////

const INPUT_AWS_PROFILE = 'aws-profile';
const INPUT_AWS_ACCESS_KEY = 'aws-access-key';
const INPUT_AWS_SECRET_KEY = 'aws-secret-key';
const INPUT_AWS_REGION = 'aws-region';

const INPUT_ECR_REGION = 'ecr-region';
const INPUT_ECR_REGISTRY = 'ecr-registry';

const INPUT_NPM_TOKEN = 'npm-token';

const INPUT_SSH_KEY = 'ssh-key';
const INPUT_SSH_KEY_NAME = 'ssh-key-name';

//////////

async function configureAwsCredentials () {
  const directory = join(process.env.HOME, '.aws');
  const credentialsFile = join(directory, 'credentials');

  await fs.mkdir(directory, { recursive: true });

  const credentials = `[${ core.getInput(INPUT_AWS_PROFILE) }]\n` +
        `aws_access_key_id = ${ core.getInput(INPUT_AWS_ACCESS_KEY) }\n` +
        `aws_secret_access_key = ${ core.getInput(INPUT_AWS_SECRET_KEY) }\n` +
        `region = ${ core.getInput(INPUT_AWS_REGION) }\n`;

  await fs.writeFile(credentialsFile, credentials);
  await fs.chmod(credentialsFile, 0o600);
}

async function loginToECR () {
  const region = core.getInput(INPUT_ECR_REGION) || core.getInput(INPUT_AWS_REGION);
  const registry = core.getInput(INPUT_ECR_REGISTRY).startsWith('http') ? core.getInput(INPUT_ECR_REGISTRY) :
    `https://${ core.getInput(INPUT_ECR_REGISTRY) }.dkr.ecr.${ region }.amazonaws.com`;

  await exec(`aws ecr get-login-password --region ${ region } |` +
             `docker login -u AWS ${ registry } --password-stdin`, { shell: '/bin/bash' });
}

async function configureNpmToken () {
  const file = join(process.env.HOME, '.npmrc');
  await fs.writeFile(file, `/registry.npmjs.org/:_authToken=${ core.getInput(INPUT_NPM_TOKEN) }\n`);
  await fs.chmod(file, 0o600);
}

async function configureSshKey () {
  const directory = join(process.env.HOME, '.ssh');
  await fs.mkdir(directory, { recursive: true });

  const file = join(directory, core.getInput(INPUT_SSH_KEY_NAME));
  await fs.writeFile(file, core.getInput(INPUT_SSH_KEY));
  await fs.chmod(file, 0o600);
}

//////////

async function main () {
  try {
    if (core.getInput(INPUT_AWS_ACCESS_KEY) && core.getInput(INPUT_AWS_SECRET_KEY)) {
      await configureAwsCredentials();
    }

    if (core.getInput(INPUT_ECR_REGISTRY)) {
      await loginToECR();
    }

    if (core.getInput(INPUT_NPM_TOKEN)) {
      await configureNpmToken();
    }

    if (core.getInput(INPUT_SSH_KEY)) {
      await configureSshKey();
    }
  } catch (error) {
    core.setFailed(error.message);
  }
}

main();
