import { ascend, descend } from './deps.ts';

export function compareByAscending<T, X>(fn: (t: T) => X): (a: T, b: T) => number {
    return (a, b) => ascend(fn(a), fn(b));
}

export function compareByDescending<T, X>(fn: (t: T) => X): (a: T, b: T) => number {
    return (a, b) => descend(fn(a), fn(b));
}

export function minString(lhs: string, rhs: string): string {
    return lhs < rhs ? lhs : rhs;
}

export function maxString(lhs: string, rhs: string): string {
    return lhs > rhs ? lhs : rhs;
}
