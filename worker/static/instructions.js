
function clearNode(n) {
    while (n.firstChild) n.removeChild(n.firstChild);
}

const app = (() => {

    let fetching = false;
    let status;
    let searchTimeout = 0;
    let searchResults = [];
    let searchResultsPageIndex = 0;
    let searchResultsPages = 0;

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
            // console.log(JSON.stringify(obj, undefined, 2));
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

    const [ searchInput, statusSpinner, statusMessage, searchResultsContainer, searchResultTemplate, searchResultsPageButtonGroup, searchResultsPageButtonTemplate ] = 
        [ 'search-input', 'status-spinner', 'status-message', 'search-results-container', 'search-result-template', 'search-results-page-button-group', 'search-results-page-button-template' ].map(v => document.getElementById(v));

    searchInput.addEventListener('keyup', e => {
        if (e.keyCode === 27) { // escape
            searchInput.value = '';
        }
    });

    searchInput.addEventListener('sl-input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(async () => {
            const q = searchInput.value.trim();
            if (q === '') {
                searchResults = [];
                searchResultsPageIndex = 0;
                searchResultsPages = 0;
                status = undefined;
                updateApp();
                return;
            }
            console.log('search: ' + q);
            await makeApiCall({ 
                beforeMessage: 'searching...',
                pathname: '/api/1/feeds/search',
                body: { q, sessionToken },
                callback: obj => {
                    console.log(obj);
                    searchResults = obj.feeds.map(v => ({ img: v.artwork, label: `${v.title} · ${v.author}` }));
                    searchResultsPageIndex = 0;
                    searchResultsPages = 0;
                },
                afterMessage: 'Search completed',
                errorMessage: 'Search failed',
            });
        }, 500);
    })
   
    function update() {
        if (searchResultsContainer.searchResults !== searchResults || searchResultsContainer.searchResultsPageIndex !== searchResultsPageIndex || searchResultsContainer.searchResultsPages !== searchResultsPages) {
            clearNode(searchResultsContainer);
            const pageSize = 5;
            for (const searchResult of searchResults.slice(searchResultsPageIndex * pageSize, (searchResultsPageIndex + 1) * pageSize)) {
                const clone = searchResultTemplate.content.cloneNode(true);
                clone.querySelector('img').src = searchResult.img;
                clone.querySelector('span').textContent = searchResult.label;
                searchResultsContainer.appendChild(clone);
            }
            clearNode(searchResultsPageButtonGroup);
            searchResultsPages = Math.max(1, Math.min(10, Math.ceil(searchResults.length / pageSize)));
            for (let i = 0; i < searchResultsPages; i++) {
                const clone = searchResultsPageButtonTemplate.content.cloneNode(true);
                const button = clone.querySelector('sl-button');
                button.textContent = (i + 1).toString();
                button.addEventListener('click', () => {
                    searchResultsPageIndex = i;
                    updateApp();
                });
                searchResultsPageButtonGroup.appendChild(clone);
            }
            searchResultsContainer.searchResults === searchResults;
            searchResultsContainer.searchResultsPageIndex = searchResultsPageIndex;
            searchResultsContainer.searchResultsPages = searchResultsPages;
        }

        statusSpinner.style.visibility = status && status.pending ? 'visible' : 'hidden';
        statusMessage.textContent = status && status.message ? status.message : '';
        searchResultsContainer.style.display = searchResults.length > 0 ? 'block' : 'none';
        searchResultsPageButtonGroup.style.display = searchResultsPages > 1 ? 'block' : 'none';
    }

    return { update };
})();

globalThis.updateApp = () => app.update();

globalThis.addEventListener('DOMContentLoaded', () => {
    console.log('Document content loaded');
    updateApp();
});
