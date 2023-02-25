#!/bin/sh

# abort on any non-zero exit code
set -e

# ensure required environment variables are defined
if [ -z "$INSTANCE" ] || [ -z "$CF_ACCOUNT_ID" ] || [ -z "$CF_API_TOKEN" ] || [ -z "$CF_CUSTOM_DOMAIN" ] || [ -z "$CF_BACKEND_DO_NAMESPACE" ] || [ -z "$CF_SCRIPT_NAME" ]; then
  echo "\$INSTANCE, \$CF_ACCOUNT_ID, \$CF_API_TOKEN, \$CF_CUSTOM_DOMAIN, \$CF_BACKEND_DO_NAMESPACE, and \$CF_SCRIPT_NAME are required"
  exit 1
fi

# install deno
DENO_VERSION="v1.31.1"
DENOFLARE_VERSION="8124a2abcf2eb1951055e26ec07fbabd22afce91"
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
NO_COLOR=1 DENO_VERSION=$DENO_VERSION DENOFLARE_VERSION=${DENOFLARE_VERSION} ./deno-$DENO_VERSION/bin/deno test --allow-read

# denoflare push the worker script to cloudflare
NO_COLOR=1 DENO_VERSION=$DENO_VERSION DENOFLARE_VERSION=${DENOFLARE_VERSION} ./deno-$DENO_VERSION/bin/deno run --unstable --allow-all https://raw.githubusercontent.com/skymethod/denoflare/$DENOFLARE_VERSION/cli/cli.ts \
push ./worker/worker.ts --account-id $CF_ACCOUNT_ID --api-token $CF_API_TOKEN --custom-domain $CF_CUSTOM_DOMAIN --name $CF_SCRIPT_NAME --logpush \
--compatibility-date 2022-11-30 \
--text-binding instance:$INSTANCE \
--text-binding deployTime:$(date -u +"%Y-%m-%dT%H:%M:%SZ") \
--text-binding deployRepositoryUrl:$DEPLOY_REPOSITORY_URL \
--text-binding deploySha:$DEPLOY_SHA \
--text-binding deployFrom:$DEPLOY_FROM \
--text-binding origin:https://$CF_CUSTOM_DOMAIN \
--do-namespace-binding backendNamespace:$CF_BACKEND_DO_NAMESPACE:BackendDO \
--secret-binding adminTokens:$ADMIN_TOKENS \
--secret-binding previewTokens:$PREVIEW_TOKENS \
${REDIRECT_LOG_NOTIFICATION_DELAY_SECONDS:+--text-binding redirectLogNotificationDelaySeconds:$REDIRECT_LOG_NOTIFICATION_DELAY_SECONDS} \
${CF_AE_DATASET:+--ae-dataset-binding dataset1:$CF_AE_DATASET} \
${PRODUCTION_DOMAIN:+--text-binding productionDomain:$PRODUCTION_DOMAIN} \
${CF_ANALYTICS_TOKEN:+--text-binding cfAnalyticsToken:$CF_ANALYTICS_TOKEN} \
${TURNSTILE_SITEKEY:+--text-binding turnstileSitekey:$TURNSTILE_SITEKEY} \
${TURNSTILE_SECRET_KEY:+--secret-binding turnstileSecretKey:$TURNSTILE_SECRET_KEY} \
${PODCAST_INDEX_CREDENTIALS:+--secret-binding podcastIndexCredentials:$PODCAST_INDEX_CREDENTIALS} \
${BLOBS_BUCKET:+--r2-bucket-binding blobsBucket:$BLOBS_BUCKET} \
${RO_BLOBS_BUCKET:+--r2-bucket-binding roBlobsBucket:$RO_BLOBS_BUCKET} \
${RO_RPC_CLIENT_PARAMS:+--text-binding roRpcClientParams:$RO_RPC_CLIENT_PARAMS} \
${KV_NAMESPACE:+--kv-namespace-binding kvNamespace:$KV_NAMESPACE} \
${QUEUE1_NAME:+--queue-binding queue1:$QUEUE1_NAME} \
${DEBUG_WEBHOOK_URL:+--secret-binding debugWebhookUrl:$DEBUG_WEBHOOK_URL}
