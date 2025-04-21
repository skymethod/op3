
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
    const rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'always' });
    const ageMillis = Date.now() - from;
    if (ageMillis < 1000 * 60 * 60 * 24) return strings.less_than_24_hrs_ago;
    const ageDays = ageMillis / 1000 / 60 / 60 / 24;
    if (ageDays < 31) {
        return rtf.format(-Math.round(ageDays), 'day');
    }
    if (ageDays < 365) {
        return rtf.format(-Math.round(ageDays / 30), 'month');
    }
    return rtf.format(-Math.round(ageDays / 365), 'year');

}

function computeQuantityText(quantity, zero, one, multiple) {
    return quantity === 0 ? strings[zero]
        : quantity === 1 ? strings[one]
        : strings[multiple].replace(/%d/gi, quantity.toString());
}

function computeFeedSummary(analysis) {
    // n episodes, latest 3 minutes ago
    const { itemsWithEnclosures, maxPubdate } = analysis;
    let rt = computeQuantityText(itemsWithEnclosures, 'zero_episodes', 'one_episode', 'multiple_episodes');
    if (typeof maxPubdate === 'string') {
        const suffix = computeRelativeTime(new Date(maxPubdate).getTime());
        rt += `, ${itemsWithEnclosures > 1 ? `${strings.latest_as_prefix_to_relative_time} ` : ''}${suffix}`;
    }
    return rt;
}

function scheduleUpdateSessionToken() {
    setTimeout(async () => {
        const body = { sessionToken };
        const res = await fetch('/api/1/session-tokens', { method: 'POST', headers: { authorization: `Bearer ${previewToken}` }, body: JSON.stringify(body) });
        if (res.status === 200) {
            const { sessionToken: newSessionToken } = await res.json();
            if (typeof newSessionToken === 'string') {
                console.log('Updated sessionToken');
                sessionToken = newSessionToken;
            }
        }
        scheduleUpdateSessionToken();
    }, 1000 * 60 * 4);
}
scheduleUpdateSessionToken();

const app = (() => {

    let status = { message: strings.search_prompt_message};
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

    const [ showPagePreviewAlert, showPageLink, feedPanel, fpImg, fpImgPlaceholder, fpTitleDiv, fpAuthorDiv, fpFeedAnchor, fpFeedHostSpan, fpSummaryDiv, fpFoundNoneDiv, fpFoundAllDiv, fpFoundSomeDiv, fpFoundEpisodesSpan, fpSuggestionsList, fpPodcastGuidSpan ] = 
        [ 'show-page-preview', 'show-page-link', 'feed-panel', 'fp-img', 'fp-img-placeholder', 'fp-title-div', 'fp-author-div', 'fp-feed-anchor', 'fp-feed-host-span', 'fp-summary-div', 'fp-found-none-div', 'fp-found-all-div', 'fp-found-some-div', 'fp-found-episodes-span', 'fp-suggestions-list', 'fp-podcast-guid' ].map(v => document.getElementById(v));

    const { lang: langParam, ro: roParam } = Object.fromEntries(new URL(document.location.href).searchParams);

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
                beforeMessage: strings.search_finding_message,
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
                afterMessage: obj => computeQuantityText(obj.feeds.length, 'found_zero_podcasts', 'found_one_podcast', 'found_multiple_podcasts'),
                errorMessage: strings.search_failed_message,
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
            beforeMessage: strings.analyze_started_message,
            pathname: `/api/1/feeds/analyze${roParam === 'true' ? '?ro=true' : ''}`,
            body: { feed: feed.url, id: feed.id, sessionToken },
            callback: obj => {
                console.log(obj);
                if (!feed || obj.feed !== feed.url) return;
                feedAnalysis = obj;
                updateApp();
            },
            afterMessage: strings.analyze_finished_message,
            errorMessage: strings.analyze_failed_message,
            errorCallback: obj => {
                feedAnalysisError = obj.error ?? strings.analyze_failed_default_error_message;
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
            fpSummaryDiv.textContent = feedAnalysisError ? feedAnalysisError : !feed ? '' : !feedAnalysis ? strings.feed_summary_analyzing : computeFeedSummary(feedAnalysis);
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
            fpFoundEpisodesSpan.textContent = (feed && feedAnalysis && computeQuantityText(feedAnalysis.itemsWithOp3Enclosures, 'zero_episodes', 'one_episode', 'multiple_episodes')) ?? '';
            fpSuggestionsList.style.display = hasSome ? 'block' : 'none';
            exampleGuidSpan.textContent = feedAnalysis && feedAnalysis.guid ? feedAnalysis.guid : '00000000-0000-0000-0000-000000000000';
            fpPodcastGuidSpan.textContent = feedAnalysis && feedAnalysis.guid ? feedAnalysis.guid : 'unknown';

            feedPanel.feed = feed;
            feedPanel.feedAnalysis = feedAnalysis;
            feedPanel.feedAnalysisError = feedAnalysisError;
            const u = new URL(`${document.location.origin}/show/${(feedAnalysis && feedAnalysis.showUuid) || (feedAnalysis && feedAnalysis.guid) || ''}`);
            if (langParam) u.searchParams.set('lang', langParam);
            showPageLink.href = u.toString();
        }
        statusSpinner.style.visibility = status && status.pending ? 'visible' : 'hidden';
        statusMessage.textContent = status && status.message ? status.message : '';
        searchResultsContainer.style.display = searchResults.length > 1 ? 'block' : 'none';
        searchResultsPageButtonGroup.style.display = searchResultsPages > 1 ? 'block' : 'none';

        feedPanel.style.display = feed ? 'block' : 'none';
        showPagePreviewAlert.style.display = feed && feedAnalysis && feedAnalysis.itemsWithOp3Enclosures > 0 && feedAnalysis.guid ? 'block' : 'none';
    }

    return { update };
})();

globalThis.updateApp = () => app.update();

globalThis.addEventListener('DOMContentLoaded', () => {
    console.log('Document content loaded');
    updateApp();
});
