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
    let turnstileToken = undefined;
    let fieldsUnlocked = false;
    let status = undefined;
    let pendingApiKeyFromInput = undefined;

    const [ statusSpinner, statusDiv, turnstileContainer, apiKeyInput, formFields, generateButton, createdDef, lastUsedDef, permissionsDef, statusDef, nameInput, regenerateTokenTooltip, tokenTextarea, copyTokenButton, copyTokenTooltip, deleteTokenTooltip ] = 
    [ 'status-spinner', 'status-div', 'turnstile-container', 'api-key-input', 'form-fields', 'generate-button', 'created-def', 'last-used-def', 'permissions-def', 'status-def', 'name-input', 'regenerate-token-tooltip', 'token-textarea', 'copy-token-button', 'copy-token-tooltip', 'delete-token-tooltip' ].map(v => document.getElementById(v));

    apiKeyInput.addEventListener('sl-input', () => {
        const { value } = apiKeyInput;
        if (/^[0-9a-f]{32}$/.test(value) && pendingApiKeyFromInput === undefined) {
            console.log(`Api key: ${value}`);
            pendingApiKeyFromInput = value;
            updateApp();
        }
    });

    async function getOrGenerateApiKey(apiKeyFromInput) {
        generateButton.disabled = true;
        apiKeyInput.readonly = true;
        status = { pending: true, message: apiKeyFromInput ? 'Finding API Key...' : 'Generating new API Key...' }; updateApp();
        try {
            const res = await fetch('/api/1/api-keys', { method: 'POST', headers: { authorization: `Bearer ${previewToken}` }, body: JSON.stringify({ turnstileToken, apiKey: apiKeyFromInput }) });
            console.log(res);
            if (res.status !== 200) throw new Error(`Unexpected status ${res.status}`);
            const { apiKey, status: apiKeyStatus, created, used, permissions, name, token } = await res.json();
            generateButton.style.display = 'none';

            apiKeyInput.value = apiKey;
            createdDef.textContent = computeRelativeTimeString(created);
            lastUsedDef.textContent = computeRelativeTimeString(used);
            permissionsDef.textContent = permissions.join(', ');
            statusDef.textContent = apiKeyStatus;
            nameInput.value = name;
            tokenTextarea.value = token ?? '';
            formFields.style.visibility = 'visible';
            const showToken = !apiKeyFromInput;
            tokenTextarea.style.display = showToken ? 'block' : 'none';
            copyTokenTooltip.style.display = showToken ? 'block' : 'none';

            nameInput.focus();
            nameInput.select();
            status = { message: apiKeyFromInput ? 'Found API Key' : 'Generated new API Key' }; updateApp();
        } catch (e) {
            console.error('Error in getOrGenerateApiKey', e);
            status = { message: apiKeyFromInput ? 'Failed to find API Key' : 'Failed to generate new API Key' }; updateApp();
        }
    }

    function update() {
        if (globalThis.turnstile && turnstileContainer && !turnstileContainer.rendered) {
            console.log('Rendering turnstile');
            globalThis.turnstile.render('#turnstile-container', {
                sitekey,
                action: 'api-key',
                callback: token => {
                    console.log(`Challenge Success`, token);
                    turnstileToken = token;
                    status = { message: `We think you're human` };
                    updateApp();
                },
                'error-callback': () => {
                    status = { message: `We don't think you're human` };
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
    
        if (typeof turnstileToken === 'string' && generateButton && apiKeyInput && !fieldsUnlocked) {
            console.log('Unlocking fields');
            generateButton.disabled = false;
            generateButton.style.visibility = 'visible';
            generateButton.addEventListener('click', async () => {
                await getOrGenerateApiKey();
            });
            if (navigator && navigator.clipboard) {
                copyTokenButton.style.display = 'block';
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
            }
            fieldsUnlocked = true;
        }
        if (pendingApiKeyFromInput && turnstileToken) {
            const apiKeyFromInput = pendingApiKeyFromInput;
            pendingApiKeyFromInput = undefined;
            getOrGenerateApiKey(apiKeyFromInput);
        }
    }

    return { update };
})();

globalThis.updateApp = () => app.update();

globalThis.addEventListener('DOMContentLoaded', () => {
    console.log('Document content loaded');
    updateApp();
});
