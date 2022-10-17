
function clearNode(n) {
    while (n.firstChild) n.removeChild(n.firstChild);
}

const app = (() => {

    let status;
    let searchTimeout = 0;
    let searchResults = [];
    let searchResultsPageIndex = 0;
    let searchResultsPages = 0;
    let feed = undefined;
    let feedAnalysis = undefined;

    async function makeApiCall(opts) {
        const { beforeMessage, pathname, body, callback, afterMessage, errorMessage, errorCallback } = opts;
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
            updateApp();
        }
    }

    const [ searchInput, statusSpinner, statusMessage, searchResultsContainer, searchResultTemplate, searchResultsPageButtonGroup, searchResultsPageButtonTemplate, feedPanel ] = 
        [ 'search-input', 'status-spinner', 'status-message', 'search-results-container', 'search-result-template', 'search-results-page-button-group', 'search-results-page-button-template', 'feed-panel' ].map(v => document.getElementById(v));

    const reset = () => {
        searchResults = [];
        searchResultsPageIndex = 0;
        searchResultsPages = 0;
        status = undefined;
        feed = undefined;
        feedAnalysis = undefined;
        searchInput.focus();
        updateApp();
    };
    const onSearchInput = () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(async () => {
            const q = searchInput.value.trim();
            if (q === '') {
                reset();
                return;
            }
            console.log('search: ' + q);
            await makeApiCall({ 
                beforeMessage: 'searching...',
                pathname: '/api/1/feeds/search',
                body: { q, sessionToken },
                callback: obj => {
                    console.log(obj);
                    searchResults = obj.feeds.map(v => ({ img: v.artwork, label: `${v.title === '' ? '(untitled)' : v.title}${v.author === '' ? '' : ` · ${v.author}`}`, feed: v }));
                    searchResultsPageIndex = 0;
                    searchResultsPages = 0;
                    feed = undefined;
                    feedAnalysis = undefined;
                },
                afterMessage: 'Search completed',
                errorMessage: 'Search failed',
                errorCallback: () => {
                    reset();
                }
            });
        }, searchInput.value.trim() === '' ? 0 : 500);
    };
    document.body.addEventListener('keyup', e => {
        if (e.keyCode === 27) { // escape
            searchInput.value = '';
            onSearchInput();
        }
    });
    searchInput.addEventListener('sl-input', onSearchInput)
   
    async function analyzeFeed(feed) {
        await makeApiCall({ 
            beforeMessage: 'analyzing feed...',
            pathname: '/api/1/feeds/analyze',
            body: { feed: feed.url, sessionToken },
            callback: obj => {
                console.log(obj);
                feedAnalysis = obj;
                updateApp();
            },
            afterMessage: 'Feed analysis completed',
            errorMessage: 'Feed analysis failed'
        });
    }

    function computePanelContent() {
        if (!feed) return '';
        let rt = [ 'url', 'author', 'ownerName' ].map(v => `${v}: ${feed[v]}`).join('\n');
        if (feedAnalysis) {
            rt += `\n\n${[ 'status', 'items' ].map(v => `${v}: ${feedAnalysis[v]}`).join('\n')}`;
        }
        return rt;
    }

    function update() {
        if (searchResultsContainer.searchResults !== searchResults || searchResultsContainer.searchResultsPageIndex !== searchResultsPageIndex || searchResultsContainer.searchResultsPages !== searchResultsPages) {
            clearNode(searchResultsContainer);
            const pageSize = 5;
            searchResultsPages = Math.max(1, Math.min(10, Math.ceil(searchResults.length / pageSize)));
            for (const searchResult of searchResults.slice(searchResultsPageIndex * pageSize, (searchResultsPageIndex + 1) * pageSize)) {
                const clone = searchResultTemplate.content.cloneNode(true);
                clone.querySelector('img').src = searchResult.img;
                clone.querySelector('span').textContent = searchResult.label;
                const button = clone.querySelector('sl-button');
                button.addEventListener('click', () => {
                    console.log(`click`, searchResult);
                    feed = searchResult.feed;
                    feedAnalysis = undefined;
                    updateApp();
                    analyzeFeed(feed);
                });
                searchResultsContainer.appendChild(clone);
            }
            if (searchResultsPages > 1) {
                while (searchResultsContainer.querySelectorAll('sl-button').length < pageSize) {
                    const clone = searchResultTemplate.content.cloneNode(true);
                    const button = clone.querySelector('sl-button');
                    button.style.visibility = 'hidden';
                    searchResultsContainer.appendChild(clone);
                }
            }
            if (searchResultsContainer.searchResults !== searchResults || searchResultsContainer.searchResultsPages !== searchResultsPages) {
                clearNode(searchResultsPageButtonGroup);
                for (let i = 0; i < searchResultsPages; i++) {
                    const clone = searchResultsPageButtonTemplate.content.cloneNode(true);
                    const button = clone.querySelector('sl-button');
                    const id = `srpb-${i}`;
                    button.id = id;
                    button.textContent = (i + 1).toString();
                    button.addEventListener('click', () => {
                        searchResultsPageIndex = i;
                        updateApp();
                    });
                    searchResultsPageButtonGroup.appendChild(clone);
                }
            }
            if (feed === undefined && searchResults.length === 1) {
                feed = searchResults[0].feed;
                feedAnalysis = undefined;
                analyzeFeed(feed);
            }
            searchResultsContainer.searchResults = searchResults;
            searchResultsContainer.searchResultsPageIndex = searchResultsPageIndex;
            searchResultsContainer.searchResultsPages = searchResultsPages;
        }

        if (feedPanel.feed !== feed || feedPanel.feedAnalysis !== feedAnalysis) {
            feedPanel.textContent = computePanelContent();
            feedPanel.feed = feed;
            feedPanel.feedAnalysis = feedAnalysis;
        }
        statusSpinner.style.visibility = status && status.pending ? 'visible' : 'hidden';
        statusMessage.textContent = status && status.message ? status.message : '';
        searchResultsContainer.style.display = searchResults.length > 0 ? 'block' : 'none';
        searchResultsPageButtonGroup.style.display = searchResultsPages > 1 ? 'block' : 'none';
        feedPanel.style.display = feed ? 'block' : 'none';
    }

    return { update };
})();

globalThis.updateApp = () => app.update();

globalThis.addEventListener('DOMContentLoaded', () => {
    console.log('Document content loaded');
    updateApp();
});
