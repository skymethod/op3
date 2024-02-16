import { addDaysToDateString } from '../worker/timestamp.ts';
import { element, SlRelativeTime } from './elements.ts';
import { pluralize, replacePlaceholders } from './deps.ts';

type Opts = { mostRecentDate: string | undefined, strings: Record<string, string>, lang: string | undefined };

export const makeFooter = ({ mostRecentDate = new Date().toISOString().substring(0, 10), strings, lang }: Opts) => {

    const [ lastUpdatedDateSpan, lastUpdatedAgoRelativeTime, timezoneDiv ] = [ 
        element('footer-last-updated-date'),
        element<SlRelativeTime>('footer-last-updated-ago'),
        element('footer-timezone'),
    ];

    const locale = lang ?? 'en-US';
    const shorterDayFormat = new Intl.DateTimeFormat(locale, { month: 'long', day: 'numeric', timeZone: 'UTC' });
    lastUpdatedDateSpan.textContent = shorterDayFormat.format(new Date(`${mostRecentDate}T00:00:00.000Z`));
    lastUpdatedAgoRelativeTime.date = `${addDaysToDateString(mostRecentDate, 1)}T00:00:00.000Z`;

    try {
        const currentTimezone = Intl.DateTimeFormat(locale).resolvedOptions().timeZone;
        const offsetMinutes = new Date().getTimezoneOffset();
        const offsetHours = pluralize(Math.abs(offsetMinutes) / 60, strings, 'one_hour', 'multiple_hours');

        timezoneDiv.textContent = offsetMinutes === 0 ? replacePlaceholders(strings.tz_is_equal_to_utc, [ [ 'currentTimezone', currentTimezone ], [ 'utc', strings.utc ]])
            : offsetMinutes > 0 ? replacePlaceholders(strings.tz_is_behind_utc, [ [ 'currentTimezone', currentTimezone ], [ 'offsetHours', offsetHours ], [ 'utc', strings.utc ]])
            : replacePlaceholders(strings.tz_is_ahead_of_utc, [ [ 'currentTimezone', currentTimezone ], [ 'offsetHours', offsetHours ], [ 'utc', strings.utc ]]);
    } catch (e) {
        console.warn(`Error displaying current time zone: ${e.stack || e}`);
        timezoneDiv.style.visibility = 'hidden';
    }

    function update() {

    }

    update();

    return { update };
};
