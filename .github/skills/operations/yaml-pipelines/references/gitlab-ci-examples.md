# GitLab CI/CD Examples

> Load when implementing GitLab CI/CD pipelines. See [SKILL.md](../SKILL.md) for platform comparison.

## Basic GitLab Pipeline

```yaml
# .gitlab-ci.yml
image: node:20

stages:
 - build
 - test
 - deploy

variables:
 NODE_ENV: "production"

cache:
 paths:
 - node_modules/

before_script:
 - npm ci

build:
 stage: build
 script:
 - npm run build
 artifacts:
 paths:
 - dist/
 expire_in: 1 week

test:unit:
 stage: test
 script:
 - npm run test:unit
 coverage: '/Coverage: \d+\.\d+%/'
 artifacts:
 reports:
 coverage_report:
 coverage_format: cobertura
 path: coverage/cobertura-coverage.xml

test:integration:
 stage: test
 script:
 - npm run test:integration

deploy:staging:
 stage: deploy
 script:
 - npm run deploy:staging
 environment:
 name: staging
 url: https://staging.example.com
 only:
 - develop

deploy:production:
 stage: deploy
 script:
 - npm run deploy:production
 environment:
 name: production
 url: https://example.com
 only:
 - main
 when: manual
```

## GitLab with Docker

```yaml
# .gitlab-ci.yml
image: docker:latest

services:
 - docker:dind

variables:
 DOCKER_DRIVER: overlay2
 DOCKER_TLS_CERTDIR: "/certs"
 IMAGE_TAG: $CI_REGISTRY_IMAGE:$CI_COMMIT_SHORT_SHA

stages:
 - build
 - test
 - deploy

before_script:
 - docker login -u $CI_REGISTRY_USER -p $CI_REGISTRY_PASSWORD $CI_REGISTRY

build:
 stage: build
 script:
 - docker build -t $IMAGE_TAG .
 - docker push $IMAGE_TAG

test:
 stage: test
 script:
 - docker pull $IMAGE_TAG
 - docker run $IMAGE_TAG npm test

deploy:
 stage: deploy
 script:
 - docker pull $IMAGE_TAG
 - docker tag $IMAGE_TAG $CI_REGISTRY_IMAGE:latest
 - docker push $CI_REGISTRY_IMAGE:latest
 only:
 - main
```

## GitLab Templates and Includes

```yaml
# .gitlab-ci.yml
include:
 - local: 'templates/build.yml'
 - local: 'templates/test.yml'
 - template: Security/SAST.gitlab-ci.yml
 - project: 'my-group/my-project'
 file: '/templates/deploy.yml'

variables:
 APP_NAME: "my-app"

stages:
 - build
 - test
 - security
 - deploy
```

```yaml
# templates/build.yml
.build_template:
 stage: build
 script:
 - npm ci
 - npm run build
 artifacts:
 paths:
 - dist/

build:development:
 extends: .build_template
 variables:
 NODE_ENV: "development"

build:production:
 extends: .build_template
 variables:
 NODE_ENV: "production"
```
