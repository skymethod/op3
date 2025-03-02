
export function computeMonthName(month: string, lang: string | undefined, { includeYear }: { includeYear?: boolean } = {}): string {
    return (includeYear ? getMonthNameAndYearFormat(lang) : getMonthNameFormat(lang)).format(new Date(`${month}-01T00:00:00.000Z`));
}

export function download(content: Blob[] | string, { type, filename }: { type: string, filename: string }) {
    const parts = typeof content === 'string' ? [ content ] : content;
    const blob = new Blob(parts, { type });

    const blobUrl = URL.createObjectURL(blob);

    const anchor = document.createElement('a');
    anchor.href = blobUrl;
    anchor.target = '_blank';
    anchor.download = filename;
    anchor.click();

    URL.revokeObjectURL(blobUrl);
}

export function getOrCache<K, V>(map: Map<K, V>, key: K, valueFn: () => V): V {
    let rt = map.get(key);
    if (!rt) {
        rt = valueFn();
        map.set(key, rt);
    }
    return rt;
}

//

const monthNameFormatsByLocale = new Map<string, Intl.DateTimeFormat>();
export function getMonthNameFormat(lang: string | undefined): Intl.DateTimeFormat {
    return getOrCacheByLocale(monthNameFormatsByLocale, lang, locale => new Intl.DateTimeFormat(locale, { month: 'long', timeZone: 'UTC' }));
}

const monthNameAndYearFormatsByLocale = new Map<string, Intl.DateTimeFormat>();
export function getMonthNameAndYearFormat(lang: string | undefined): Intl.DateTimeFormat {
    return getOrCacheByLocale(monthNameAndYearFormatsByLocale, lang, locale =>  new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }));
}

const numberFormatsByLocale = new Map<string, Intl.NumberFormat>();
export function getNumberFormat(lang: string | undefined): Intl.NumberFormat {
    return getOrCacheByLocale(numberFormatsByLocale, lang, locale => new Intl.NumberFormat(locale));
}

const dayFormatsByLocale = new Map<string, Intl.DateTimeFormat>();
export function getDayFormat(lang: string | undefined): Intl.DateTimeFormat {
    return getOrCacheByLocale(dayFormatsByLocale, lang, locale => new Intl.DateTimeFormat(locale, { weekday: 'short', month: 'long', day: 'numeric', timeZone: 'UTC' }));
}

const shorterDayFormatsByLocale = new Map<string, Intl.DateTimeFormat>();
export function getShorterDayFormat(lang: string | undefined): Intl.DateTimeFormat {
    return getOrCacheByLocale(shorterDayFormatsByLocale, lang, locale => new Intl.DateTimeFormat(locale, { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }));
}

const dayAndHourFormatsByLocale = new Map<string, Intl.DateTimeFormat>();
export function getDayAndHourFormat(lang: string | undefined): Intl.DateTimeFormat {
    return getOrCacheByLocale(dayAndHourFormatsByLocale, lang, locale => new Intl.DateTimeFormat(locale, { weekday: 'short', month: 'long', day: 'numeric', hour: 'numeric', hour12: true, timeZone: 'UTC' }));
}

const timeOnlyFormatsByLocale = new Map<string, Intl.DateTimeFormat>();
export function getTimeOnlyFormat(lang: string | undefined): Intl.DateTimeFormat {
    return getOrCacheByLocale(timeOnlyFormatsByLocale, lang, locale => new Intl.DateTimeFormat(locale, { hour: 'numeric', hour12: true, timeZone: 'UTC' }));
}

export function tryComputeRegionNameInEnglish(countryCode: string): string | undefined {
    try {
        return regionNamesInEnglish.of(countryCode);
    } catch (e) {
        console.warn(`tryComputeRegionNameInEnglish: ${e.stack || e} for ${countryCode}`);
    }
}

export function computeCountryName(countryCode: string): string {
    if (countryCode === 'T1') return 'Tor traffic';
    if (countryCode === 'XX') return 'Unknown';
    return (countryCode.length === 2 ? tryComputeRegionNameInEnglish(countryCode) : undefined ) ?? countryCode;
}

//

const regionNamesInEnglish = new Intl.DisplayNames([ 'en' ], { type: 'region' });

function getOrCacheByLocale<V>(map: Map<string, V>, lang: string | undefined, valueFn: (locale: string) => V): V {
    const locale = lang ?? 'en-US';
    return getOrCache(map, locale, () => valueFn(locale));
}
