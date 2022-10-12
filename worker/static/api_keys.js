let turnstileToken = undefined;
let fieldsUnlocked = false;

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

globalThis.updateApp = function() {
    const [ turnstileContainer, apiKeyInput, formFields, generateButton, createdDef, lastUsedDef, permissionsDef, statusDef, nameInput, tokenTextarea, copyTokenButton, copyTokenTooltip, generatedDiv, existedDiv ] = 
    [ 'turnstile-container', 'api-key-input', 'form-fields', 'generate-button', 'created-def', 'last-used-def', 'permissions-def', 'status-def', 'name-input', 'token-textarea', 'copy-token-button', 'copy-token-tooltip', 'generated-div', 'existed-div' ].map(v => document.getElementById(v));

    async function getOrGenerateApiKey(apiKeyFromInput) {
        generateButton.disabled = true;
        apiKeyInput.readonly = true;
        const res = await fetch('/api/1/api-keys', { method: 'POST', headers: { authorization: `Bearer ${previewToken}` }, body: JSON.stringify({ turnstileToken, apiKey: apiKeyFromInput }) });
        console.log(res);
        if (res.status !== 200) throw new Error(`Unexpected status ${res.status}`);
        const { apiKey, status, created, used, permissions, name, token } = await res.json();
        apiKeyInput.value = apiKey;
        createdDef.textContent = computeRelativeTimeString(created);
        lastUsedDef.textContent = computeRelativeTimeString(used);
        permissionsDef.textContent = permissions.join(', ');
        statusDef.textContent = status;
        nameInput.value = name;
        tokenTextarea.value = token ?? '';
        formFields.style.visibility = 'visible';
        if (apiKeyFromInput) {
            generatedDiv.style.visibility = 'hidden';
            existedDiv.style.visibility = 'visible';
        } else {
            copyTokenButton.style.visibility = 'visible';
            copyTokenTooltip.style.visibility = 'visible';
        }

        nameInput.focus();
        nameInput.select();
    }

    if (globalThis.turnstile && turnstileContainer && !turnstileContainer.rendered) {
        console.log('Rendering turnstile');
        globalThis.turnstile.render('#turnstile-container', {
            sitekey,
            action: 'api-key',
            callback: function(token) {
                console.log(`Challenge Success`, token);
                turnstileToken = token;
                updateApp();
            },
        });
        turnstileContainer.rendered = true;
    }
    if (typeof turnstileToken === 'string' && generateButton && apiKeyInput && !fieldsUnlocked) {
        console.log('Unlocking fields');
        generateButton.disabled = false;
        generateButton.addEventListener('click', async () => {
            await getOrGenerateApiKey();
        });
        if (navigator && navigator.clipboard) {
            copyTokenButton.addEventListener('click', async () => {
                try {
                    await navigator.clipboard.writeText(tokenTextarea.value);
                    copyTokenTooltip.content = 'Copied';
                    console.log('copied!');
                } catch {
                    copyTokenTooltip.content = 'Failed to copy!';
                    console.error('failed to copy', e);
                }
                copyTokenTooltip.show();
                setTimeout(() => copyTokenTooltip.hide(), 5000);
            });
        }
        apiKeyInput.addEventListener('sl-input', async () => {
            const { value } = apiKeyInput;
            if (/^[0-9a-f]{32}$/.test(value) && !apiKeyInput.fired) {
                console.log(`Api key: ${value}`);
                apiKeyInput.fired = true;
                await getOrGenerateApiKey(value);
            }
        });
        fieldsUnlocked = true;
    }
};

globalThis.addEventListener('DOMContentLoaded', () => {
    console.log('Document content loaded');
    updateApp();
});
