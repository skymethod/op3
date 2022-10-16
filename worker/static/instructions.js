
const app = (() => {

    let fetching = false;
    let status;
    let searchTimeout = 0;
    let searchResults = [];

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
            fetching = false;
            updateApp();
        }
    }

    const [ searchInput, statusSpinner, statusMessage, searchResultsContainer, searchResultTemplate ] = 
        [ 'search-input', 'status-spinner', 'status-message', 'search-results-container', 'search-result-template' ].map(v => document.getElementById(v));

    searchInput.addEventListener('keyup', e => {
        if (e.keyCode === 27) { // escape
            searchInput.value = '';
        }
    });

    searchInput.addEventListener('sl-input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(async () => {
            const q = searchInput.value.trim();
            if (q === '') return;
            console.log('search: ' + q);
            await makeApiCall({ 
                beforeMessage: 'searching...',
                pathname: '/api/1/feeds/search',
                body: { q, sessionToken },
                callback: obj => {
                    console.log(obj);
                    searchResults = [];
                },
                afterMessage: 'Search completed',
                errorMessage: 'Search failed',
            });
        }, 500);
    })
   
    function update() {
        statusSpinner.style.visibility = status && status.pending ? 'visible' : 'hidden';
        statusMessage.textContent = status && status.message ? status.message : '';
        if (searchResultsContainer.searchResults !== searchResults) {
            while (searchResultsContainer.firstChild) searchResultsContainer.removeChild(searchResultsContainer.firstChild);
            for (const searchResult of searchResults) {
                const clone = searchResultTemplate.content.cloneNode(true);
                clone.querySelector('img').src = searchResult.img;
                clone.querySelector('span').textContent = searchResult.label;
                searchResultsContainer.appendChild(clone);
            }
            searchResultsContainer.searchResults === searchResults;
        }
    }

    return { update };
})();

globalThis.updateApp = () => app.update();

globalThis.addEventListener('DOMContentLoaded', () => {
    console.log('Document content loaded');
    updateApp();
});
