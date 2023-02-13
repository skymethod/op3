import { addDaysToDateString } from '../worker/timestamp.ts';
import { element, SlRelativeTime } from './elements.ts';
import { pluralize } from './util.ts';

type Opts = { mostRecentDate: string | undefined };

export const makeFooter = ({ mostRecentDate = new Date().toISOString().substring(0, 10) }: Opts) => {

    const [ lastUpdatedDateSpan, lastUpdatedAgoRelativeTime, timezoneSpan, currentTimezoneNameSpan, currentTimezoneOffsetSpan ] = [ 
        element('footer-last-updated-date'),
        element<SlRelativeTime>('footer-last-updated-ago'),
        element('footer-timezone'),
        element('footer-current-timezone-name'),
        element('footer-current-timezone-offset'),
    ];

    lastUpdatedDateSpan.textContent = shorterDayFormat.format(new Date(`${mostRecentDate}T00:00:00.000Z`));
    lastUpdatedAgoRelativeTime.date = `${addDaysToDateString(mostRecentDate, 1)}T00:00:00.000Z`;

    try {
        currentTimezoneNameSpan.textContent = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const offsetMinutes = new Date().getTimezoneOffset();
        const offsetHours = pluralize(Math.abs(offsetMinutes) / 60, 'hour');
        currentTimezoneOffsetSpan.textContent = offsetMinutes === 0 ? 'equal to'
            : offsetMinutes > 0 ? `${offsetHours} behind`
            : `${offsetHours} ahead of`;
    } catch (e) {
        console.warn(`Error displaying current time zone: ${e.stack || e}`);
        timezoneSpan.style.visibility = 'hidden';
    }

    function update() {

    }

    update();

    return { update };
};

//

const shorterDayFormat = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' });
