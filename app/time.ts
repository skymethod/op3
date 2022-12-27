
export function computeMonthName(month: string): string {
    return monthNameFormat.format(new Date(`${month}-01T00:00:00.000Z`));
}

//

const monthNameFormat = new Intl.DateTimeFormat('en-US', { month: 'long', timeZone: 'UTC' });
