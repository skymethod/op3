import { assertEquals, assertThrows } from './tests/deps.ts';
import { parsePubdate } from './pubdates.ts';

Deno.test({
    name: 'pubdates',
    fn: () => {
        const good = {
            'Tue, 09 Nov 2021 17:08:12 GMT': '2021-11-09T17:08:12.000Z',
            'Tue, 09 Nov 2021 17:08:12 gmt': '2021-11-09T17:08:12.000Z',
            'Tue, 09 Nov 2021 17:08:12 UTc': '2021-11-09T17:08:12.000Z',
            'Fri, 10 Jul 2020 06:00:00 -0000': '2020-07-10T06:00:00.000Z',
            '2022-10-13T14:56:23-07:00': '2022-10-13T21:56:23.000Z',
            'Sun, 4 Dec 2022 14:30:00 CEST': '2022-12-04T13:30:00.000Z',
            'Sun, 4 Dec 2022 14:30:00 CET': '2022-12-04T13:30:00.000Z',
            'Sun, 10 Jul 2022 14:30:00 CEST': '2022-07-10T12:30:00.000Z',
            'Fri, 14 Jul 2023 19:00:00 PDT': '2023-07-15T02:00:00.000Z',
            'Sun, 11 Jun 2023 17:10:00 EDT': '2023-06-11T21:10:00.000Z',
            '2023-07-17 12:00:00 +0000': '2023-07-17T12:00:00.000Z',
            'Tue, 30 May 2023 18:07:06 UT': '2023-05-30T18:07:06.000Z',
            'Fri, 07 Jul 2023 15:00:00 CDT': '2023-07-07T20:00:00.000Z',
            '02/03/2023 06:34:00': '2023-02-03T06:34:00.000Z',
            'Fri, 16 Jun 2017 13:00:00 MDT': '2017-06-16T19:00:00.000Z',
            'Wed, 19 Jul 2023 22:48:03 Z': '2023-07-19T22:48:03.000Z',
            'Fri, 7 Ju1 2023 02:00:00 GMT': '2023-07-07T02:00:00.000Z',
            'Sun, 16 Jul 2023 00:00:00 -0400': '2023-07-16T04:00:00.000Z',
            'Wednesday, 24 September 2008 10:00:00 EDT': '2008-09-24T14:00:00.000Z',
            'Fri, 27 Jan 2017 22:36:00 CST 01:00:00 CST': '2017-01-28T04:36:00.000Z',
            '2023-09-05 01:59:37': '2023-09-05T01:59:37.000Z',
            'Wed, 5 Jun 2019 00:00:00 +0000Wed, 19 Apr 2023 14:14:14 +1100': '2019-06-05T00:00:00.000Z',
            'Sun, 30 Sep 2018 00:00,00 +0000': '2018-09-30T00:00:00.000Z',
            'Wed, 06 Sep 2023 17:37,53 +0000': '2023-09-06T17:37:53.000Z',
            'Fri, 01 Sep 2023 19:15:00, GMT+3': '2023-09-01T16:15:00.000Z',
            'Sat, 04 Dez 2021 14:00:00 GMT': '2021-12-04T14:00:00.000Z',
            'Wed, 23 September 2020 04:58:48GMT': '2020-09-23T04:58:48.000Z',
            '30 Abr 2014 20:30:03 GMT': '2014-04-30T20:30:03.000Z',
            '22 Ene 2014 20:30:03 GMT': '2014-01-22T20:30:03.000Z',
            '18 Dic 2013 20:30:03 GMT': '2013-12-18T20:30:03.000Z',
            '28 Ago 2013 20:30:03 GMT': '2013-08-28T20:30:03.000Z',
            'Wed, 20 May 2020 04:33:00 +0000': '2020-05-20T04:33:00.000Z',
            '2024-11-21': '2024-11-21T00:00:00.000Z',
            '2020-01-01': '2020-01-01T00:00:00.000Z',
            '2020-10-9': '2020-10-09T00:00:00.000Z',
        };
        for (const [ input, expected ] of Object.entries(good)) {
            assertEquals(parsePubdate(input), expected);
        }

        const bad = [ '0', '', 'a', '2024-21-11', '2024-11-41' ];
        for (const input of bad) {
            assertThrows(() => parsePubdate(input));
        }
    }
});
