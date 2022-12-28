
export function computeMonthName(month: string, { includeYear }: { includeYear?: boolean } = {}): string {
    return (includeYear ? monthNameAndYearFormat : monthNameFormat).format(new Date(`${month}-01T00:00:00.000Z`));
}

//

const monthNameFormat = new Intl.DateTimeFormat('en-US', { month: 'long', timeZone: 'UTC' });
const monthNameAndYearFormat = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
