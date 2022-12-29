
export function computeMonthName(month: string, { includeYear }: { includeYear?: boolean } = {}): string {
    return (includeYear ? monthNameAndYearFormat : monthNameFormat).format(new Date(`${month}-01T00:00:00.000Z`));
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

export function pluralize(n: number, unit: string, format?: Intl.NumberFormat): string {
    return `${(format ?? withCommas).format(n)} ${unit}${n !== 1 ? 's' : ''}`;
}

//

const monthNameFormat = new Intl.DateTimeFormat('en-US', { month: 'long', timeZone: 'UTC' });
const monthNameAndYearFormat = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const withCommas = new Intl.NumberFormat('en-US');

