let turnstileToken = undefined;
let fieldsUnlocked = false;

globalThis.updateApp = function() {
    const [ turnstileContainer, apiKeyInput, formFields, generateButton ] = 
    [ 'turnstile-container', 'api-key-input', 'form-fields', 'generate-button' ].map(v => document.getElementById(v));

    if (globalThis.turnstile && turnstileContainer && !turnstileContainer.rendered) {
        console.log('Rendering turnstile');
        globalThis.turnstile.render('#turnstile-container', {
            sitekey,
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
            apiKeyInput.disabled = true;
            const res = await fetch('/api/1/api-keys', { method: 'POST', headers: { authorization: `Bearer ${previewToken}` }, body: JSON.stringify({ turnstileToken }) });
            console.log(res);
        });
        apiKeyInput.addEventListener('sl-input', () => {
            const { value } = apiKeyInput;
            if (/^[0-9a-f]{32}$/.test(value) && apiKeyInput.apiKey !== value) {
                console.log(`Api key: ${value}`);
                apiKeyInput.apiKey = value;
                apiKeyInput.disabled = true;
            }
        });
        fieldsUnlocked = true;
    }
};

globalThis.addEventListener('DOMContentLoaded', () => {
    console.log('Document content loaded');
    updateApp();
});
