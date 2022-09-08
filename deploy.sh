#!/bin/sh
if [ -z "$INSTANCE" ] || [ -z "$CF_ACCOUNT_ID" ] || [ -z "$CF_API_TOKEN" ] || [ -z "$CF_CUSTOM_DOMAIN" ] || [ -z "$CF_SCRIPT_NAME" ]; then
  echo "\$INSTANCE, \$CF_ACCOUNT_ID, \$CF_API_TOKEN, \$CF_CUSTOM_DOMAIN, and \$CF_SCRIPT_NAME are required"
  exit 1
fi
DENO_VERSION="v1.25.1"
DENOFLARE_VERSION="v0.5.7"
curl -fsSL https://deno.land/x/install/install.sh | DENO_INSTALL=./deno-$DENO_VERSION sh -s $DENO_VERSION
NO_COLOR=1 DENO_VERSION=$DENO_VERSION DENOFLARE_VERSION=${DENOFLARE_VERSION} ./deno-$DENO_VERSION/bin/deno test
NO_COLOR=1 DENO_VERSION=$DENO_VERSION DENOFLARE_VERSION=${DENOFLARE_VERSION} ./deno-$DENO_VERSION/bin/deno run --unstable --allow-all https://raw.githubusercontent.com/skymethod/denoflare/$DENOFLARE_VERSION/cli/cli.ts \
push worker.ts --account-id $CF_ACCOUNT_ID --api-token $CF_API_TOKEN --custom-domain $CF_CUSTOM_DOMAIN --name $CF_SCRIPT_NAME \
--text-binding instance:$INSTANCE \
--text-binding deployTime:$(date -u +"%Y-%m-%dT%H:%M:%SZ") \
--text-binding deployRepositoryUrl:$DEPLOY_REPOSITORY_URL \
--text-binding deploySha:$DEPLOY_SHA \
--text-binding deployFrom:$DEPLOY_FROM
