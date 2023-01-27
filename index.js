'use strict';

const util = require('node:util');
const { join } = require('node:path');
const fs = require('node:fs/promises');
const core = require('@actions/core');
const childProcess = require('node:child_process');
const exec = util.promisify(childProcess.exec);

//////////

const INPUT_AWS_PROFILE = 'aws-profile';
const INPUT_AWS_ACCESS_KEY = 'aws-access-key-id';
const INPUT_AWS_SECRET_KEY = 'aws-secret-access-key';
const INPUT_AWS_REGION = 'aws-region';

const INPUT_ECR_PROFILE = 'ecr-profile';
const INPUT_ECR_REGION = 'ecr-region';
const INPUT_ECR_REGISTRY = 'ecr-registry';

const INPUT_NPM_TOKEN = 'npm-token';

const INPUT_SSH_KEY = 'ssh-key';
const INPUT_SSH_KEY_NAME = 'ssh-key-name';

const DEFAULT_FILE_MODE = 0o600;

//////////

async function configureAwsCredentials () {
  const directory = join(process.env.HOME, '.aws');
  await fs.mkdir(directory, { recursive: true });

  // ~/.aws/config
  const profileName = core.getInput(INPUT_AWS_PROFILE) === 'default' ? core.getInput(INPUT_AWS_PROFILE) :
    `profile ${ core.getInput(INPUT_AWS_PROFILE) }`;

  const configFile = join(directory, 'config');
  const config = `[${ profileName }]\n` +
        `region = ${ core.getInput(INPUT_AWS_REGION) }\noutput = json\n`;

  await fs.writeFile(configFile, config);
  await fs.chmod(configFile, DEFAULT_FILE_MODE);

  // ~/.aws/credentials
  const credentialsFile = join(directory, 'credentials');

  const credentials = `[${ core.getInput(INPUT_AWS_PROFILE) }]\n` +
        `aws_access_key_id = ${ core.getInput(INPUT_AWS_ACCESS_KEY) }\n` +
        `aws_secret_access_key = ${ core.getInput(INPUT_AWS_SECRET_KEY) }\n`;

  await fs.writeFile(credentialsFile, credentials);
  await fs.chmod(credentialsFile, DEFAULT_FILE_MODE);

  console.log(`Configured AWS credentials for [${ core.getInput(INPUT_AWS_PROFILE) }]`);
}

async function loginToECR () {
  const profile = core.getInput(INPUT_ECR_PROFILE) || core.getInput(INPUT_AWS_PROFILE) || 'default';
  const region = core.getInput(INPUT_ECR_REGION) || core.getInput(INPUT_AWS_REGION);
  const registry = core.getInput(INPUT_ECR_REGISTRY).startsWith('http') ? core.getInput(INPUT_ECR_REGISTRY) :
    `https://${ core.getInput(INPUT_ECR_REGISTRY) }.dkr.ecr.${ region }.amazonaws.com`;

  await exec(`aws ecr get-login-password --profile ${ profile } --region ${ region } |` +
             `docker login -u AWS ${ registry } --password-stdin`, { shell: '/bin/bash' });

  console.log(`Successfully logged into ECR registry ${ registry.replace('https://', '') }`);
}

async function configureNpmToken () {
  const file = join(process.env.HOME, '.npmrc');
  await fs.writeFile(file, `/registry.npmjs.org/:_authToken=${ core.getInput(INPUT_NPM_TOKEN) }\n`);
  await fs.chmod(file, DEFAULT_FILE_MODE);

  console.log(`Configured npm token in ${ file }`);
}

async function configureSshKey () {
  const directory = join(process.env.HOME, '.ssh');
  await fs.mkdir(directory, { recursive: true });

  const file = join(directory, core.getInput(INPUT_SSH_KEY_NAME));
  await fs.writeFile(file, core.getInput(INPUT_SSH_KEY));
  await fs.chmod(file, DEFAULT_FILE_MODE);

  console.log(`Configured SSH key "${ core.getInput(INPUT_SSH_KEY_NAME) }"`);
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
