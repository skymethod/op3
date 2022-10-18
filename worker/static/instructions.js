
function clearNode(n) {
    while (n.firstChild) n.removeChild(n.firstChild);
}

function computeFeedTitle(feed) {
    return feed.title === '' ? '(untitled)' : feed.title;
}

function computeFeedHost(url) {
    try {
        return new URL(url).hostname;
    } catch {
        return '';
    }
}

function computeRelativeTime(from) {
    const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'always' });
    const ageMillis = Date.now() - from;
    if (ageMillis < 1000 * 60 * 60 * 24) return 'less than 24 hrs ago';
    const ageDays = ageMillis / 1000 / 60 / 60 / 24;
    if (ageDays < 31) {
        return rtf.format(-Math.round(ageDays), 'day');
    }
    if (ageDays < 365) {
        return rtf.format(-Math.round(ageDays / 30), 'month');
    }
    return rtf.format(-Math.round(ageDays / 365), 'year');

}

function computeQuantityText(quantity, unit) {
    const qty = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'][Math.max(0, quantity)] ?? quantity.toString();
    return `${qty} ${unit}${quantity === 1 ? '' : 's'}`;
}

function computeFeedSummary(analysis) {
    // n episodes, latest 3 minutes ago
    const { itemsWithEnclosures, maxPubdate } = analysis;
    let rt = computeQuantityText(itemsWithEnclosures, 'episode');
    rt = rt.substring(0, 1).toUpperCase() + rt.substring(1);
    if (typeof maxPubdate === 'string') {
        const suffix = computeRelativeTime(new Date(maxPubdate).getTime());
        rt += `, ${itemsWithEnclosures > 1 ? 'latest ' : ''}${suffix}`;
    }
    return rt;
}

const app = (() => {

    let status = { message: `Find your podcast, we'll check your setup`};
    let searchTimeout = 0;
    let searchResults = [];
    let searchResultsPageIndex = 0;
    let searchResultsPages = 0;
    let feed = undefined;
    let feedAnalysis = undefined;
    let feedAnalysisError = undefined;

    async function makeApiCall(opts) {
        const { beforeMessage, pathname, body, callback, afterMessage, errorMessage, errorCallback } = opts;
        status = { pending: true, message: beforeMessage };
        updateApp();
        let obj;
        try {
            const res = await fetch(pathname, { method: 'POST', headers: { authorization: `Bearer ${previewToken}` }, body: JSON.stringify(body) });
            console.log(res);
            if (res.status !== 200) {
                if ((res.headers.get('content-type') ?? '').includes('json')) {
                    obj = await res.json();
                    console.log(obj);
                } else {
                    console.log(await res.text());
                }
                throw new Error(`Unexpected status ${res.status}`);
            }
            obj = await res.json();
            // console.log(JSON.stringify(obj, undefined, 2));
            callback(obj);

            status = { message: typeof afterMessage === 'string' ? afterMessage : afterMessage(obj) };
        } catch (e) {
            if (errorCallback) errorCallback(obj);
            console.error(`Error making api call: ${pathname}`, e);
            status = { message: errorMessage };
        } finally {
            updateApp();
        }
    }

    const [ exampleGuidSpan, searchInput, statusSpinner, statusMessage, searchResultsContainer, searchResultTemplate, searchResultsPageButtonGroup, searchResultsPageButtonTemplate ] = 
        [ 'example-guid', 'search-input', 'status-spinner', 'status-message', 'search-results-container', 'search-result-template', 'search-results-page-button-group', 'search-results-page-button-template' ].map(v => document.getElementById(v));

    const [ feedPanel, fpImg, fpImgPlaceholder, fpTitleDiv, fpAuthorDiv, fpFeedAnchor, fpFeedHostSpan, fpSummaryDiv, fpFoundNoneDiv, fpFoundAllDiv, fpFoundSomeDiv, fpFoundEpisodesSpan, fpSuggestionsList, fpPodcastGuidSpan ] = 
        [ 'feed-panel', 'fp-img', 'fp-img-placeholder', 'fp-title-div', 'fp-author-div', 'fp-feed-anchor', 'fp-feed-host-span', 'fp-summary-div', 'fp-found-none-div', 'fp-found-all-div', 'fp-found-some-div', 'fp-found-episodes-span', 'fp-suggestions-list', 'fp-podcast-guid' ].map(v => document.getElementById(v));

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
                beforeMessage: 'Finding podcasts...',
                pathname: '/api/1/feeds/search',
                body: { q, sessionToken },
                callback: obj => {
                    console.log(obj);
                    searchResults = obj.feeds.map(v => ({ img: v.artwork, label: `${computeFeedTitle(v)}${v.author === '' ? '' : ` · ${v.author}`}`, feed: v }));
                    searchResultsPageIndex = 0;
                    searchResultsPages = 0;
                    feed = undefined;
                    feedAnalysis = undefined;
                    feedAnalysisError = undefined;
                },
                afterMessage: obj => `Found ${computeQuantityText(obj.feeds.length, 'podcast')}`,
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
   
    async function analyzeFeed() {
        await makeApiCall({ 
            beforeMessage: 'Analyzing podcast...',
            pathname: '/api/1/feeds/analyze',
            body: { feed: feed.url, id: feed.id, sessionToken },
            callback: obj => {
                console.log(obj);
                if (!feed || obj.feed !== feed.url) return;
                feedAnalysis = obj;
                updateApp();
            },
            afterMessage: `Finished analyzing podcast`,
            errorMessage: 'Podcast analysis failed',
            errorCallback: obj => {
                feedAnalysisError = obj.error ?? 'Failed';
            }
        });
    }

    function update() {
        if (searchResultsContainer.searchResults !== searchResults || searchResultsContainer.searchResultsPageIndex !== searchResultsPageIndex || searchResultsContainer.searchResultsPages !== searchResultsPages) {
            clearNode(searchResultsContainer);
            const pageSize = 4;
            const maxPages = 8;
            searchResultsPages = Math.max(1, Math.min(maxPages, Math.ceil(searchResults.length / pageSize)));
            for (const searchResult of searchResults.slice(searchResultsPageIndex * pageSize, (searchResultsPageIndex + 1) * pageSize)) {
                const clone = searchResultTemplate.content.cloneNode(true);
                if ((searchResult.img ?? '').trim() === '') {
                    clone.querySelector('img').style.display = 'none';
                } else {
                    clone.querySelector('img').src = searchResult.img;
                    clone.querySelector('figure').style.display = 'none';
                }
                clone.querySelector('span').textContent = searchResult.label;
                const button = clone.querySelector('sl-button');
                button.addEventListener('click', () => {
                    console.log(`click`, searchResult);
                    feed = searchResult.feed;
                    feedAnalysis = undefined;
                    feedAnalysisError = undefined;
                    updateApp();
                    analyzeFeed();
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
                feedAnalysisError = undefined;
                analyzeFeed();
            }
            
            searchResultsContainer.searchResults = searchResults;
            searchResultsContainer.searchResultsPageIndex = searchResultsPageIndex;
            searchResultsContainer.searchResultsPages = searchResultsPages;
        }

        if (feedPanel.feed !== feed || feedPanel.feedAnalysis !== feedAnalysis || feedPanel.feedAnalysisError !== feedAnalysisError) {
            const artworkSrc = feed && feed.artwork && feed.artwork !== '' ? feed.artwork : undefined;
            fpImg.src = artworkSrc ?? '#';
            fpImg.style.display = artworkSrc ? 'block' : 'none';
            fpImgPlaceholder.style.display = !artworkSrc ? 'flex' : 'none';
            fpTitleDiv.textContent = (feed && computeFeedTitle(feed)) ?? '';
            fpAuthorDiv.textContent = (feed && feed.author) ?? '';
            fpFeedAnchor.href = (feed && feed.url) ?? '#';
            fpFeedHostSpan.textContent = computeFeedHost(feed && feed.url);
            fpSummaryDiv.textContent = feedAnalysisError ? feedAnalysisError : !feed ? '' : !feedAnalysis ? 'Analyzing...' : computeFeedSummary(feedAnalysis);
            fpFoundNoneDiv.style.display = feed && feedAnalysis && feedAnalysis.itemsWithOp3Enclosures === 0 ? 'flex' : 'none';
            fpFoundAllDiv.style.display = feed && feedAnalysis && feedAnalysis.itemsWithEnclosures > 0 && feedAnalysis.itemsWithOp3Enclosures === feedAnalysis.itemsWithEnclosures ? 'flex' : 'none';
            const hasSome = feed && feedAnalysis && feedAnalysis.itemsWithOp3Enclosures > 0 && feedAnalysis.itemsWithOp3Enclosures !== feedAnalysis.itemsWithEnclosures;
            fpFoundSomeDiv.style.display = hasSome ? 'flex' : 'none';
            if ([fpFoundNoneDiv, fpFoundAllDiv, fpFoundSomeDiv].every(v => v.style.display === 'none')) {
                // maintain spacing
                fpFoundNoneDiv.style.visibility = 'hidden';
                fpFoundNoneDiv.style.display = 'flex';
            } else {
                fpFoundNoneDiv.style.visibility = 'visible';
            }
            fpFoundEpisodesSpan.textContent = (feed && feedAnalysis && computeQuantityText(feedAnalysis.itemsWithOp3Enclosures, 'episode')) ?? '';
            fpSuggestionsList.style.display = hasSome ? 'block' : 'none';
            exampleGuidSpan.textContent = feedAnalysis && feedAnalysis.guid ? feedAnalysis.guid : '00000000-0000-0000-0000-000000000000';
            fpPodcastGuidSpan.textContent = feedAnalysis && feedAnalysis.guid ? feedAnalysis.guid : 'unknown';

            feedPanel.feed = feed;
            feedPanel.feedAnalysis = feedAnalysis;
            feedPanel.feedAnalysisError = feedAnalysisError;
        }
        statusSpinner.style.visibility = status && status.pending ? 'visible' : 'hidden';
        statusMessage.textContent = status && status.message ? status.message : '';
        searchResultsContainer.style.display = searchResults.length > 1 ? 'block' : 'none';
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
