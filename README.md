# onshape/configure-build-credentials

This action configures any combination of common credentials for Onshape build environments.

## Inputs

### AWS Credentials

#### `aws-profile`

The AWS profile name to use, Default: `"default"`

#### `aws-access-key-id`

The AWS Access Key ID

#### `aws-secret-access-key`

The AWS Secret Access Key

#### `aws-region`

The default AWS region, Default: `"us-west-2"`

**Required** To configure AWS credentials you must specify at least `aws-access-key` and `aws-secret-key`

### AWS ECR Login

#### `ecr-profile`

The AWS profile name to use for ECR logins, falls back on `aws-profile` if not specified

#### `ecr-registry`

The ID of the AWS ECR registry

#### `ecr-region`

The AWS ECR registry's region, Default: `"us-east-2"`

**Required** To login to ECR you must specify `ecr-registry`

### NPM Token

#### `npm-token`

The NPM Token

**Required** To create the ~/.npmrc you must specify `npm-token`

### SSH Key

#### `ssh-key`

The SSH Private key contents

#### `ssh-key-name`

The SSH key name, Default: `"id_rsa"`

**Required** To create an ssh key you must specify `ssh-key`

#### `ssh-known-hosts`

The SSH known_hosts file contents


## Example usage
```yaml
uses: onshape/configure-build-credentials@v1
with:
    aws-profile: ${{ env.AWS_PROFILE }}
    aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
    aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
    aws-region: ${{ env.AWS_DEFAULT_REGION }}
    ecr-registry: ${{ env.ECR_REGISTRY }}
    ecr-region: ${{ env.ECR_REGION }}
    npm-token: ${{ secrets.NPM_TOKEN }}
    ssh-key: ${{ secret.SSH_KEY }}
```
