const rtf = new Intl.RelativeTimeFormat('en', { style: 'long' });

function computeRelativeTimeString(instant) {
    const secondsAgo = Math.round((Date.now() - new Date(instant).getTime()) / 1000);
    if (secondsAgo < 5) return 'just now';
    if (secondsAgo < 60) return rtf.format(-secondsAgo, 'seconds');
    const minutesAgo = Math.round(secondsAgo / 60);
    if (minutesAgo < 60) return rtf.format(-minutesAgo, 'minutes');
    const hoursAgo = Math.round(secondsAgo / 60 / 60);
    if (hoursAgo < 24) return rtf.format(-hoursAgo, 'hours');
    const daysAgo = Math.round(secondsAgo / 60 / 60 / 24);
    return rtf.format(-daysAgo, 'days');
}

const app = (() => {
    let turnstileWidgetId = undefined;
    let turnstileToken = undefined;
    let status = undefined;
    let existingApiKey = undefined;
    let gotOrGeneratedApiKey = false;
    let fetching = false;
    let info = undefined;
    let nameChangeTimeout = undefined;

    const [ statusSpinner, statusDiv, turnstileContainer, apiKeyInput, formFields, generateButton, createdDef, lastUsedDef, permissionsDef, statusDef, nameInput, regenerateTokenButton, tokenTextarea, copyTokenButton, copyTokenTooltip, deleteTokenButton ] = 
    [ 'status-spinner', 'status-div', 'turnstile-container', 'api-key-input', 'form-fields', 'generate-button', 'created-def', 'last-used-def', 'permissions-def', 'status-def', 'name-input', 'regenerate-token-button', 'token-textarea', 'copy-token-button', 'copy-token-tooltip', 'delete-token-button' ].map(v => document.getElementById(v));

    apiKeyInput.addEventListener('sl-input', () => {
        const { value } = apiKeyInput;
        if (/^[0-9a-f]{32}$/.test(value) && existingApiKey === undefined) {
            console.log(`Api key: ${value}`);
            existingApiKey = value;
            updateApp();
        }
    });

    generateButton.addEventListener('click', async () => {
        await getOrGenerateApiKey();
    });

    nameInput.addEventListener('sl-input', () => {
        clearTimeout(nameChangeTimeout);
        nameChangeTimeout = setTimeout(async () => {
            const name = nameInput.value;
            console.log({ name });
            if (info && name !== info.name) {
                await performModification({ apiKey: existingApiKey, name });
            }
        }, 2000);
    });
    
    copyTokenButton.addEventListener('click', async () => {
        try {
            await navigator.clipboard.writeText(tokenTextarea.value);
            copyTokenTooltip.content = 'Copied!';
            console.log('copied!');
        } catch {
            copyTokenTooltip.content = 'Failed to copy!';
            console.error('failed to copy', e);
        }
        copyTokenTooltip.show();
        setTimeout(() => copyTokenTooltip.hide(), 5000);
    });

    regenerateTokenButton.addEventListener('click', async () => {
        await performModification({ apiKey: existingApiKey, action: 'regenerate-token' });
    });

    deleteTokenButton.addEventListener('click', async () => {
        await performModification({ apiKey: existingApiKey, action: 'delete-token' });
    });

    async function makeApiCall(opts) {
        const { beforeMessage, pathname, body, callback, afterMessage, errorMessage, errorCallback } = opts;
        fetching = true;
        status = { pending: true, message: beforeMessage };
        updateApp();
        try {
            const res = await fetch(pathname, { method: 'POST', headers: { authorization: `Bearer ${previewToken}` }, body: JSON.stringify(body) });
            console.log(res);
            if (res.status !== 200) {
                console.log(await res.text());
                throw new Error(`Unexpected status ${res.status}`);
            }
            const obj = await res.json();
            console.log(JSON.stringify(obj, undefined, 2));
            callback(obj);

            status = { message: afterMessage };
        } catch (e) {
            if (errorCallback) errorCallback();
            console.error(`Error making api call: ${pathname}`, e);
            status = { message: errorMessage };
        } finally {
            globalThis.turnstile.reset(turnstileWidgetId);
            turnstileToken = undefined;

            fetching = false;
            updateApp();
        }
    }

    async function getOrGenerateApiKey() {
        console.log('getOrGenerateApiKey', existingApiKey);

        gotOrGeneratedApiKey = true;
        const existing = existingApiKey !== undefined;

        await makeApiCall({ 
            beforeMessage: existing ? 'Finding API Key...' : 'Generating new API Key...',
            pathname: '/api/1/api-keys',
            body: { turnstileToken, apiKey: existingApiKey },
            callback: obj => {
                info = obj;
                apiKeyInput.value = info.apiKey;
                existingApiKey = info.apiKey;
                nameInput.value = info.name;

                fetching = false;
                updateApp();

                nameInput.focus();
                nameInput.select();
            },
            afterMessage: existing ? 'Found API Key' : 'Generated new API Key',
            errorMessage: existing ? 'Failed to find API Key' : 'Failed to generate new API Key',
            errorCallback: () => {
                gotOrGeneratedApiKey = false;
            }
        });
    }

    async function performModification(req) {
        console.log(`performModification`, req);

        const { beforeMessage, afterMessage, errorMessage } = typeof req.name === 'string' ? { beforeMessage: 'Updating nickname...', afterMessage: 'Updated nickname', errorMessage: 'Error updating nickname' }
            : req.action === 'regenerate-token' ? { beforeMessage: 'Regenerating token...', afterMessage: 'Regenerated token', errorMessage: 'Error regenerating token' }
            : req.action === 'delete-token' ? { beforeMessage: 'Deleting token...', afterMessage: 'Deleted token', errorMessage: 'Error deleting token' }
            : { beforeMessage: 'Performing modification...', afterMessage: 'Performed modification', errorMessage: 'Failed to perform modification' };

        await makeApiCall({ 
            beforeMessage,
            pathname: `/api/1/api-keys/${req.apiKey}`,
            body: { ...req, turnstileToken },
            callback: obj => {
                info = obj;
                apiKeyInput.value = info.apiKey;
                existingApiKey = info.apiKey;
            },
            afterMessage,
            errorMessage,
            errorCallback: () => {
                nameInput.value = info.name;
            },
        });
    }

    function update() {
        {
            apiKeyInput.readonly = existingApiKey !== undefined;

            generateButton.style.display = turnstileToken && existingApiKey === undefined ? 'block' : 'none';
            generateButton.disabled = fetching || turnstileToken === undefined;

            const { status, created, permissions, token, tokenLastUsed, blockReason } = info ?? {};

            nameInput.readonly = turnstileToken === undefined;
            createdDef.textContent = created ? computeRelativeTimeString(created) : '';
            lastUsedDef.textContent = tokenLastUsed ? computeRelativeTimeString(tokenLastUsed) : 'never';
            permissionsDef.textContent = permissions ? permissions.join(', ') : '';
            statusDef.textContent = status + (status === 'inactive' ? ` (no token)` : '') + (blockReason ? ` (${blockReason})` : '');
            tokenTextarea.value = token ?? '';
            formFields.style.visibility = info ? 'visible' : 'invisible';
            tokenTextarea.style.display = token ? 'block' : 'none';
            copyTokenTooltip.style.display = navigator && navigator.clipboard && token ? 'block' : 'none';
            regenerateTokenButton.style.display = (status === 'active' || status === 'inactive') ? 'block' : 'none';
            regenerateTokenButton.disabled = fetching || turnstileToken === undefined;
            deleteTokenButton.style.display = status === 'active' ? 'block' : 'none';
            deleteTokenButton.disabled = fetching || turnstileToken === undefined;
        }

        if (globalThis.turnstile && turnstileContainer && !turnstileContainer.rendered) {
            console.log('Rendering turnstile');
            turnstileWidgetId = globalThis.turnstile.render('#turnstile-container', {
                sitekey,
                action: 'api-key',
                callback: token => {
                    console.log(`Challenge Success`, token);
                    turnstileToken = token;
                    status = { message: `Alright, you're human` };
                    updateApp();
                },
                'error-callback': () => {
                    status = { message: `Are you human?` };
                },
                'expired-callback': () => {
                    status = { message: 'Took too long, reload the page' };
                }
            });
            turnstileContainer.rendered = true;
        }
    
        if (status) {
            const { pending, message } = status;
            statusDiv.textContent = message;
            statusSpinner.style.visibility = pending ? 'visible' : 'hidden';
        }
    
        if (!gotOrGeneratedApiKey && existingApiKey && turnstileToken) {
            getOrGenerateApiKey();
        }
    }

    return { update };
})();

globalThis.updateApp = () => app.update();

globalThis.addEventListener('DOMContentLoaded', () => {
    console.log('Document content loaded');
    updateApp();
});
