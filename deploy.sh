#!/bin/sh

# abort on any non-zero exit code
set -e

# ensure required environment variables are defined
if [ -z "$INSTANCE" ] || [ -z "$CF_ACCOUNT_ID" ] || [ -z "$CF_API_TOKEN" ] || [ -z "$CF_CUSTOM_DOMAIN" ] || [ -z "$CF_SCRIPT_NAME" ]; then
  echo "\$INSTANCE, \$CF_ACCOUNT_ID, \$CF_API_TOKEN, \$CF_CUSTOM_DOMAIN, and \$CF_SCRIPT_NAME are required"
  exit 1
fi

# install deno
DENO_VERSION="v1.25.2"
DENOFLARE_VERSION="v0.5.7"
curl -fsSL https://deno.land/x/install/install.sh | DENO_INSTALL=./deno-$DENO_VERSION sh -s $DENO_VERSION

# exit early if already deployed
if [ -n "$DEPLOY_SHA" ]; then
  echo "DEPLOY_SHA: $DEPLOY_SHA"
  DEPLOYED_SHA=$(echo "try { console.log(JSON.parse(await (await fetch('https://$CF_CUSTOM_DOMAIN/info.json')).text()).deploySha) } catch {}" | ./deno-$DENO_VERSION/bin/deno run --allow-net -)
  if [ "$DEPLOY_SHA" = "$DEPLOYED_SHA" ]; then
    echo "already deployed on $CF_CUSTOM_DOMAIN"
    exit 0
  fi
  echo "DEPLOYED_SHA: $DEPLOYED_SHA"
fi

# run unit tests as a sanity check
NO_COLOR=1 DENO_VERSION=$DENO_VERSION DENOFLARE_VERSION=${DENOFLARE_VERSION} ./deno-$DENO_VERSION/bin/deno test

# denoflare push the worker script to cloudflare
NO_COLOR=1 DENO_VERSION=$DENO_VERSION DENOFLARE_VERSION=${DENOFLARE_VERSION} ./deno-$DENO_VERSION/bin/deno run --unstable --allow-all https://raw.githubusercontent.com/skymethod/denoflare/$DENOFLARE_VERSION/cli/cli.ts \
push worker.ts --account-id $CF_ACCOUNT_ID --api-token $CF_API_TOKEN --custom-domain $CF_CUSTOM_DOMAIN --name $CF_SCRIPT_NAME \
--text-binding instance:$INSTANCE \
--text-binding deployTime:$(date -u +"%Y-%m-%dT%H:%M:%SZ") \
--text-binding deployRepositoryUrl:$DEPLOY_REPOSITORY_URL \
--text-binding deploySha:$DEPLOY_SHA \
--text-binding deployFrom:$DEPLOY_FROM
