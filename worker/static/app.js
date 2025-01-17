// deno-fmt-ignore-file
// deno-lint-ignore-file
// This code was bundled using `deno bundle` and it's not recommended to edit it manually

function l(n) {
    return n + .5 | 0;
}
var b = (n, e, f)=>Math.max(Math.min(n, f), e);
function m(n) {
    return b(l(n * 2.55), 0, 255);
}
function d(n) {
    return b(l(n * 255), 0, 255);
}
function o(n) {
    return b(l(n / 2.55) / 100, 0, 1);
}
function X(n) {
    return b(l(n * 100), 0, 100);
}
var i = {
    0: 0,
    1: 1,
    2: 2,
    3: 3,
    4: 4,
    5: 5,
    6: 6,
    7: 7,
    8: 8,
    9: 9,
    A: 10,
    B: 11,
    C: 12,
    D: 13,
    E: 14,
    F: 15,
    a: 10,
    b: 11,
    c: 12,
    d: 13,
    e: 14,
    f: 15
}, w = [
    ..."0123456789ABCDEF"
], Z = (n)=>w[n & 15], A = (n)=>w[(n & 240) >> 4] + w[n & 15], y = (n)=>(n & 240) >> 4 === (n & 15), U = (n)=>y(n.r) && y(n.g) && y(n.b) && y(n.a);
function V(n) {
    var e = n.length, f;
    return n[0] === "#" && (e === 4 || e === 5 ? f = {
        r: 255 & i[n[1]] * 17,
        g: 255 & i[n[2]] * 17,
        b: 255 & i[n[3]] * 17,
        a: e === 5 ? i[n[4]] * 17 : 255
    } : (e === 7 || e === 9) && (f = {
        r: i[n[1]] << 4 | i[n[2]],
        g: i[n[3]] << 4 | i[n[4]],
        b: i[n[5]] << 4 | i[n[6]],
        a: e === 9 ? i[n[7]] << 4 | i[n[8]] : 255
    })), f;
}
var H = (n, e)=>n < 255 ? e(n) : "";
function W(n) {
    var e = U(n) ? Z : A;
    return n ? "#" + e(n.r) + e(n.g) + e(n.b) + H(n.a, e) : void 0;
}
var q = /^(hsla?|hwb|hsv)\(\s*([-+.e\d]+)(?:deg)?[\s,]+([-+.e\d]+)%[\s,]+([-+.e\d]+)%(?:[\s,]+([-+.e\d]+)(%)?)?\s*\)$/;
function $(n, e, f) {
    let t = e * Math.min(f, 1 - f), r = (a, s = (a + n / 30) % 12)=>f - t * Math.max(Math.min(s - 3, 9 - s, 1), -1);
    return [
        r(0),
        r(8),
        r(4)
    ];
}
function L(n, e, f) {
    let t = (r, a = (r + n / 60) % 6)=>f - f * e * Math.max(Math.min(a, 4 - a, 1), 0);
    return [
        t(5),
        t(3),
        t(1)
    ];
}
function j(n, e, f) {
    let t = $(n, 1, .5), r;
    for(e + f > 1 && (r = 1 / (e + f), e *= r, f *= r), r = 0; r < 3; r++)t[r] *= 1 - e - f, t[r] += e;
    return t;
}
function N(n, e, f, t, r) {
    return n === r ? (e - f) / t + (e < f ? 6 : 0) : e === r ? (f - n) / t + 2 : (n - e) / t + 4;
}
function _(n) {
    let f = n.r / 255, t = n.g / 255, r = n.b / 255, a = Math.max(f, t, r), s = Math.min(f, t, r), c = (a + s) / 2, g, u, x;
    return a !== s && (x = a - s, u = c > .5 ? x / (2 - a - s) : x / (a + s), g = N(f, t, r, x, a), g = g * 60 + .5), [
        g | 0,
        u || 0,
        c
    ];
}
function M(n, e, f, t) {
    return (Array.isArray(e) ? n(e[0], e[1], e[2]) : n(e, f, t)).map(d);
}
function S(n, e, f) {
    return M($, n, e, f);
}
function K(n, e, f) {
    return M(j, n, e, f);
}
function B(n, e, f) {
    return M(L, n, e, f);
}
function P(n) {
    return (n % 360 + 360) % 360;
}
function Q(n) {
    let e = q.exec(n), f = 255, t;
    if (!e) return;
    e[5] !== t && (f = e[6] ? m(+e[5]) : d(+e[5]));
    let r = P(+e[2]), a = +e[3] / 100, s = +e[4] / 100;
    return e[1] === "hwb" ? t = K(r, a, s) : e[1] === "hsv" ? t = B(r, a, s) : t = S(r, a, s), {
        r: t[0],
        g: t[1],
        b: t[2],
        a: f
    };
}
function C(n, e) {
    var f = _(n);
    f[0] = P(f[0] + e), f = S(f), n.r = f[0], n.g = f[1], n.b = f[2];
}
function D(n) {
    if (!n) return;
    let e = _(n), f = e[0], t = X(e[1]), r = X(e[2]);
    return n.a < 255 ? `hsla(${f}, ${t}%, ${r}%, ${o(n.a)})` : `hsl(${f}, ${t}%, ${r}%)`;
}
var O = {
    x: "dark",
    Z: "light",
    Y: "re",
    X: "blu",
    W: "gr",
    V: "medium",
    U: "slate",
    A: "ee",
    T: "ol",
    S: "or",
    B: "ra",
    C: "lateg",
    D: "ights",
    R: "in",
    Q: "turquois",
    E: "hi",
    P: "ro",
    O: "al",
    N: "le",
    M: "de",
    L: "yello",
    F: "en",
    K: "ch",
    G: "arks",
    H: "ea",
    I: "ightg",
    J: "wh"
}, E = {
    OiceXe: "f0f8ff",
    antiquewEte: "faebd7",
    aqua: "ffff",
    aquamarRe: "7fffd4",
    azuY: "f0ffff",
    beige: "f5f5dc",
    bisque: "ffe4c4",
    black: "0",
    blanKedOmond: "ffebcd",
    Xe: "ff",
    XeviTet: "8a2be2",
    bPwn: "a52a2a",
    burlywood: "deb887",
    caMtXe: "5f9ea0",
    KartYuse: "7fff00",
    KocTate: "d2691e",
    cSO: "ff7f50",
    cSnflowerXe: "6495ed",
    cSnsilk: "fff8dc",
    crimson: "dc143c",
    cyan: "ffff",
    xXe: "8b",
    xcyan: "8b8b",
    xgTMnPd: "b8860b",
    xWay: "a9a9a9",
    xgYF: "6400",
    xgYy: "a9a9a9",
    xkhaki: "bdb76b",
    xmagFta: "8b008b",
    xTivegYF: "556b2f",
    xSange: "ff8c00",
    xScEd: "9932cc",
    xYd: "8b0000",
    xsOmon: "e9967a",
    xsHgYF: "8fbc8f",
    xUXe: "483d8b",
    xUWay: "2f4f4f",
    xUgYy: "2f4f4f",
    xQe: "ced1",
    xviTet: "9400d3",
    dAppRk: "ff1493",
    dApskyXe: "bfff",
    dimWay: "696969",
    dimgYy: "696969",
    dodgerXe: "1e90ff",
    fiYbrick: "b22222",
    flSOwEte: "fffaf0",
    foYstWAn: "228b22",
    fuKsia: "ff00ff",
    gaRsbSo: "dcdcdc",
    ghostwEte: "f8f8ff",
    gTd: "ffd700",
    gTMnPd: "daa520",
    Way: "808080",
    gYF: "8000",
    gYFLw: "adff2f",
    gYy: "808080",
    honeyMw: "f0fff0",
    hotpRk: "ff69b4",
    RdianYd: "cd5c5c",
    Rdigo: "4b0082",
    ivSy: "fffff0",
    khaki: "f0e68c",
    lavFMr: "e6e6fa",
    lavFMrXsh: "fff0f5",
    lawngYF: "7cfc00",
    NmoncEffon: "fffacd",
    ZXe: "add8e6",
    ZcSO: "f08080",
    Zcyan: "e0ffff",
    ZgTMnPdLw: "fafad2",
    ZWay: "d3d3d3",
    ZgYF: "90ee90",
    ZgYy: "d3d3d3",
    ZpRk: "ffb6c1",
    ZsOmon: "ffa07a",
    ZsHgYF: "20b2aa",
    ZskyXe: "87cefa",
    ZUWay: "778899",
    ZUgYy: "778899",
    ZstAlXe: "b0c4de",
    ZLw: "ffffe0",
    lime: "ff00",
    limegYF: "32cd32",
    lRF: "faf0e6",
    magFta: "ff00ff",
    maPon: "800000",
    VaquamarRe: "66cdaa",
    VXe: "cd",
    VScEd: "ba55d3",
    VpurpN: "9370db",
    VsHgYF: "3cb371",
    VUXe: "7b68ee",
    VsprRggYF: "fa9a",
    VQe: "48d1cc",
    VviTetYd: "c71585",
    midnightXe: "191970",
    mRtcYam: "f5fffa",
    mistyPse: "ffe4e1",
    moccasR: "ffe4b5",
    navajowEte: "ffdead",
    navy: "80",
    Tdlace: "fdf5e6",
    Tive: "808000",
    TivedBb: "6b8e23",
    Sange: "ffa500",
    SangeYd: "ff4500",
    ScEd: "da70d6",
    pOegTMnPd: "eee8aa",
    pOegYF: "98fb98",
    pOeQe: "afeeee",
    pOeviTetYd: "db7093",
    papayawEp: "ffefd5",
    pHKpuff: "ffdab9",
    peru: "cd853f",
    pRk: "ffc0cb",
    plum: "dda0dd",
    powMrXe: "b0e0e6",
    purpN: "800080",
    YbeccapurpN: "663399",
    Yd: "ff0000",
    Psybrown: "bc8f8f",
    PyOXe: "4169e1",
    saddNbPwn: "8b4513",
    sOmon: "fa8072",
    sandybPwn: "f4a460",
    sHgYF: "2e8b57",
    sHshell: "fff5ee",
    siFna: "a0522d",
    silver: "c0c0c0",
    skyXe: "87ceeb",
    UXe: "6a5acd",
    UWay: "708090",
    UgYy: "708090",
    snow: "fffafa",
    sprRggYF: "ff7f",
    stAlXe: "4682b4",
    tan: "d2b48c",
    teO: "8080",
    tEstN: "d8bfd8",
    tomato: "ff6347",
    Qe: "40e0d0",
    viTet: "ee82ee",
    JHt: "f5deb3",
    wEte: "ffffff",
    wEtesmoke: "f5f5f5",
    Lw: "ffff00",
    LwgYF: "9acd32"
};
function v() {
    let n = {}, e = Object.keys(E), f = Object.keys(O), t, r, a, s, c;
    for(t = 0; t < e.length; t++){
        for(s = c = e[t], r = 0; r < f.length; r++)a = f[r], c = c.replace(a, O[a]);
        a = parseInt(E[s], 16), n[c] = [
            a >> 16 & 255,
            a >> 8 & 255,
            a & 255
        ];
    }
    return n;
}
var F;
function G(n) {
    F || (F = v(), F.transparent = [
        0,
        0,
        0,
        0
    ]);
    let e = F[n.toLowerCase()];
    return e && {
        r: e[0],
        g: e[1],
        b: e[2],
        a: e.length === 4 ? e[3] : 255
    };
}
var I = /^rgba?\(\s*([-+.\d]+)(%)?[\s,]+([-+.e\d]+)(%)?[\s,]+([-+.e\d]+)(%)?(?:[\s,/]+([-+.e\d]+)(%)?)?\s*\)$/;
function J(n) {
    let e = I.exec(n), f = 255, t, r, a;
    if (e) {
        if (e[7] !== t) {
            let s = +e[7];
            f = e[8] ? m(s) : b(s * 255, 0, 255);
        }
        return t = +e[1], r = +e[3], a = +e[5], t = 255 & (e[2] ? m(t) : b(t, 0, 255)), r = 255 & (e[4] ? m(r) : b(r, 0, 255)), a = 255 & (e[6] ? m(a) : b(a, 0, 255)), {
            r: t,
            g: r,
            b: a,
            a: f
        };
    }
}
function z(n) {
    return n && (n.a < 255 ? `rgba(${n.r}, ${n.g}, ${n.b}, ${o(n.a)})` : `rgb(${n.r}, ${n.g}, ${n.b})`);
}
var Y = (n)=>n <= .0031308 ? n * 12.92 : Math.pow(n, 1 / 2.4) * 1.055 - .055, h = (n)=>n <= .04045 ? n / 12.92 : Math.pow((n + .055) / 1.055, 2.4);
function ee(n, e, f) {
    let t = h(o(n.r)), r = h(o(n.g)), a = h(o(n.b));
    return {
        r: d(Y(t + f * (h(o(e.r)) - t))),
        g: d(Y(r + f * (h(o(e.g)) - r))),
        b: d(Y(a + f * (h(o(e.b)) - a))),
        a: n.a + f * (e.a - n.a)
    };
}
function p(n, e, f) {
    if (n) {
        let t = _(n);
        t[e] = Math.max(0, Math.min(t[e] + t[e] * f, e === 0 ? 360 : 1)), t = S(t), n.r = t[0], n.g = t[1], n.b = t[2];
    }
}
function T(n, e) {
    return n && Object.assign(e || {}, n);
}
function R(n) {
    var e = {
        r: 0,
        g: 0,
        b: 0,
        a: 255
    };
    return Array.isArray(n) ? n.length >= 3 && (e = {
        r: n[0],
        g: n[1],
        b: n[2],
        a: 255
    }, n.length > 3 && (e.a = d(n[3]))) : (e = T(n, {
        r: 0,
        g: 0,
        b: 0,
        a: 1
    }), e.a = d(e.a)), e;
}
function ne(n) {
    return n.charAt(0) === "r" ? J(n) : Q(n);
}
var k = class n {
    constructor(e){
        if (e instanceof n) return e;
        let f = typeof e, t;
        f === "object" ? t = R(e) : f === "string" && (t = V(e) || G(e) || ne(e)), this._rgb = t, this._valid = !!t;
    }
    get valid() {
        return this._valid;
    }
    get rgb() {
        var e = T(this._rgb);
        return e && (e.a = o(e.a)), e;
    }
    set rgb(e) {
        this._rgb = R(e);
    }
    rgbString() {
        return this._valid ? z(this._rgb) : void 0;
    }
    hexString() {
        return this._valid ? W(this._rgb) : void 0;
    }
    hslString() {
        return this._valid ? D(this._rgb) : void 0;
    }
    mix(e, f) {
        if (e) {
            let t = this.rgb, r = e.rgb, a, s = f === a ? .5 : f, c = 2 * s - 1, g = t.a - r.a, u = ((c * g === -1 ? c : (c + g) / (1 + c * g)) + 1) / 2;
            a = 1 - u, t.r = 255 & u * t.r + a * r.r + .5, t.g = 255 & u * t.g + a * r.g + .5, t.b = 255 & u * t.b + a * r.b + .5, t.a = s * t.a + (1 - s) * r.a, this.rgb = t;
        }
        return this;
    }
    interpolate(e, f) {
        return e && (this._rgb = ee(this._rgb, e._rgb, f)), this;
    }
    clone() {
        return new n(this.rgb);
    }
    alpha(e) {
        return this._rgb.a = d(e), this;
    }
    clearer(e) {
        let f = this._rgb;
        return f.a *= 1 - e, this;
    }
    greyscale() {
        let e = this._rgb, f = l(e.r * .3 + e.g * .59 + e.b * .11);
        return e.r = e.g = e.b = f, this;
    }
    opaquer(e) {
        let f = this._rgb;
        return f.a *= 1 + e, this;
    }
    negate() {
        let e = this._rgb;
        return e.r = 255 - e.r, e.g = 255 - e.g, e.b = 255 - e.b, this;
    }
    lighten(e) {
        return p(this._rgb, 2, e), this;
    }
    darken(e) {
        return p(this._rgb, 2, -e), this;
    }
    saturate(e) {
        return p(this._rgb, 1, e), this;
    }
    desaturate(e) {
        return p(this._rgb, 1, -e), this;
    }
    rotate(e) {
        return C(this._rgb, e), this;
    }
};
(()=>{
    let e = 0;
    return ()=>e++;
})();
function M1(e) {
    if (Array.isArray && Array.isArray(e)) return !0;
    let t = Object.prototype.toString.call(e);
    return t.slice(0, 7) === "[object" && t.slice(-6) === "Array]";
}
function _1(e) {
    return e !== null && Object.prototype.toString.call(e) === "[object Object]";
}
function T1(e, t) {
    return typeof e > "u" ? t : e;
}
function N1(e) {
    if (M1(e)) return e.map(N1);
    if (_1(e)) {
        let t = Object.create(null), n = Object.keys(e), o = n.length, r = 0;
        for(; r < o; ++r)t[n[r]] = N1(e[n[r]]);
        return t;
    }
    return e;
}
function pe(e) {
    return [
        "__proto__",
        "prototype",
        "constructor"
    ].indexOf(e) === -1;
}
function Le(e, t, n, o) {
    if (!pe(e)) return;
    let r = t[e], i = n[e];
    _1(r) && _1(i) ? F1(r, i, o) : t[e] = N1(i);
}
function F1(e, t, n) {
    let o = M1(t) ? t : [
        t
    ], r = o.length;
    if (!_1(e)) return e;
    n = n || {};
    let i = n.merger || Le, s;
    for(let a = 0; a < r; ++a){
        if (s = o[a], !_1(s)) continue;
        let c = Object.keys(s);
        for(let l = 0, u = c.length; l < u; ++l)i(c[l], e, s, n);
    }
    return e;
}
var p1 = Math.PI, O1 = 2 * p1, H1 = Number.POSITIVE_INFINITY, S1 = p1 / 2, Y1 = Math.log10;
(function() {
    return typeof window > "u" ? function(e) {
        return e();
    } : window.requestAnimationFrame;
})();
var D1 = (e)=>e === 0 || e === 1, ie = (e, t, n)=>-(Math.pow(2, 10 * (e -= 1)) * Math.sin((e - t) * O1 / n)), se = (e, t, n)=>Math.pow(2, -10 * e) * Math.sin((e - t) * O1 / n) + 1, G1 = {
    linear: (e)=>e,
    easeInQuad: (e)=>e * e,
    easeOutQuad: (e)=>-e * (e - 2),
    easeInOutQuad: (e)=>(e /= .5) < 1 ? .5 * e * e : -.5 * (--e * (e - 2) - 1),
    easeInCubic: (e)=>e * e * e,
    easeOutCubic: (e)=>(e -= 1) * e * e + 1,
    easeInOutCubic: (e)=>(e /= .5) < 1 ? .5 * e * e * e : .5 * ((e -= 2) * e * e + 2),
    easeInQuart: (e)=>e * e * e * e,
    easeOutQuart: (e)=>-((e -= 1) * e * e * e - 1),
    easeInOutQuart: (e)=>(e /= .5) < 1 ? .5 * e * e * e * e : -.5 * ((e -= 2) * e * e * e - 2),
    easeInQuint: (e)=>e * e * e * e * e,
    easeOutQuint: (e)=>(e -= 1) * e * e * e * e + 1,
    easeInOutQuint: (e)=>(e /= .5) < 1 ? .5 * e * e * e * e * e : .5 * ((e -= 2) * e * e * e * e + 2),
    easeInSine: (e)=>-Math.cos(e * S1) + 1,
    easeOutSine: (e)=>Math.sin(e * S1),
    easeInOutSine: (e)=>-.5 * (Math.cos(p1 * e) - 1),
    easeInExpo: (e)=>e === 0 ? 0 : Math.pow(2, 10 * (e - 1)),
    easeOutExpo: (e)=>e === 1 ? 1 : -Math.pow(2, -10 * e) + 1,
    easeInOutExpo: (e)=>D1(e) ? e : e < .5 ? .5 * Math.pow(2, 10 * (e * 2 - 1)) : .5 * (-Math.pow(2, -10 * (e * 2 - 1)) + 2),
    easeInCirc: (e)=>e >= 1 ? e : -(Math.sqrt(1 - e * e) - 1),
    easeOutCirc: (e)=>Math.sqrt(1 - (e -= 1) * e),
    easeInOutCirc: (e)=>(e /= .5) < 1 ? -.5 * (Math.sqrt(1 - e * e) - 1) : .5 * (Math.sqrt(1 - (e -= 2) * e) + 1),
    easeInElastic: (e)=>D1(e) ? e : ie(e, .075, .3),
    easeOutElastic: (e)=>D1(e) ? e : se(e, .075, .3),
    easeInOutElastic (e) {
        return D1(e) ? e : e < .5 ? .5 * ie(e * 2, .1125, .45) : .5 + .5 * se(e * 2 - 1, .1125, .45);
    },
    easeInBack (e) {
        return e * e * ((1.70158 + 1) * e - 1.70158);
    },
    easeOutBack (e) {
        return (e -= 1) * e * ((1.70158 + 1) * e + 1.70158) + 1;
    },
    easeInOutBack (e) {
        let t = 1.70158;
        return (e /= .5) < 1 ? .5 * (e * e * (((t *= 1.525) + 1) * e - t)) : .5 * ((e -= 2) * e * (((t *= 1.525) + 1) * e + t) + 2);
    },
    easeInBounce: (e)=>1 - G1.easeOutBounce(1 - e),
    easeOutBounce (e) {
        return e < 1 / 2.75 ? 7.5625 * e * e : e < 2 / 2.75 ? 7.5625 * (e -= 1.5 / 2.75) * e + .75 : e < 2.5 / 2.75 ? 7.5625 * (e -= 2.25 / 2.75) * e + .9375 : 7.5625 * (e -= 2.625 / 2.75) * e + .984375;
    },
    easeInOutBounce: (e)=>e < .5 ? G1.easeInBounce(e * 2) * .5 : G1.easeOutBounce(e * 2 - 1) * .5 + .5
};
function we(e) {
    if (e && typeof e == "object") {
        let t = e.toString();
        return t === "[object CanvasPattern]" || t === "[object CanvasGradient]";
    }
    return !1;
}
function $1(e) {
    return we(e) ? e : new k(e).saturate(.5).darken(.1).hexString();
}
var Ue = [
    "x",
    "y",
    "borderWidth",
    "radius",
    "tension"
], Ye = [
    "color",
    "borderColor",
    "backgroundColor"
];
function Je(e) {
    e.set("animation", {
        delay: void 0,
        duration: 1e3,
        easing: "easeOutQuart",
        fn: void 0,
        from: void 0,
        loop: void 0,
        to: void 0,
        type: void 0
    }), e.describe("animation", {
        _fallback: !1,
        _indexable: !1,
        _scriptable: (t)=>t !== "onProgress" && t !== "onComplete" && t !== "fn"
    }), e.set("animations", {
        colors: {
            type: "color",
            properties: Ye
        },
        numbers: {
            type: "number",
            properties: Ue
        }
    }), e.describe("animations", {
        _fallback: "animation"
    }), e.set("transitions", {
        active: {
            animation: {
                duration: 400
            }
        },
        resize: {
            animation: {
                duration: 0
            }
        },
        show: {
            animations: {
                colors: {
                    from: "transparent"
                },
                visible: {
                    type: "boolean",
                    duration: 0
                }
            }
        },
        hide: {
            animations: {
                colors: {
                    to: "transparent"
                },
                visible: {
                    type: "boolean",
                    easing: "linear",
                    fn: (t)=>t | 0
                }
            }
        }
    });
}
function Xe(e) {
    e.set("layout", {
        autoPadding: !0,
        padding: {
            top: 0,
            right: 0,
            bottom: 0,
            left: 0
        }
    });
}
var ae = new Map;
function Ze(e, t) {
    t = t || {};
    let n = e + JSON.stringify(t), o = ae.get(n);
    return o || (o = new Intl.NumberFormat(e, t), ae.set(n, o)), o;
}
function Ve(e, t, n) {
    return Ze(t, n).format(e);
}
var Pe = {
    values (e) {
        return M1(e) ? e : "" + e;
    },
    numeric (e, t, n) {
        if (e === 0) return "0";
        let o = this.chart.options.locale, r, i = e;
        if (n.length > 1) {
            let l = Math.max(Math.abs(n[0].value), Math.abs(n[n.length - 1].value));
            (l < 1e-4 || l > 1e15) && (r = "scientific"), i = et(e, n);
        }
        let s = Y1(Math.abs(i)), a = Math.max(Math.min(-1 * Math.floor(s), 20), 0), c = {
            notation: r,
            minimumFractionDigits: a,
            maximumFractionDigits: a
        };
        return Object.assign(c, this.options.ticks.format), Ve(e, o, c);
    },
    logarithmic (e, t, n) {
        if (e === 0) return "0";
        let o = n[t].significand || e / Math.pow(10, Math.floor(Y1(e)));
        return [
            1,
            2,
            3,
            5,
            10,
            15
        ].includes(o) || t > .8 * n.length ? Pe.numeric.call(this, e, t, n) : "";
    }
};
function et(e, t) {
    let n = t.length > 3 ? t[2].value - t[1].value : t[1].value - t[0].value;
    return Math.abs(n) >= 1 && e !== Math.floor(e) && (n = e - Math.floor(e)), n;
}
var tt = {
    formatters: Pe
};
function nt(e) {
    e.set("scale", {
        display: !0,
        offset: !1,
        reverse: !1,
        beginAtZero: !1,
        bounds: "ticks",
        grace: 0,
        grid: {
            display: !0,
            lineWidth: 1,
            drawOnChartArea: !0,
            drawTicks: !0,
            tickLength: 8,
            tickWidth: (t, n)=>n.lineWidth,
            tickColor: (t, n)=>n.color,
            offset: !1
        },
        border: {
            display: !0,
            dash: [],
            dashOffset: 0,
            width: 1
        },
        title: {
            display: !1,
            text: "",
            padding: {
                top: 4,
                bottom: 4
            }
        },
        ticks: {
            minRotation: 0,
            maxRotation: 50,
            mirror: !1,
            textStrokeWidth: 0,
            textStrokeColor: "",
            padding: 3,
            display: !0,
            autoSkip: !0,
            autoSkipPadding: 3,
            labelOffset: 0,
            callback: tt.formatters.values,
            minor: {},
            major: {},
            align: "center",
            crossAlign: "near",
            showLabelBackdrop: !1,
            backdropColor: "rgba(255, 255, 255, 0.75)",
            backdropPadding: 2
        }
    }), e.route("scale.ticks", "color", "", "color"), e.route("scale.grid", "color", "", "borderColor"), e.route("scale.border", "color", "", "borderColor"), e.route("scale.title", "color", "", "color"), e.describe("scale", {
        _fallback: !1,
        _scriptable: (t)=>!t.startsWith("before") && !t.startsWith("after") && t !== "callback" && t !== "parser",
        _indexable: (t)=>t !== "borderDash" && t !== "tickBorderDash" && t !== "dash"
    }), e.describe("scales", {
        _fallback: "scale"
    }), e.describe("scale.ticks", {
        _scriptable: (t)=>t !== "backdropPadding" && t !== "callback",
        _indexable: (t)=>t !== "backdropPadding"
    });
}
var ot = Object.create(null), rt = Object.create(null);
function B1(e, t) {
    if (!t) return e;
    let n = t.split(".");
    for(let o = 0, r = n.length; o < r; ++o){
        let i = n[o];
        e = e[i] || (e[i] = Object.create(null));
    }
    return e;
}
function U1(e, t, n) {
    return typeof t == "string" ? F1(B1(e, t), n) : F1(B1(e, ""), t);
}
var X1 = class {
    constructor(t, n){
        this.animation = void 0, this.backgroundColor = "rgba(0,0,0,0.1)", this.borderColor = "rgba(0,0,0,0.1)", this.color = "#666", this.datasets = {}, this.devicePixelRatio = (o)=>o.chart.platform.getDevicePixelRatio(), this.elements = {}, this.events = [
            "mousemove",
            "mouseout",
            "click",
            "touchstart",
            "touchmove"
        ], this.font = {
            family: "'Helvetica Neue', 'Helvetica', 'Arial', sans-serif",
            size: 12,
            style: "normal",
            lineHeight: 1.2,
            weight: null
        }, this.hover = {}, this.hoverBackgroundColor = (o, r)=>$1(r.backgroundColor), this.hoverBorderColor = (o, r)=>$1(r.borderColor), this.hoverColor = (o, r)=>$1(r.color), this.indexAxis = "x", this.interaction = {
            mode: "nearest",
            intersect: !0,
            includeInvisible: !1
        }, this.maintainAspectRatio = !0, this.onHover = null, this.onClick = null, this.parsing = !0, this.plugins = {}, this.responsive = !0, this.scale = void 0, this.scales = {}, this.showLine = !0, this.drawActiveElementsOnTop = !0, this.describe(t), this.apply(n);
    }
    set(t, n) {
        return U1(this, t, n);
    }
    get(t) {
        return B1(this, t);
    }
    describe(t, n) {
        return U1(rt, t, n);
    }
    override(t, n) {
        return U1(ot, t, n);
    }
    route(t, n, o, r) {
        let i = B1(this, t), s = B1(this, o), a = "_" + n;
        Object.defineProperties(i, {
            [a]: {
                value: i[n],
                writable: !0
            },
            [n]: {
                enumerable: !0,
                get () {
                    let c = this[a], l = s[r];
                    return _1(c) ? Object.assign({}, l, c) : T1(c, l);
                },
                set (c) {
                    this[a] = c;
                }
            }
        });
    }
    apply(t) {
        t.forEach((n)=>n(this));
    }
}, it = new X1({
    _scriptable: (e)=>!e.startsWith("on"),
    _indexable: (e)=>e !== "events",
    hover: {
        _fallback: "interaction"
    },
    interaction: {
        _scriptable: !1,
        _indexable: !1
    }
}, [
    Je,
    Xe,
    nt
]);
Number.EPSILON || 1e-14;
(function() {
    let e = !1;
    try {
        let t = {
            get passive () {
                return e = !0, !1;
            }
        };
        window.addEventListener("test", null, t), window.removeEventListener("test", null, t);
    } catch  {}
    return e;
})();
[
    ..."0123456789ABCDEF"
];
function rt1() {}
var Ss = (()=>{
    let i = 0;
    return ()=>i++;
})();
function A1(i) {
    return i === null || typeof i > "u";
}
function I1(i) {
    if (Array.isArray && Array.isArray(i)) return !0;
    let t = Object.prototype.toString.call(i);
    return t.slice(0, 7) === "[object" && t.slice(-6) === "Array]";
}
function O2(i) {
    return i !== null && Object.prototype.toString.call(i) === "[object Object]";
}
function N2(i) {
    return (typeof i == "number" || i instanceof Number) && isFinite(+i);
}
function J1(i, t) {
    return N2(i) ? i : t;
}
function P1(i, t) {
    return typeof i > "u" ? t : i;
}
var Ps = (i, t)=>typeof i == "string" && i.endsWith("%") ? parseFloat(i) / 100 : +i / t, si = (i, t)=>typeof i == "string" && i.endsWith("%") ? parseFloat(i) / 100 * t : +i;
function E1(i, t, e) {
    if (i && typeof i.call == "function") return i.apply(e, t);
}
function T2(i, t, e, s) {
    let n, o, a;
    if (I1(i)) if (o = i.length, s) for(n = o - 1; n >= 0; n--)t.call(e, i[n], n);
    else for(n = 0; n < o; n++)t.call(e, i[n], n);
    else if (O2(i)) for(a = Object.keys(i), o = a.length, n = 0; n < o; n++)t.call(e, i[a[n]], a[n]);
}
function ie1(i, t) {
    let e, s, n, o;
    if (!i || !t || i.length !== t.length) return !1;
    for(e = 0, s = i.length; e < s; ++e)if (n = i[e], o = t[e], n.datasetIndex !== o.datasetIndex || n.index !== o.index) return !1;
    return !0;
}
function Me(i) {
    if (I1(i)) return i.map(Me);
    if (O2(i)) {
        let t = Object.create(null), e = Object.keys(i), s = e.length, n = 0;
        for(; n < s; ++n)t[e[n]] = Me(i[e[n]]);
        return t;
    }
    return i;
}
function Cs(i) {
    return [
        "__proto__",
        "prototype",
        "constructor"
    ].indexOf(i) === -1;
}
function xo(i, t, e, s) {
    if (!Cs(i)) return;
    let n = t[i], o = e[i];
    O2(n) && O2(o) ? zt(n, o, s) : t[i] = Me(o);
}
function zt(i, t, e) {
    let s = I1(t) ? t : [
        t
    ], n = s.length;
    if (!O2(i)) return i;
    e = e || {};
    let o = e.merger || xo, a;
    for(let r = 0; r < n; ++r){
        if (a = s[r], !O2(a)) continue;
        let l = Object.keys(a);
        for(let c = 0, h = l.length; c < h; ++c)o(l[c], i, a, e);
    }
    return i;
}
function Vt(i, t) {
    return zt(i, t, {
        merger: yo
    });
}
function yo(i, t, e) {
    if (!Cs(i)) return;
    let s = t[i], n = e[i];
    O2(s) && O2(n) ? Vt(s, n) : Object.prototype.hasOwnProperty.call(t, i) || (t[i] = Me(n));
}
var gs = {
    "": (i)=>i,
    x: (i)=>i.x,
    y: (i)=>i.y
};
function vo(i) {
    let t = i.split("."), e = [], s = "";
    for (let n of t)s += n, s.endsWith("\\") ? s = s.slice(0, -1) + "." : (e.push(s), s = "");
    return e;
}
function Mo(i) {
    let t = vo(i);
    return (e)=>{
        for (let s of t){
            if (s === "") break;
            e = e && e[s];
        }
        return e;
    };
}
function gt(i, t) {
    return (gs[t] || (gs[t] = Mo(t)))(i);
}
function Pe1(i) {
    return i.charAt(0).toUpperCase() + i.slice(1);
}
var et1 = (i)=>typeof i < "u", ut = (i)=>typeof i == "function", ni = (i, t)=>{
    if (i.size !== t.size) return !1;
    for (let e of i)if (!t.has(e)) return !1;
    return !0;
};
function Ds(i) {
    return i.type === "mouseup" || i.type === "click" || i.type === "contextmenu";
}
var F2 = Math.PI, z1 = 2 * F2, ko = z1 + F2, ke = Number.POSITIVE_INFINITY, wo = F2 / 180, V1 = F2 / 2, St = F2 / 4, ps = F2 * 2 / 3, ft = Math.log10, nt1 = Math.sign;
function Nt(i, t, e) {
    return Math.abs(i - t) < e;
}
function oi(i) {
    let t = Math.round(i);
    i = Nt(i, t, i / 1e3) ? t : i;
    let e = Math.pow(10, Math.floor(ft(i))), s = i / e;
    return (s <= 1 ? 1 : s <= 2 ? 2 : s <= 5 ? 5 : 10) * e;
}
function Os(i) {
    let t = [], e = Math.sqrt(i), s;
    for(s = 1; s < e; s++)i % s === 0 && (t.push(s), t.push(i / s));
    return e === (e | 0) && t.push(e), t.sort((n, o)=>n - o).pop(), t;
}
function Dt(i) {
    return !isNaN(parseFloat(i)) && isFinite(i);
}
function As(i, t) {
    let e = Math.round(i);
    return e - t <= i && e + t >= i;
}
function ai(i, t, e) {
    let s, n, o;
    for(s = 0, n = i.length; s < n; s++)o = i[s][e], isNaN(o) || (t.min = Math.min(t.min, o), t.max = Math.max(t.max, o));
}
function it1(i) {
    return i * (F2 / 180);
}
function Ce(i) {
    return i * (180 / F2);
}
function ri(i) {
    if (!N2(i)) return;
    let t = 1, e = 0;
    for(; Math.round(i * t) / t !== i;)t *= 10, e++;
    return e;
}
function li(i, t) {
    let e = t.x - i.x, s = t.y - i.y, n = Math.sqrt(e * e + s * s), o = Math.atan2(s, e);
    return o < -.5 * F2 && (o += z1), {
        angle: o,
        distance: n
    };
}
function we1(i, t) {
    return Math.sqrt(Math.pow(t.x - i.x, 2) + Math.pow(t.y - i.y, 2));
}
function So(i, t) {
    return (i - t + ko) % z1 - F2;
}
function G2(i) {
    return (i % z1 + z1) % z1;
}
function Wt(i, t, e, s) {
    let n = G2(i), o = G2(t), a = G2(e), r = G2(o - n), l = G2(a - n), c = G2(n - o), h = G2(n - a);
    return n === o || n === a || s && o === a || r > l && c < h;
}
function $2(i, t, e) {
    return Math.max(t, Math.min(e, i));
}
function Ls(i) {
    return $2(i, -32768, 32767);
}
function lt(i, t, e, s = 1e-6) {
    return i >= Math.min(t, e) - s && i <= Math.max(t, e) + s;
}
function De(i, t, e) {
    e = e || ((a)=>i[a] < t);
    let s = i.length - 1, n = 0, o;
    for(; s - n > 1;)o = n + s >> 1, e(o) ? n = o : s = o;
    return {
        lo: n,
        hi: s
    };
}
var at = (i, t, e, s)=>De(i, e, s ? (n)=>{
        let o = i[n][t];
        return o < e || o === e && i[n + 1][t] === e;
    } : (n)=>i[n][t] < e), Ts = (i, t, e)=>De(i, e, (s)=>i[s][t] >= e);
function Rs(i, t, e) {
    let s = 0, n = i.length;
    for(; s < n && i[s] < t;)s++;
    for(; n > s && i[n - 1] > e;)n--;
    return s > 0 || n < i.length ? i.slice(s, n) : i;
}
var Es = [
    "push",
    "pop",
    "shift",
    "splice",
    "unshift"
];
function Is(i, t) {
    if (i._chartjs) {
        i._chartjs.listeners.push(t);
        return;
    }
    Object.defineProperty(i, "_chartjs", {
        configurable: !0,
        enumerable: !1,
        value: {
            listeners: [
                t
            ]
        }
    }), Es.forEach((e)=>{
        let s = "_onData" + Pe1(e), n = i[e];
        Object.defineProperty(i, e, {
            configurable: !0,
            enumerable: !1,
            value (...o) {
                let a = n.apply(this, o);
                return i._chartjs.listeners.forEach((r)=>{
                    typeof r[s] == "function" && r[s](...o);
                }), a;
            }
        });
    });
}
function ci(i, t) {
    let e = i._chartjs;
    if (!e) return;
    let s = e.listeners, n = s.indexOf(t);
    n !== -1 && s.splice(n, 1), !(s.length > 0) && (Es.forEach((o)=>{
        delete i[o];
    }), delete i._chartjs);
}
function hi(i) {
    let t = new Set, e, s;
    for(e = 0, s = i.length; e < s; ++e)t.add(i[e]);
    return t.size === s ? i : Array.from(t);
}
var di = function() {
    return typeof window > "u" ? function(i) {
        return i();
    } : window.requestAnimationFrame;
}();
function ui(i, t) {
    let e = [], s = !1;
    return function(...n) {
        e = n, s || (s = !0, di.call(window, ()=>{
            s = !1, i.apply(t, e);
        }));
    };
}
function zs(i, t) {
    let e;
    return function(...s) {
        return t ? (clearTimeout(e), e = setTimeout(i, t, s)) : i.apply(this, s), t;
    };
}
var Oe = (i)=>i === "start" ? "left" : i === "end" ? "right" : "center", Y2 = (i, t, e)=>i === "start" ? t : i === "end" ? e : (t + e) / 2, Fs = (i, t, e, s)=>i === (s ? "left" : "right") ? e : i === "center" ? (t + e) / 2 : t;
function fi(i, t, e) {
    let s = t.length, n = 0, o = s;
    if (i._sorted) {
        let { iScale: a, _parsed: r } = i, l = a.axis, { min: c, max: h, minDefined: d, maxDefined: u } = a.getUserBounds();
        d && (n = $2(Math.min(at(r, a.axis, c).lo, e ? s : at(t, l, a.getPixelForValue(c)).lo), 0, s - 1)), u ? o = $2(Math.max(at(r, a.axis, h, !0).hi + 1, e ? 0 : at(t, l, a.getPixelForValue(h), !0).hi + 1), n, s) - n : o = s - n;
    }
    return {
        start: n,
        count: o
    };
}
function gi(i) {
    let { xScale: t, yScale: e, _scaleRanges: s } = i, n = {
        xmin: t.min,
        xmax: t.max,
        ymin: e.min,
        ymax: e.max
    };
    if (!s) return i._scaleRanges = n, !0;
    let o = s.xmin !== t.min || s.xmax !== t.max || s.ymin !== e.min || s.ymax !== e.max;
    return Object.assign(s, n), o;
}
var xe = (i)=>i === 0 || i === 1, ms = (i, t, e)=>-(Math.pow(2, 10 * (i -= 1)) * Math.sin((i - t) * z1 / e)), bs = (i, t, e)=>Math.pow(2, -10 * i) * Math.sin((i - t) * z1 / e) + 1, It = {
    linear: (i)=>i,
    easeInQuad: (i)=>i * i,
    easeOutQuad: (i)=>-i * (i - 2),
    easeInOutQuad: (i)=>(i /= .5) < 1 ? .5 * i * i : -.5 * (--i * (i - 2) - 1),
    easeInCubic: (i)=>i * i * i,
    easeOutCubic: (i)=>(i -= 1) * i * i + 1,
    easeInOutCubic: (i)=>(i /= .5) < 1 ? .5 * i * i * i : .5 * ((i -= 2) * i * i + 2),
    easeInQuart: (i)=>i * i * i * i,
    easeOutQuart: (i)=>-((i -= 1) * i * i * i - 1),
    easeInOutQuart: (i)=>(i /= .5) < 1 ? .5 * i * i * i * i : -.5 * ((i -= 2) * i * i * i - 2),
    easeInQuint: (i)=>i * i * i * i * i,
    easeOutQuint: (i)=>(i -= 1) * i * i * i * i + 1,
    easeInOutQuint: (i)=>(i /= .5) < 1 ? .5 * i * i * i * i * i : .5 * ((i -= 2) * i * i * i * i + 2),
    easeInSine: (i)=>-Math.cos(i * V1) + 1,
    easeOutSine: (i)=>Math.sin(i * V1),
    easeInOutSine: (i)=>-.5 * (Math.cos(F2 * i) - 1),
    easeInExpo: (i)=>i === 0 ? 0 : Math.pow(2, 10 * (i - 1)),
    easeOutExpo: (i)=>i === 1 ? 1 : -Math.pow(2, -10 * i) + 1,
    easeInOutExpo: (i)=>xe(i) ? i : i < .5 ? .5 * Math.pow(2, 10 * (i * 2 - 1)) : .5 * (-Math.pow(2, -10 * (i * 2 - 1)) + 2),
    easeInCirc: (i)=>i >= 1 ? i : -(Math.sqrt(1 - i * i) - 1),
    easeOutCirc: (i)=>Math.sqrt(1 - (i -= 1) * i),
    easeInOutCirc: (i)=>(i /= .5) < 1 ? -.5 * (Math.sqrt(1 - i * i) - 1) : .5 * (Math.sqrt(1 - (i -= 2) * i) + 1),
    easeInElastic: (i)=>xe(i) ? i : ms(i, .075, .3),
    easeOutElastic: (i)=>xe(i) ? i : bs(i, .075, .3),
    easeInOutElastic (i) {
        return xe(i) ? i : i < .5 ? .5 * ms(i * 2, .1125, .45) : .5 + .5 * bs(i * 2 - 1, .1125, .45);
    },
    easeInBack (i) {
        return i * i * ((1.70158 + 1) * i - 1.70158);
    },
    easeOutBack (i) {
        return (i -= 1) * i * ((1.70158 + 1) * i + 1.70158) + 1;
    },
    easeInOutBack (i) {
        let t = 1.70158;
        return (i /= .5) < 1 ? .5 * (i * i * (((t *= 1.525) + 1) * i - t)) : .5 * ((i -= 2) * i * (((t *= 1.525) + 1) * i + t) + 2);
    },
    easeInBounce: (i)=>1 - It.easeOutBounce(1 - i),
    easeOutBounce (i) {
        return i < 1 / 2.75 ? 7.5625 * i * i : i < 2 / 2.75 ? 7.5625 * (i -= 1.5 / 2.75) * i + .75 : i < 2.5 / 2.75 ? 7.5625 * (i -= 2.25 / 2.75) * i + .9375 : 7.5625 * (i -= 2.625 / 2.75) * i + .984375;
    },
    easeInOutBounce: (i)=>i < .5 ? It.easeInBounce(i * 2) * .5 : It.easeOutBounce(i * 2 - 1) * .5 + .5
};
function Bs(i) {
    if (i && typeof i == "object") {
        let t = i.toString();
        return t === "[object CanvasPattern]" || t === "[object CanvasGradient]";
    }
    return !1;
}
function pi(i) {
    return Bs(i) ? i : new k(i);
}
function ti(i) {
    return Bs(i) ? i : new k(i).saturate(.5).darken(.1).hexString();
}
var Po = [
    "x",
    "y",
    "borderWidth",
    "radius",
    "tension"
], Co = [
    "color",
    "borderColor",
    "backgroundColor"
];
function Do(i) {
    i.set("animation", {
        delay: void 0,
        duration: 1e3,
        easing: "easeOutQuart",
        fn: void 0,
        from: void 0,
        loop: void 0,
        to: void 0,
        type: void 0
    }), i.describe("animation", {
        _fallback: !1,
        _indexable: !1,
        _scriptable: (t)=>t !== "onProgress" && t !== "onComplete" && t !== "fn"
    }), i.set("animations", {
        colors: {
            type: "color",
            properties: Co
        },
        numbers: {
            type: "number",
            properties: Po
        }
    }), i.describe("animations", {
        _fallback: "animation"
    }), i.set("transitions", {
        active: {
            animation: {
                duration: 400
            }
        },
        resize: {
            animation: {
                duration: 0
            }
        },
        show: {
            animations: {
                colors: {
                    from: "transparent"
                },
                visible: {
                    type: "boolean",
                    duration: 0
                }
            }
        },
        hide: {
            animations: {
                colors: {
                    to: "transparent"
                },
                visible: {
                    type: "boolean",
                    easing: "linear",
                    fn: (t)=>t | 0
                }
            }
        }
    });
}
function Oo(i) {
    i.set("layout", {
        autoPadding: !0,
        padding: {
            top: 0,
            right: 0,
            bottom: 0,
            left: 0
        }
    });
}
var _s = new Map;
function Ao(i, t) {
    t = t || {};
    let e = i + JSON.stringify(t), s = _s.get(e);
    return s || (s = new Intl.NumberFormat(i, t), _s.set(e, s)), s;
}
function Ht(i, t, e) {
    return Ao(t, e).format(i);
}
var Vs = {
    values (i) {
        return I1(i) ? i : "" + i;
    },
    numeric (i, t, e) {
        if (i === 0) return "0";
        let s = this.chart.options.locale, n, o = i;
        if (e.length > 1) {
            let c = Math.max(Math.abs(e[0].value), Math.abs(e[e.length - 1].value));
            (c < 1e-4 || c > 1e15) && (n = "scientific"), o = Lo(i, e);
        }
        let a = ft(Math.abs(o)), r = Math.max(Math.min(-1 * Math.floor(a), 20), 0), l = {
            notation: n,
            minimumFractionDigits: r,
            maximumFractionDigits: r
        };
        return Object.assign(l, this.options.ticks.format), Ht(i, s, l);
    },
    logarithmic (i, t, e) {
        if (i === 0) return "0";
        let s = e[t].significand || i / Math.pow(10, Math.floor(ft(i)));
        return [
            1,
            2,
            3,
            5,
            10,
            15
        ].includes(s) || t > .8 * e.length ? Vs.numeric.call(this, i, t, e) : "";
    }
};
function Lo(i, t) {
    let e = t.length > 3 ? t[2].value - t[1].value : t[1].value - t[0].value;
    return Math.abs(e) >= 1 && i !== Math.floor(i) && (e = i - Math.floor(i)), e;
}
var jt = {
    formatters: Vs
};
function To(i) {
    i.set("scale", {
        display: !0,
        offset: !1,
        reverse: !1,
        beginAtZero: !1,
        bounds: "ticks",
        grace: 0,
        grid: {
            display: !0,
            lineWidth: 1,
            drawOnChartArea: !0,
            drawTicks: !0,
            tickLength: 8,
            tickWidth: (t, e)=>e.lineWidth,
            tickColor: (t, e)=>e.color,
            offset: !1
        },
        border: {
            display: !0,
            dash: [],
            dashOffset: 0,
            width: 1
        },
        title: {
            display: !1,
            text: "",
            padding: {
                top: 4,
                bottom: 4
            }
        },
        ticks: {
            minRotation: 0,
            maxRotation: 50,
            mirror: !1,
            textStrokeWidth: 0,
            textStrokeColor: "",
            padding: 3,
            display: !0,
            autoSkip: !0,
            autoSkipPadding: 3,
            labelOffset: 0,
            callback: jt.formatters.values,
            minor: {},
            major: {},
            align: "center",
            crossAlign: "near",
            showLabelBackdrop: !1,
            backdropColor: "rgba(255, 255, 255, 0.75)",
            backdropPadding: 2
        }
    }), i.route("scale.ticks", "color", "", "color"), i.route("scale.grid", "color", "", "borderColor"), i.route("scale.border", "color", "", "borderColor"), i.route("scale.title", "color", "", "color"), i.describe("scale", {
        _fallback: !1,
        _scriptable: (t)=>!t.startsWith("before") && !t.startsWith("after") && t !== "callback" && t !== "parser",
        _indexable: (t)=>t !== "borderDash" && t !== "tickBorderDash" && t !== "dash"
    }), i.describe("scales", {
        _fallback: "scale"
    }), i.describe("scale.ticks", {
        _scriptable: (t)=>t !== "backdropPadding" && t !== "callback",
        _indexable: (t)=>t !== "backdropPadding"
    });
}
var xt = Object.create(null), Ae = Object.create(null);
function te(i, t) {
    if (!t) return i;
    let e = t.split(".");
    for(let s = 0, n = e.length; s < n; ++s){
        let o = e[s];
        i = i[o] || (i[o] = Object.create(null));
    }
    return i;
}
function ei(i, t, e) {
    return typeof t == "string" ? zt(te(i, t), e) : zt(te(i, ""), t);
}
var ii = class {
    constructor(t, e){
        this.animation = void 0, this.backgroundColor = "rgba(0,0,0,0.1)", this.borderColor = "rgba(0,0,0,0.1)", this.color = "#666", this.datasets = {}, this.devicePixelRatio = (s)=>s.chart.platform.getDevicePixelRatio(), this.elements = {}, this.events = [
            "mousemove",
            "mouseout",
            "click",
            "touchstart",
            "touchmove"
        ], this.font = {
            family: "'Helvetica Neue', 'Helvetica', 'Arial', sans-serif",
            size: 12,
            style: "normal",
            lineHeight: 1.2,
            weight: null
        }, this.hover = {}, this.hoverBackgroundColor = (s, n)=>ti(n.backgroundColor), this.hoverBorderColor = (s, n)=>ti(n.borderColor), this.hoverColor = (s, n)=>ti(n.color), this.indexAxis = "x", this.interaction = {
            mode: "nearest",
            intersect: !0,
            includeInvisible: !1
        }, this.maintainAspectRatio = !0, this.onHover = null, this.onClick = null, this.parsing = !0, this.plugins = {}, this.responsive = !0, this.scale = void 0, this.scales = {}, this.showLine = !0, this.drawActiveElementsOnTop = !0, this.describe(t), this.apply(e);
    }
    set(t, e) {
        return ei(this, t, e);
    }
    get(t) {
        return te(this, t);
    }
    describe(t, e) {
        return ei(Ae, t, e);
    }
    override(t, e) {
        return ei(xt, t, e);
    }
    route(t, e, s, n) {
        let o = te(this, t), a = te(this, s), r = "_" + e;
        Object.defineProperties(o, {
            [r]: {
                value: o[e],
                writable: !0
            },
            [e]: {
                enumerable: !0,
                get () {
                    let l = this[r], c = a[n];
                    return O2(l) ? Object.assign({}, c, l) : P1(l, c);
                },
                set (l) {
                    this[r] = l;
                }
            }
        });
    }
    apply(t) {
        t.forEach((e)=>e(this));
    }
}, W1 = new ii({
    _scriptable: (i)=>!i.startsWith("on"),
    _indexable: (i)=>i !== "events",
    hover: {
        _fallback: "interaction"
    },
    interaction: {
        _scriptable: !1,
        _indexable: !1
    }
}, [
    Do,
    Oo,
    To
]);
function Ro(i) {
    return !i || A1(i.size) || A1(i.family) ? null : (i.style ? i.style + " " : "") + (i.weight ? i.weight + " " : "") + i.size + "px " + i.family;
}
function ee1(i, t, e, s, n) {
    let o = t[n];
    return o || (o = t[n] = i.measureText(n).width, e.push(n)), o > s && (s = o), s;
}
function Ns(i, t, e, s) {
    s = s || {};
    let n = s.data = s.data || {}, o = s.garbageCollect = s.garbageCollect || [];
    s.font !== t && (n = s.data = {}, o = s.garbageCollect = [], s.font = t), i.save(), i.font = t;
    let a = 0, r = e.length, l, c, h, d, u;
    for(l = 0; l < r; l++)if (d = e[l], d != null && I1(d) !== !0) a = ee1(i, n, o, a, d);
    else if (I1(d)) for(c = 0, h = d.length; c < h; c++)u = d[c], u != null && !I1(u) && (a = ee1(i, n, o, a, u));
    i.restore();
    let f = o.length / 2;
    if (f > e.length) {
        for(l = 0; l < f; l++)delete n[o[l]];
        o.splice(0, f);
    }
    return a;
}
function yt(i, t, e) {
    let s = i.currentDevicePixelRatio, n = e !== 0 ? Math.max(e / 2, .5) : 0;
    return Math.round((t - n) * s) / s + n;
}
function mi(i, t) {
    t = t || i.getContext("2d"), t.save(), t.resetTransform(), t.clearRect(0, 0, i.width, i.height), t.restore();
}
function Le1(i, t, e, s) {
    bi(i, t, e, s, null);
}
function bi(i, t, e, s, n) {
    let o, a, r, l, c, h, d, u, f = t.pointStyle, p = t.rotation, g = t.radius, m = (p || 0) * wo;
    if (f && typeof f == "object" && (o = f.toString(), o === "[object HTMLImageElement]" || o === "[object HTMLCanvasElement]")) {
        i.save(), i.translate(e, s), i.rotate(m), i.drawImage(f, -f.width / 2, -f.height / 2, f.width, f.height), i.restore();
        return;
    }
    if (!(isNaN(g) || g <= 0)) {
        switch(i.beginPath(), f){
            default:
                n ? i.ellipse(e, s, n / 2, g, 0, 0, z1) : i.arc(e, s, g, 0, z1), i.closePath();
                break;
            case "triangle":
                h = n ? n / 2 : g, i.moveTo(e + Math.sin(m) * h, s - Math.cos(m) * g), m += ps, i.lineTo(e + Math.sin(m) * h, s - Math.cos(m) * g), m += ps, i.lineTo(e + Math.sin(m) * h, s - Math.cos(m) * g), i.closePath();
                break;
            case "rectRounded":
                c = g * .516, l = g - c, a = Math.cos(m + St) * l, d = Math.cos(m + St) * (n ? n / 2 - c : l), r = Math.sin(m + St) * l, u = Math.sin(m + St) * (n ? n / 2 - c : l), i.arc(e - d, s - r, c, m - F2, m - V1), i.arc(e + u, s - a, c, m - V1, m), i.arc(e + d, s + r, c, m, m + V1), i.arc(e - u, s + a, c, m + V1, m + F2), i.closePath();
                break;
            case "rect":
                if (!p) {
                    l = Math.SQRT1_2 * g, h = n ? n / 2 : l, i.rect(e - h, s - l, 2 * h, 2 * l);
                    break;
                }
                m += St;
            case "rectRot":
                d = Math.cos(m) * (n ? n / 2 : g), a = Math.cos(m) * g, r = Math.sin(m) * g, u = Math.sin(m) * (n ? n / 2 : g), i.moveTo(e - d, s - r), i.lineTo(e + u, s - a), i.lineTo(e + d, s + r), i.lineTo(e - u, s + a), i.closePath();
                break;
            case "crossRot":
                m += St;
            case "cross":
                d = Math.cos(m) * (n ? n / 2 : g), a = Math.cos(m) * g, r = Math.sin(m) * g, u = Math.sin(m) * (n ? n / 2 : g), i.moveTo(e - d, s - r), i.lineTo(e + d, s + r), i.moveTo(e + u, s - a), i.lineTo(e - u, s + a);
                break;
            case "star":
                d = Math.cos(m) * (n ? n / 2 : g), a = Math.cos(m) * g, r = Math.sin(m) * g, u = Math.sin(m) * (n ? n / 2 : g), i.moveTo(e - d, s - r), i.lineTo(e + d, s + r), i.moveTo(e + u, s - a), i.lineTo(e - u, s + a), m += St, d = Math.cos(m) * (n ? n / 2 : g), a = Math.cos(m) * g, r = Math.sin(m) * g, u = Math.sin(m) * (n ? n / 2 : g), i.moveTo(e - d, s - r), i.lineTo(e + d, s + r), i.moveTo(e + u, s - a), i.lineTo(e - u, s + a);
                break;
            case "line":
                a = n ? n / 2 : Math.cos(m) * g, r = Math.sin(m) * g, i.moveTo(e - a, s - r), i.lineTo(e + a, s + r);
                break;
            case "dash":
                i.moveTo(e, s), i.lineTo(e + Math.cos(m) * (n ? n / 2 : g), s + Math.sin(m) * g);
                break;
            case !1:
                i.closePath();
                break;
        }
        i.fill(), t.borderWidth > 0 && i.stroke();
    }
}
function Ft(i, t, e) {
    return e = e || .5, !t || i && i.x > t.left - e && i.x < t.right + e && i.y > t.top - e && i.y < t.bottom + e;
}
function se1(i, t) {
    i.save(), i.beginPath(), i.rect(t.left, t.top, t.right - t.left, t.bottom - t.top), i.clip();
}
function ne1(i) {
    i.restore();
}
function Ws(i, t, e, s, n) {
    if (!t) return i.lineTo(e.x, e.y);
    if (n === "middle") {
        let o = (t.x + e.x) / 2;
        i.lineTo(o, t.y), i.lineTo(o, e.y);
    } else n === "after" != !!s ? i.lineTo(t.x, e.y) : i.lineTo(e.x, t.y);
    i.lineTo(e.x, e.y);
}
function Hs(i, t, e, s) {
    if (!t) return i.lineTo(e.x, e.y);
    i.bezierCurveTo(s ? t.cp1x : t.cp2x, s ? t.cp1y : t.cp2y, s ? e.cp2x : e.cp1x, s ? e.cp2y : e.cp1y, e.x, e.y);
}
function vt(i, t, e, s, n, o = {}) {
    let a = I1(t) ? t : [
        t
    ], r = o.strokeWidth > 0 && o.strokeColor !== "", l, c;
    for(i.save(), i.font = n.string, Eo(i, o), l = 0; l < a.length; ++l)c = a[l], o.backdrop && zo(i, o.backdrop), r && (o.strokeColor && (i.strokeStyle = o.strokeColor), A1(o.strokeWidth) || (i.lineWidth = o.strokeWidth), i.strokeText(c, e, s, o.maxWidth)), i.fillText(c, e, s, o.maxWidth), Io(i, e, s, c, o), s += n.lineHeight;
    i.restore();
}
function Eo(i, t) {
    t.translation && i.translate(t.translation[0], t.translation[1]), A1(t.rotation) || i.rotate(t.rotation), t.color && (i.fillStyle = t.color), t.textAlign && (i.textAlign = t.textAlign), t.textBaseline && (i.textBaseline = t.textBaseline);
}
function Io(i, t, e, s, n) {
    if (n.strikethrough || n.underline) {
        let o = i.measureText(s), a = t - o.actualBoundingBoxLeft, r = t + o.actualBoundingBoxRight, l = e - o.actualBoundingBoxAscent, c = e + o.actualBoundingBoxDescent, h = n.strikethrough ? (l + c) / 2 : c;
        i.strokeStyle = i.fillStyle, i.beginPath(), i.lineWidth = n.decorationWidth || 2, i.moveTo(a, h), i.lineTo(r, h), i.stroke();
    }
}
function zo(i, t) {
    let e = i.fillStyle;
    i.fillStyle = t.color, i.fillRect(t.left, t.top, t.width, t.height), i.fillStyle = e;
}
function $t(i, t) {
    let { x: e, y: s, w: n, h: o, radius: a } = t;
    i.arc(e + a.topLeft, s + a.topLeft, a.topLeft, -V1, F2, !0), i.lineTo(e, s + o - a.bottomLeft), i.arc(e + a.bottomLeft, s + o - a.bottomLeft, a.bottomLeft, F2, V1, !0), i.lineTo(e + n - a.bottomRight, s + o), i.arc(e + n - a.bottomRight, s + o - a.bottomRight, a.bottomRight, V1, 0, !0), i.lineTo(e + n, s + a.topRight), i.arc(e + n - a.topRight, s + a.topRight, a.topRight, 0, -V1, !0), i.lineTo(e + a.topLeft, s);
}
var Fo = /^(normal|(\d+(?:\.\d+)?)(px|em|%)?)$/, Bo = /^(normal|italic|initial|inherit|unset|(oblique( -?[0-9]?[0-9]deg)?))$/;
function Vo(i, t) {
    let e = ("" + i).match(Fo);
    if (!e || e[1] === "normal") return t * 1.2;
    switch(i = +e[2], e[3]){
        case "px":
            return i;
        case "%":
            i /= 100;
            break;
    }
    return t * i;
}
var No = (i)=>+i || 0;
function Te(i, t) {
    let e = {}, s = O2(t), n = s ? Object.keys(t) : t, o = O2(i) ? s ? (a)=>P1(i[a], i[t[a]]) : (a)=>i[a] : ()=>i;
    for (let a of n)e[a] = No(o(a));
    return e;
}
function _i(i) {
    return Te(i, {
        top: "y",
        right: "x",
        bottom: "y",
        left: "x"
    });
}
function Mt(i) {
    return Te(i, [
        "topLeft",
        "topRight",
        "bottomLeft",
        "bottomRight"
    ]);
}
function X2(i) {
    let t = _i(i);
    return t.width = t.left + t.right, t.height = t.top + t.bottom, t;
}
function j1(i, t) {
    i = i || {}, t = t || W1.font;
    let e = P1(i.size, t.size);
    typeof e == "string" && (e = parseInt(e, 10));
    let s = P1(i.style, t.style);
    s && !("" + s).match(Bo) && (console.warn('Invalid font style specified: "' + s + '"'), s = void 0);
    let n = {
        family: P1(i.family, t.family),
        lineHeight: Vo(P1(i.lineHeight, t.lineHeight), e),
        size: e,
        style: s,
        weight: P1(i.weight, t.weight),
        string: ""
    };
    return n.string = Ro(n), n;
}
function Ut(i, t, e, s) {
    let n = !0, o, a, r;
    for(o = 0, a = i.length; o < a; ++o)if (r = i[o], r !== void 0 && (t !== void 0 && typeof r == "function" && (r = r(t), n = !1), e !== void 0 && I1(r) && (r = r[e % r.length], n = !1), r !== void 0)) return s && !n && (s.cacheable = !1), r;
}
function js(i, t, e) {
    let { min: s, max: n } = i, o = si(t, (n - s) / 2), a = (r, l)=>e && r === 0 ? 0 : r + l;
    return {
        min: a(s, -Math.abs(o)),
        max: a(n, o)
    };
}
function pt(i, t) {
    return Object.assign(Object.create(i), t);
}
function Re(i, t = [
    ""
], e = i, s, n = ()=>i[0]) {
    et1(s) || (s = Ys("_fallback", i));
    let o = {
        [Symbol.toStringTag]: "Object",
        _cacheable: !0,
        _scopes: i,
        _rootScopes: e,
        _fallback: s,
        _getTarget: n,
        override: (a)=>Re([
                a,
                ...i
            ], t, e, s)
    };
    return new Proxy(o, {
        deleteProperty (a, r) {
            return delete a[r], delete a._keys, delete i[0][r], !0;
        },
        get (a, r) {
            return $s(a, r, ()=>Ko(r, t, i, a));
        },
        getOwnPropertyDescriptor (a, r) {
            return Reflect.getOwnPropertyDescriptor(a._scopes[0], r);
        },
        getPrototypeOf () {
            return Reflect.getPrototypeOf(i[0]);
        },
        has (a, r) {
            return ys(a).includes(r);
        },
        ownKeys (a) {
            return ys(a);
        },
        set (a, r, l) {
            let c = a._storage || (a._storage = n());
            return a[r] = c[r] = l, delete a._keys, !0;
        }
    });
}
function Ct(i, t, e, s) {
    let n = {
        _cacheable: !1,
        _proxy: i,
        _context: t,
        _subProxy: e,
        _stack: new Set,
        _descriptors: xi(i, s),
        setContext: (o)=>Ct(i, o, e, s),
        override: (o)=>Ct(i.override(o), t, e, s)
    };
    return new Proxy(n, {
        deleteProperty (o, a) {
            return delete o[a], delete i[a], !0;
        },
        get (o, a, r) {
            return $s(o, a, ()=>Ho(o, a, r));
        },
        getOwnPropertyDescriptor (o, a) {
            return o._descriptors.allKeys ? Reflect.has(i, a) ? {
                enumerable: !0,
                configurable: !0
            } : void 0 : Reflect.getOwnPropertyDescriptor(i, a);
        },
        getPrototypeOf () {
            return Reflect.getPrototypeOf(i);
        },
        has (o, a) {
            return Reflect.has(i, a);
        },
        ownKeys () {
            return Reflect.ownKeys(i);
        },
        set (o, a, r) {
            return i[a] = r, delete o[a], !0;
        }
    });
}
function xi(i, t = {
    scriptable: !0,
    indexable: !0
}) {
    let { _scriptable: e = t.scriptable, _indexable: s = t.indexable, _allKeys: n = t.allKeys } = i;
    return {
        allKeys: n,
        scriptable: e,
        indexable: s,
        isScriptable: ut(e) ? e : ()=>e,
        isIndexable: ut(s) ? s : ()=>s
    };
}
var Wo = (i, t)=>i ? i + Pe1(t) : t, yi = (i, t)=>O2(t) && i !== "adapters" && (Object.getPrototypeOf(t) === null || t.constructor === Object);
function $s(i, t, e) {
    if (Object.prototype.hasOwnProperty.call(i, t)) return i[t];
    let s = e();
    return i[t] = s, s;
}
function Ho(i, t, e) {
    let { _proxy: s, _context: n, _subProxy: o, _descriptors: a } = i, r = s[t];
    return ut(r) && a.isScriptable(t) && (r = jo(t, r, i, e)), I1(r) && r.length && (r = $o(t, r, i, a.isIndexable)), yi(t, r) && (r = Ct(r, n, o && o[t], a)), r;
}
function jo(i, t, e, s) {
    let { _proxy: n, _context: o, _subProxy: a, _stack: r } = e;
    if (r.has(i)) throw new Error("Recursion detected: " + Array.from(r).join("->") + "->" + i);
    return r.add(i), t = t(o, a || s), r.delete(i), yi(i, t) && (t = vi(n._scopes, n, i, t)), t;
}
function $o(i, t, e, s) {
    let { _proxy: n, _context: o, _subProxy: a, _descriptors: r } = e;
    if (et1(o.index) && s(i)) t = t[o.index % t.length];
    else if (O2(t[0])) {
        let l = t, c = n._scopes.filter((h)=>h !== l);
        t = [];
        for (let h of l){
            let d = vi(c, n, i, h);
            t.push(Ct(d, o, a && a[i], r));
        }
    }
    return t;
}
function Us(i, t, e) {
    return ut(i) ? i(t, e) : i;
}
var Uo = (i, t)=>i === !0 ? t : typeof i == "string" ? gt(t, i) : void 0;
function Yo(i, t, e, s, n) {
    for (let o of t){
        let a = Uo(e, o);
        if (a) {
            i.add(a);
            let r = Us(a._fallback, e, n);
            if (et1(r) && r !== e && r !== s) return r;
        } else if (a === !1 && et1(s) && e !== s) return null;
    }
    return !1;
}
function vi(i, t, e, s) {
    let n = t._rootScopes, o = Us(t._fallback, e, s), a = [
        ...i,
        ...n
    ], r = new Set;
    r.add(s);
    let l = xs(r, a, e, o || e, s);
    return l === null || et1(o) && o !== e && (l = xs(r, a, o, l, s), l === null) ? !1 : Re(Array.from(r), [
        ""
    ], n, o, ()=>Xo(t, e, s));
}
function xs(i, t, e, s, n) {
    for(; e;)e = Yo(i, t, e, s, n);
    return e;
}
function Xo(i, t, e) {
    let s = i._getTarget();
    t in s || (s[t] = {});
    let n = s[t];
    return I1(n) && O2(e) ? e : n || {};
}
function Ko(i, t, e, s) {
    let n;
    for (let o of t)if (n = Ys(Wo(o, i), e), et1(n)) return yi(i, n) ? vi(e, s, i, n) : n;
}
function Ys(i, t) {
    for (let e of t){
        if (!e) continue;
        let s = e[i];
        if (et1(s)) return s;
    }
}
function ys(i) {
    let t = i._keys;
    return t || (t = i._keys = qo(i._scopes)), t;
}
function qo(i) {
    let t = new Set;
    for (let e of i)for (let s of Object.keys(e).filter((n)=>!n.startsWith("_")))t.add(s);
    return Array.from(t);
}
function Mi(i, t, e, s) {
    let { iScale: n } = i, { key: o = "r" } = this._parsing, a = new Array(s), r, l, c, h;
    for(r = 0, l = s; r < l; ++r)c = r + e, h = t[c], a[r] = {
        r: n.parse(gt(h, o), c)
    };
    return a;
}
var Go = Number.EPSILON || 1e-14, Bt = (i, t)=>t < i.length && !i[t].skip && i[t], Xs = (i)=>i === "x" ? "y" : "x";
function Jo(i, t, e, s) {
    let n = i.skip ? t : i, o = t, a = e.skip ? t : e, r = we1(o, n), l = we1(a, o), c = r / (r + l), h = l / (r + l);
    c = isNaN(c) ? 0 : c, h = isNaN(h) ? 0 : h;
    let d = s * c, u = s * h;
    return {
        previous: {
            x: o.x - d * (a.x - n.x),
            y: o.y - d * (a.y - n.y)
        },
        next: {
            x: o.x + u * (a.x - n.x),
            y: o.y + u * (a.y - n.y)
        }
    };
}
function Qo(i, t, e) {
    let s = i.length, n, o, a, r, l, c = Bt(i, 0);
    for(let h = 0; h < s - 1; ++h)if (l = c, c = Bt(i, h + 1), !(!l || !c)) {
        if (Nt(t[h], 0, Go)) {
            e[h] = e[h + 1] = 0;
            continue;
        }
        n = e[h] / t[h], o = e[h + 1] / t[h], r = Math.pow(n, 2) + Math.pow(o, 2), !(r <= 9) && (a = 3 / Math.sqrt(r), e[h] = n * a * t[h], e[h + 1] = o * a * t[h]);
    }
}
function Zo(i, t, e = "x") {
    let s = Xs(e), n = i.length, o, a, r, l = Bt(i, 0);
    for(let c = 0; c < n; ++c){
        if (a = r, r = l, l = Bt(i, c + 1), !r) continue;
        let h = r[e], d = r[s];
        a && (o = (h - a[e]) / 3, r[`cp1${e}`] = h - o, r[`cp1${s}`] = d - o * t[c]), l && (o = (l[e] - h) / 3, r[`cp2${e}`] = h + o, r[`cp2${s}`] = d + o * t[c]);
    }
}
function ta(i, t = "x") {
    let e = Xs(t), s = i.length, n = Array(s).fill(0), o = Array(s), a, r, l, c = Bt(i, 0);
    for(a = 0; a < s; ++a)if (r = l, l = c, c = Bt(i, a + 1), !!l) {
        if (c) {
            let h = c[t] - l[t];
            n[a] = h !== 0 ? (c[e] - l[e]) / h : 0;
        }
        o[a] = r ? c ? nt1(n[a - 1]) !== nt1(n[a]) ? 0 : (n[a - 1] + n[a]) / 2 : n[a - 1] : n[a];
    }
    Qo(i, n, o), Zo(i, o, t);
}
function ye(i, t, e) {
    return Math.max(Math.min(i, e), t);
}
function ea(i, t) {
    let e, s, n, o, a, r = Ft(i[0], t);
    for(e = 0, s = i.length; e < s; ++e)a = o, o = r, r = e < s - 1 && Ft(i[e + 1], t), o && (n = i[e], a && (n.cp1x = ye(n.cp1x, t.left, t.right), n.cp1y = ye(n.cp1y, t.top, t.bottom)), r && (n.cp2x = ye(n.cp2x, t.left, t.right), n.cp2y = ye(n.cp2y, t.top, t.bottom)));
}
function Ks(i, t, e, s, n) {
    let o, a, r, l;
    if (t.spanGaps && (i = i.filter((c)=>!c.skip)), t.cubicInterpolationMode === "monotone") ta(i, n);
    else {
        let c = s ? i[i.length - 1] : i[0];
        for(o = 0, a = i.length; o < a; ++o)r = i[o], l = Jo(c, r, i[Math.min(o + 1, a - (s ? 0 : 1)) % a], t.tension), r.cp1x = l.previous.x, r.cp1y = l.previous.y, r.cp2x = l.next.x, r.cp2y = l.next.y, c = r;
    }
    t.capBezierPoints && ea(i, e);
}
function ki() {
    return typeof window < "u" && typeof document < "u";
}
function Ee(i) {
    let t = i.parentNode;
    return t && t.toString() === "[object ShadowRoot]" && (t = t.host), t;
}
function Se(i, t, e) {
    let s;
    return typeof i == "string" ? (s = parseInt(i, 10), i.indexOf("%") !== -1 && (s = s / 100 * t.parentNode[e])) : s = i, s;
}
var Ie = (i)=>i.ownerDocument.defaultView.getComputedStyle(i, null);
function ia(i, t) {
    return Ie(i).getPropertyValue(t);
}
var sa = [
    "top",
    "right",
    "bottom",
    "left"
];
function Pt(i, t, e) {
    let s = {};
    e = e ? "-" + e : "";
    for(let n = 0; n < 4; n++){
        let o = sa[n];
        s[o] = parseFloat(i[t + "-" + o + e]) || 0;
    }
    return s.width = s.left + s.right, s.height = s.top + s.bottom, s;
}
var na = (i, t, e)=>(i > 0 || t > 0) && (!e || !e.shadowRoot);
function oa(i, t) {
    let e = i.touches, s = e && e.length ? e[0] : i, { offsetX: n, offsetY: o } = s, a = !1, r, l;
    if (na(n, o, i.target)) r = n, l = o;
    else {
        let c = t.getBoundingClientRect();
        r = s.clientX - c.left, l = s.clientY - c.top, a = !0;
    }
    return {
        x: r,
        y: l,
        box: a
    };
}
function kt(i, t) {
    if ("native" in i) return i;
    let { canvas: e, currentDevicePixelRatio: s } = t, n = Ie(e), o = n.boxSizing === "border-box", a = Pt(n, "padding"), r = Pt(n, "border", "width"), { x: l, y: c, box: h } = oa(i, e), d = a.left + (h && r.left), u = a.top + (h && r.top), { width: f, height: p } = t;
    return o && (f -= a.width + r.width, p -= a.height + r.height), {
        x: Math.round((l - d) / f * e.width / s),
        y: Math.round((c - u) / p * e.height / s)
    };
}
function aa(i, t, e) {
    let s, n;
    if (t === void 0 || e === void 0) {
        let o = Ee(i);
        if (!o) t = i.clientWidth, e = i.clientHeight;
        else {
            let a = o.getBoundingClientRect(), r = Ie(o), l = Pt(r, "border", "width"), c = Pt(r, "padding");
            t = a.width - c.width - l.width, e = a.height - c.height - l.height, s = Se(r.maxWidth, o, "clientWidth"), n = Se(r.maxHeight, o, "clientHeight");
        }
    }
    return {
        width: t,
        height: e,
        maxWidth: s || ke,
        maxHeight: n || ke
    };
}
var ve = (i)=>Math.round(i * 10) / 10;
function qs(i, t, e, s) {
    let n = Ie(i), o = Pt(n, "margin"), a = Se(n.maxWidth, i, "clientWidth") || ke, r = Se(n.maxHeight, i, "clientHeight") || ke, l = aa(i, t, e), { width: c, height: h } = l;
    if (n.boxSizing === "content-box") {
        let u = Pt(n, "border", "width"), f = Pt(n, "padding");
        c -= f.width + u.width, h -= f.height + u.height;
    }
    return c = Math.max(0, c - o.width), h = Math.max(0, s ? c / s : h - o.height), c = ve(Math.min(c, a, l.maxWidth)), h = ve(Math.min(h, r, l.maxHeight)), c && !h && (h = ve(c / 2)), (t !== void 0 || e !== void 0) && s && l.height && h > l.height && (h = l.height, c = ve(Math.floor(h * s))), {
        width: c,
        height: h
    };
}
function wi(i, t, e) {
    let s = t || 1, n = Math.floor(i.height * s), o = Math.floor(i.width * s);
    i.height = Math.floor(i.height), i.width = Math.floor(i.width);
    let a = i.canvas;
    return a.style && (e || !a.style.height && !a.style.width) && (a.style.height = `${i.height}px`, a.style.width = `${i.width}px`), i.currentDevicePixelRatio !== s || a.height !== n || a.width !== o ? (i.currentDevicePixelRatio = s, a.height = n, a.width = o, i.ctx.setTransform(s, 0, 0, s, 0, 0), !0) : !1;
}
var Gs = function() {
    let i = !1;
    try {
        let t = {
            get passive () {
                return i = !0, !1;
            }
        };
        window.addEventListener("test", null, t), window.removeEventListener("test", null, t);
    } catch  {}
    return i;
}();
function Si(i, t) {
    let e = ia(i, t), s = e && e.match(/^(\d+)(\.\d+)?px$/);
    return s ? +s[1] : void 0;
}
function _t(i, t, e, s) {
    return {
        x: i.x + e * (t.x - i.x),
        y: i.y + e * (t.y - i.y)
    };
}
function Js(i, t, e, s) {
    return {
        x: i.x + e * (t.x - i.x),
        y: s === "middle" ? e < .5 ? i.y : t.y : s === "after" ? e < 1 ? i.y : t.y : e > 0 ? t.y : i.y
    };
}
function Qs(i, t, e, s) {
    let n = {
        x: i.cp2x,
        y: i.cp2y
    }, o = {
        x: t.cp1x,
        y: t.cp1y
    }, a = _t(i, n, e), r = _t(n, o, e), l = _t(o, t, e), c = _t(a, r, e), h = _t(r, l, e);
    return _t(c, h, e);
}
var ra = function(i, t) {
    return {
        x (e) {
            return i + i + t - e;
        },
        setWidth (e) {
            t = e;
        },
        textAlign (e) {
            return e === "center" ? e : e === "right" ? "left" : "right";
        },
        xPlus (e, s) {
            return e - s;
        },
        leftForLtr (e, s) {
            return e - s;
        }
    };
}, la = function() {
    return {
        x (i) {
            return i;
        },
        setWidth (i) {},
        textAlign (i) {
            return i;
        },
        xPlus (i, t) {
            return i + t;
        },
        leftForLtr (i, t) {
            return i;
        }
    };
};
function Ot(i, t, e) {
    return i ? ra(t, e) : la();
}
function Pi(i, t) {
    let e, s;
    (t === "ltr" || t === "rtl") && (e = i.canvas.style, s = [
        e.getPropertyValue("direction"),
        e.getPropertyPriority("direction")
    ], e.setProperty("direction", t, "important"), i.prevTextDirection = s);
}
function Ci(i, t) {
    t !== void 0 && (delete i.prevTextDirection, i.canvas.style.setProperty("direction", t[0], t[1]));
}
function Zs(i) {
    return i === "angle" ? {
        between: Wt,
        compare: So,
        normalize: G2
    } : {
        between: lt,
        compare: (t, e)=>t - e,
        normalize: (t)=>t
    };
}
function vs({ start: i, end: t, count: e, loop: s, style: n }) {
    return {
        start: i % e,
        end: t % e,
        loop: s && (t - i + 1) % e === 0,
        style: n
    };
}
function ca(i, t, e) {
    let { property: s, start: n, end: o } = e, { between: a, normalize: r } = Zs(s), l = t.length, { start: c, end: h, loop: d } = i, u, f;
    if (d) {
        for(c += l, h += l, u = 0, f = l; u < f && a(r(t[c % l][s]), n, o); ++u)c--, h--;
        c %= l, h %= l;
    }
    return h < c && (h += l), {
        start: c,
        end: h,
        loop: d,
        style: i.style
    };
}
function Di(i, t, e) {
    if (!e) return [
        i
    ];
    let { property: s, start: n, end: o } = e, a = t.length, { compare: r, between: l, normalize: c } = Zs(s), { start: h, end: d, loop: u, style: f } = ca(i, t, e), p = [], g = !1, m = null, b, _, y, v = ()=>l(n, y, b) && r(n, y) !== 0, x = ()=>r(o, b) === 0 || l(o, y, b), M = ()=>g || v(), k = ()=>!g || x();
    for(let w = h, S = h; w <= d; ++w)_ = t[w % a], !_.skip && (b = c(_[s]), b !== y && (g = l(b, n, o), m === null && M() && (m = r(b, n) === 0 ? w : S), m !== null && k() && (p.push(vs({
        start: m,
        end: w,
        loop: u,
        count: a,
        style: f
    })), m = null), S = w, y = b));
    return m !== null && p.push(vs({
        start: m,
        end: d,
        loop: u,
        count: a,
        style: f
    })), p;
}
function Oi(i, t) {
    let e = [], s = i.segments;
    for(let n = 0; n < s.length; n++){
        let o = Di(s[n], i.points, t);
        o.length && e.push(...o);
    }
    return e;
}
function ha(i, t, e, s) {
    let n = 0, o = t - 1;
    if (e && !s) for(; n < t && !i[n].skip;)n++;
    for(; n < t && i[n].skip;)n++;
    for(n %= t, e && (o += n); o > n && i[o % t].skip;)o--;
    return o %= t, {
        start: n,
        end: o
    };
}
function da(i, t, e, s) {
    let n = i.length, o = [], a = t, r = i[t], l;
    for(l = t + 1; l <= e; ++l){
        let c = i[l % n];
        c.skip || c.stop ? r.skip || (s = !1, o.push({
            start: t % n,
            end: (l - 1) % n,
            loop: s
        }), t = a = c.stop ? l : null) : (a = l, r.skip && (t = l)), r = c;
    }
    return a !== null && o.push({
        start: t % n,
        end: a % n,
        loop: s
    }), o;
}
function tn(i, t) {
    let e = i.points, s = i.options.spanGaps, n = e.length;
    if (!n) return [];
    let o = !!i._loop, { start: a, end: r } = ha(e, n, o, s);
    if (s === !0) return Ms(i, [
        {
            start: a,
            end: r,
            loop: o
        }
    ], e, t);
    let l = r < a ? r + n : r, c = !!i._fullLoop && a === 0 && r === n - 1;
    return Ms(i, da(e, a, l, c), e, t);
}
function Ms(i, t, e, s) {
    return !s || !s.setContext || !e ? t : ua(i, t, e, s);
}
function ua(i, t, e, s) {
    let n = i._chart.getContext(), o = ks(i.options), { _datasetIndex: a, options: { spanGaps: r } } = i, l = e.length, c = [], h = o, d = t[0].start, u = d;
    function f(p, g, m, b) {
        let _ = r ? -1 : 1;
        if (p !== g) {
            for(p += l; e[p % l].skip;)p -= _;
            for(; e[g % l].skip;)g += _;
            p % l !== g % l && (c.push({
                start: p % l,
                end: g % l,
                loop: m,
                style: b
            }), h = b, d = g % l);
        }
    }
    for (let p of t){
        d = r ? d : p.start;
        let g = e[d % l], m;
        for(u = d + 1; u <= p.end; u++){
            let b = e[u % l];
            m = ks(s.setContext(pt(n, {
                type: "segment",
                p0: g,
                p1: b,
                p0DataIndex: (u - 1) % l,
                p1DataIndex: u % l,
                datasetIndex: a
            }))), fa(m, h) && f(d, u - 1, p.loop, h), g = b, h = m;
        }
        d < u - 1 && f(d, u - 1, p.loop, h);
    }
    return c;
}
function ks(i) {
    return {
        backgroundColor: i.backgroundColor,
        borderCapStyle: i.borderCapStyle,
        borderDash: i.borderDash,
        borderDashOffset: i.borderDashOffset,
        borderJoinStyle: i.borderJoinStyle,
        borderWidth: i.borderWidth,
        borderColor: i.borderColor
    };
}
function fa(i, t) {
    return t && JSON.stringify(i) !== JSON.stringify(t);
}
var Vi = class {
    constructor(){
        this._request = null, this._charts = new Map, this._running = !1, this._lastDate = void 0;
    }
    _notify(t, e, s, n) {
        let o = e.listeners[n], a = e.duration;
        o.forEach((r)=>r({
                chart: t,
                initial: e.initial,
                numSteps: a,
                currentStep: Math.min(s - e.start, a)
            }));
    }
    _refresh() {
        this._request || (this._running = !0, this._request = di.call(window, ()=>{
            this._update(), this._request = null, this._running && this._refresh();
        }));
    }
    _update(t = Date.now()) {
        let e = 0;
        this._charts.forEach((s, n)=>{
            if (!s.running || !s.items.length) return;
            let o = s.items, a = o.length - 1, r = !1, l;
            for(; a >= 0; --a)l = o[a], l._active ? (l._total > s.duration && (s.duration = l._total), l.tick(t), r = !0) : (o[a] = o[o.length - 1], o.pop());
            r && (n.draw(), this._notify(n, s, t, "progress")), o.length || (s.running = !1, this._notify(n, s, t, "complete"), s.initial = !1), e += o.length;
        }), this._lastDate = t, e === 0 && (this._running = !1);
    }
    _getAnims(t) {
        let e = this._charts, s = e.get(t);
        return s || (s = {
            running: !1,
            initial: !0,
            items: [],
            listeners: {
                complete: [],
                progress: []
            }
        }, e.set(t, s)), s;
    }
    listen(t, e, s) {
        this._getAnims(t).listeners[e].push(s);
    }
    add(t, e) {
        !e || !e.length || this._getAnims(t).items.push(...e);
    }
    has(t) {
        return this._getAnims(t).items.length > 0;
    }
    start(t) {
        let e = this._charts.get(t);
        e && (e.running = !0, e.start = Date.now(), e.duration = e.items.reduce((s, n)=>Math.max(s, n._duration), 0), this._refresh());
    }
    running(t) {
        if (!this._running) return !1;
        let e = this._charts.get(t);
        return !(!e || !e.running || !e.items.length);
    }
    stop(t) {
        let e = this._charts.get(t);
        if (!e || !e.items.length) return;
        let s = e.items, n = s.length - 1;
        for(; n >= 0; --n)s[n].cancel();
        e.items = [], this._notify(t, e, Date.now(), "complete");
    }
    remove(t) {
        return this._charts.delete(t);
    }
}, mt = new Vi, en = "transparent", ga = {
    boolean (i, t, e) {
        return e > .5 ? t : i;
    },
    color (i, t, e) {
        let s = pi(i || en), n = s.valid && pi(t || en);
        return n && n.valid ? n.mix(s, e).hexString() : t;
    },
    number (i, t, e) {
        return i + (t - i) * e;
    }
}, Ni = class {
    constructor(t, e, s, n){
        let o = e[s];
        n = Ut([
            t.to,
            n,
            o,
            t.from
        ]);
        let a = Ut([
            t.from,
            o,
            n
        ]);
        this._active = !0, this._fn = t.fn || ga[t.type || typeof a], this._easing = It[t.easing] || It.linear, this._start = Math.floor(Date.now() + (t.delay || 0)), this._duration = this._total = Math.floor(t.duration), this._loop = !!t.loop, this._target = e, this._prop = s, this._from = a, this._to = n, this._promises = void 0;
    }
    active() {
        return this._active;
    }
    update(t, e, s) {
        if (this._active) {
            this._notify(!1);
            let n = this._target[this._prop], o = s - this._start, a = this._duration - o;
            this._start = s, this._duration = Math.floor(Math.max(a, t.duration)), this._total += o, this._loop = !!t.loop, this._to = Ut([
                t.to,
                e,
                n,
                t.from
            ]), this._from = Ut([
                t.from,
                n,
                e
            ]);
        }
    }
    cancel() {
        this._active && (this.tick(Date.now()), this._active = !1, this._notify(!1));
    }
    tick(t) {
        let e = t - this._start, s = this._duration, n = this._prop, o = this._from, a = this._loop, r = this._to, l;
        if (this._active = o !== r && (a || e < s), !this._active) {
            this._target[n] = r, this._notify(!0);
            return;
        }
        if (e < 0) {
            this._target[n] = o;
            return;
        }
        l = e / s % 2, l = a && l > 1 ? 2 - l : l, l = this._easing(Math.min(1, Math.max(0, l))), this._target[n] = this._fn(o, r, l);
    }
    wait() {
        let t = this._promises || (this._promises = []);
        return new Promise((e, s)=>{
            t.push({
                res: e,
                rej: s
            });
        });
    }
    _notify(t) {
        let e = t ? "res" : "rej", s = this._promises || [];
        for(let n = 0; n < s.length; n++)s[n][e]();
    }
}, $e = class {
    constructor(t, e){
        this._chart = t, this._properties = new Map, this.configure(e);
    }
    configure(t) {
        if (!O2(t)) return;
        let e = Object.keys(W1.animation), s = this._properties;
        Object.getOwnPropertyNames(t).forEach((n)=>{
            let o = t[n];
            if (!O2(o)) return;
            let a = {};
            for (let r of e)a[r] = o[r];
            (I1(o.properties) && o.properties || [
                n
            ]).forEach((r)=>{
                (r === n || !s.has(r)) && s.set(r, a);
            });
        });
    }
    _animateOptions(t, e) {
        let s = e.options, n = ma(t, s);
        if (!n) return [];
        let o = this._createAnimations(n, s);
        return s.$shared && pa(t.options.$animations, s).then(()=>{
            t.options = s;
        }, ()=>{}), o;
    }
    _createAnimations(t, e) {
        let s = this._properties, n = [], o = t.$animations || (t.$animations = {}), a = Object.keys(e), r = Date.now(), l;
        for(l = a.length - 1; l >= 0; --l){
            let c = a[l];
            if (c.charAt(0) === "$") continue;
            if (c === "options") {
                n.push(...this._animateOptions(t, e));
                continue;
            }
            let h = e[c], d = o[c], u = s.get(c);
            if (d) if (u && d.active()) {
                d.update(u, h, r);
                continue;
            } else d.cancel();
            if (!u || !u.duration) {
                t[c] = h;
                continue;
            }
            o[c] = d = new Ni(u, t, c, h), n.push(d);
        }
        return n;
    }
    update(t, e) {
        if (this._properties.size === 0) {
            Object.assign(t, e);
            return;
        }
        let s = this._createAnimations(t, e);
        if (s.length) return mt.add(this._chart, s), !0;
    }
};
function pa(i, t) {
    let e = [], s = Object.keys(t);
    for(let n = 0; n < s.length; n++){
        let o = i[s[n]];
        o && o.active() && e.push(o.wait());
    }
    return Promise.all(e);
}
function ma(i, t) {
    if (!t) return;
    let e = i.options;
    if (!e) {
        i.options = t;
        return;
    }
    return e.$shared && (i.options = e = Object.assign({}, e, {
        $shared: !1,
        $animations: {}
    })), e;
}
function sn(i, t) {
    let e = i && i.options || {}, s = e.reverse, n = e.min === void 0 ? t : 0, o = e.max === void 0 ? t : 0;
    return {
        start: s ? o : n,
        end: s ? n : o
    };
}
function ba(i, t, e) {
    if (e === !1) return !1;
    let s = sn(i, e), n = sn(t, e);
    return {
        top: n.end,
        right: s.end,
        bottom: n.start,
        left: s.start
    };
}
function _a(i) {
    let t, e, s, n;
    return O2(i) ? (t = i.top, e = i.right, s = i.bottom, n = i.left) : t = e = s = n = i, {
        top: t,
        right: e,
        bottom: s,
        left: n,
        disabled: i === !1
    };
}
function Qn(i, t) {
    let e = [], s = i._getSortedDatasetMetas(t), n, o;
    for(n = 0, o = s.length; n < o; ++n)e.push(s[n].index);
    return e;
}
function nn(i, t, e, s = {}) {
    let n = i.keys, o = s.mode === "single", a, r, l, c;
    if (t !== null) {
        for(a = 0, r = n.length; a < r; ++a){
            if (l = +n[a], l === e) {
                if (s.all) continue;
                break;
            }
            c = i.values[l], N2(c) && (o || t === 0 || nt1(t) === nt1(c)) && (t += c);
        }
        return t;
    }
}
function xa(i) {
    let t = Object.keys(i), e = new Array(t.length), s, n, o;
    for(s = 0, n = t.length; s < n; ++s)o = t[s], e[s] = {
        x: o,
        y: i[o]
    };
    return e;
}
function on(i, t) {
    let e = i && i.options.stacked;
    return e || e === void 0 && t.stack !== void 0;
}
function ya(i, t, e) {
    return `${i.id}.${t.id}.${e.stack || e.type}`;
}
function va(i) {
    let { min: t, max: e, minDefined: s, maxDefined: n } = i.getUserBounds();
    return {
        min: s ? t : Number.NEGATIVE_INFINITY,
        max: n ? e : Number.POSITIVE_INFINITY
    };
}
function Ma(i, t, e) {
    let s = i[t] || (i[t] = {});
    return s[e] || (s[e] = {});
}
function an(i, t, e, s) {
    for (let n of t.getMatchingVisibleMetas(s).reverse()){
        let o = i[n.index];
        if (e && o > 0 || !e && o < 0) return n.index;
    }
    return null;
}
function rn(i, t) {
    let { chart: e, _cachedMeta: s } = i, n = e._stacks || (e._stacks = {}), { iScale: o, vScale: a, index: r } = s, l = o.axis, c = a.axis, h = ya(o, a, s), d = t.length, u;
    for(let f = 0; f < d; ++f){
        let p = t[f], { [l]: g, [c]: m } = p, b = p._stacks || (p._stacks = {});
        u = b[c] = Ma(n, h, g), u[r] = m, u._top = an(u, a, !0, s.type), u._bottom = an(u, a, !1, s.type);
        let _ = u._visualValues || (u._visualValues = {});
        _[r] = m;
    }
}
function Ai(i, t) {
    let e = i.scales;
    return Object.keys(e).filter((s)=>e[s].axis === t).shift();
}
function ka(i, t) {
    return pt(i, {
        active: !1,
        dataset: void 0,
        datasetIndex: t,
        index: t,
        mode: "default",
        type: "dataset"
    });
}
function wa(i, t, e) {
    return pt(i, {
        active: !1,
        dataIndex: t,
        parsed: void 0,
        raw: void 0,
        element: e,
        index: t,
        mode: "default",
        type: "data"
    });
}
function oe(i, t) {
    let e = i.controller.index, s = i.vScale && i.vScale.axis;
    if (s) {
        t = t || i._parsed;
        for (let n of t){
            let o = n._stacks;
            if (!o || o[s] === void 0 || o[s][e] === void 0) return;
            delete o[s][e], o[s]._visualValues !== void 0 && o[s]._visualValues[e] !== void 0 && delete o[s]._visualValues[e];
        }
    }
}
var Li = (i)=>i === "reset" || i === "none", ln = (i, t)=>t ? i : Object.assign({}, i), Sa = (i, t, e)=>i && !t.hidden && t._stacked && {
        keys: Qn(e, !0),
        values: null
    }, dt = class {
    static defaults = {};
    static datasetElementType = null;
    static dataElementType = null;
    constructor(t, e){
        this.chart = t, this._ctx = t.ctx, this.index = e, this._cachedDataOpts = {}, this._cachedMeta = this.getMeta(), this._type = this._cachedMeta.type, this.options = void 0, this._parsing = !1, this._data = void 0, this._objectData = void 0, this._sharedOptions = void 0, this._drawStart = void 0, this._drawCount = void 0, this.enableOptionSharing = !1, this.supportsDecimation = !1, this.$context = void 0, this._syncList = [], this.datasetElementType = new.target.datasetElementType, this.dataElementType = new.target.dataElementType, this.initialize();
    }
    initialize() {
        let t = this._cachedMeta;
        this.configure(), this.linkScales(), t._stacked = on(t.vScale, t), this.addElements(), this.options.fill && !this.chart.isPluginEnabled("filler") && console.warn("Tried to use the 'fill' option without the 'Filler' plugin enabled. Please import and register the 'Filler' plugin and make sure it is not disabled in the options");
    }
    updateIndex(t) {
        this.index !== t && oe(this._cachedMeta), this.index = t;
    }
    linkScales() {
        let t = this.chart, e = this._cachedMeta, s = this.getDataset(), n = (d, u, f, p)=>d === "x" ? u : d === "r" ? p : f, o = e.xAxisID = P1(s.xAxisID, Ai(t, "x")), a = e.yAxisID = P1(s.yAxisID, Ai(t, "y")), r = e.rAxisID = P1(s.rAxisID, Ai(t, "r")), l = e.indexAxis, c = e.iAxisID = n(l, o, a, r), h = e.vAxisID = n(l, a, o, r);
        e.xScale = this.getScaleForId(o), e.yScale = this.getScaleForId(a), e.rScale = this.getScaleForId(r), e.iScale = this.getScaleForId(c), e.vScale = this.getScaleForId(h);
    }
    getDataset() {
        return this.chart.data.datasets[this.index];
    }
    getMeta() {
        return this.chart.getDatasetMeta(this.index);
    }
    getScaleForId(t) {
        return this.chart.scales[t];
    }
    _getOtherScale(t) {
        let e = this._cachedMeta;
        return t === e.iScale ? e.vScale : e.iScale;
    }
    reset() {
        this._update("reset");
    }
    _destroy() {
        let t = this._cachedMeta;
        this._data && ci(this._data, this), t._stacked && oe(t);
    }
    _dataCheck() {
        let t = this.getDataset(), e = t.data || (t.data = []), s = this._data;
        if (O2(e)) this._data = xa(e);
        else if (s !== e) {
            if (s) {
                ci(s, this);
                let n = this._cachedMeta;
                oe(n), n._parsed = [];
            }
            e && Object.isExtensible(e) && Is(e, this), this._syncList = [], this._data = e;
        }
    }
    addElements() {
        let t = this._cachedMeta;
        this._dataCheck(), this.datasetElementType && (t.dataset = new this.datasetElementType);
    }
    buildOrUpdateElements(t) {
        let e = this._cachedMeta, s = this.getDataset(), n = !1;
        this._dataCheck();
        let o = e._stacked;
        e._stacked = on(e.vScale, e), e.stack !== s.stack && (n = !0, oe(e), e.stack = s.stack), this._resyncElements(t), (n || o !== e._stacked) && rn(this, e._parsed);
    }
    configure() {
        let t = this.chart.config, e = t.datasetScopeKeys(this._type), s = t.getOptionScopes(this.getDataset(), e, !0);
        this.options = t.createResolver(s, this.getContext()), this._parsing = this.options.parsing, this._cachedDataOpts = {};
    }
    parse(t, e) {
        let { _cachedMeta: s, _data: n } = this, { iScale: o, _stacked: a } = s, r = o.axis, l = t === 0 && e === n.length ? !0 : s._sorted, c = t > 0 && s._parsed[t - 1], h, d, u;
        if (this._parsing === !1) s._parsed = n, s._sorted = !0, u = n;
        else {
            I1(n[t]) ? u = this.parseArrayData(s, n, t, e) : O2(n[t]) ? u = this.parseObjectData(s, n, t, e) : u = this.parsePrimitiveData(s, n, t, e);
            let f = ()=>d[r] === null || c && d[r] < c[r];
            for(h = 0; h < e; ++h)s._parsed[h + t] = d = u[h], l && (f() && (l = !1), c = d);
            s._sorted = l;
        }
        a && rn(this, u);
    }
    parsePrimitiveData(t, e, s, n) {
        let { iScale: o, vScale: a } = t, r = o.axis, l = a.axis, c = o.getLabels(), h = o === a, d = new Array(n), u, f, p;
        for(u = 0, f = n; u < f; ++u)p = u + s, d[u] = {
            [r]: h || o.parse(c[p], p),
            [l]: a.parse(e[p], p)
        };
        return d;
    }
    parseArrayData(t, e, s, n) {
        let { xScale: o, yScale: a } = t, r = new Array(n), l, c, h, d;
        for(l = 0, c = n; l < c; ++l)h = l + s, d = e[h], r[l] = {
            x: o.parse(d[0], h),
            y: a.parse(d[1], h)
        };
        return r;
    }
    parseObjectData(t, e, s, n) {
        let { xScale: o, yScale: a } = t, { xAxisKey: r = "x", yAxisKey: l = "y" } = this._parsing, c = new Array(n), h, d, u, f;
        for(h = 0, d = n; h < d; ++h)u = h + s, f = e[u], c[h] = {
            x: o.parse(gt(f, r), u),
            y: a.parse(gt(f, l), u)
        };
        return c;
    }
    getParsed(t) {
        return this._cachedMeta._parsed[t];
    }
    getDataElement(t) {
        return this._cachedMeta.data[t];
    }
    applyStack(t, e, s) {
        let n = this.chart, o = this._cachedMeta, a = e[t.axis], r = {
            keys: Qn(n, !0),
            values: e._stacks[t.axis]._visualValues
        };
        return nn(r, a, o.index, {
            mode: s
        });
    }
    updateRangeFromParsed(t, e, s, n) {
        let o = s[e.axis], a = o === null ? NaN : o, r = n && s._stacks[e.axis];
        n && r && (n.values = r, a = nn(n, o, this._cachedMeta.index)), t.min = Math.min(t.min, a), t.max = Math.max(t.max, a);
    }
    getMinMax(t, e) {
        let s = this._cachedMeta, n = s._parsed, o = s._sorted && t === s.iScale, a = n.length, r = this._getOtherScale(t), l = Sa(e, s, this.chart), c = {
            min: Number.POSITIVE_INFINITY,
            max: Number.NEGATIVE_INFINITY
        }, { min: h, max: d } = va(r), u, f;
        function p() {
            f = n[u];
            let g = f[r.axis];
            return !N2(f[t.axis]) || h > g || d < g;
        }
        for(u = 0; u < a && !(!p() && (this.updateRangeFromParsed(c, t, f, l), o)); ++u);
        if (o) {
            for(u = a - 1; u >= 0; --u)if (!p()) {
                this.updateRangeFromParsed(c, t, f, l);
                break;
            }
        }
        return c;
    }
    getAllParsedValues(t) {
        let e = this._cachedMeta._parsed, s = [], n, o, a;
        for(n = 0, o = e.length; n < o; ++n)a = e[n][t.axis], N2(a) && s.push(a);
        return s;
    }
    getMaxOverflow() {
        return !1;
    }
    getLabelAndValue(t) {
        let e = this._cachedMeta, s = e.iScale, n = e.vScale, o = this.getParsed(t);
        return {
            label: s ? "" + s.getLabelForValue(o[s.axis]) : "",
            value: n ? "" + n.getLabelForValue(o[n.axis]) : ""
        };
    }
    _update(t) {
        let e = this._cachedMeta;
        this.update(t || "default"), e._clip = _a(P1(this.options.clip, ba(e.xScale, e.yScale, this.getMaxOverflow())));
    }
    update(t) {}
    draw() {
        let t = this._ctx, e = this.chart, s = this._cachedMeta, n = s.data || [], o = e.chartArea, a = [], r = this._drawStart || 0, l = this._drawCount || n.length - r, c = this.options.drawActiveElementsOnTop, h;
        for(s.dataset && s.dataset.draw(t, o, r, l), h = r; h < r + l; ++h){
            let d = n[h];
            d.hidden || (d.active && c ? a.push(d) : d.draw(t, o));
        }
        for(h = 0; h < a.length; ++h)a[h].draw(t, o);
    }
    getStyle(t, e) {
        let s = e ? "active" : "default";
        return t === void 0 && this._cachedMeta.dataset ? this.resolveDatasetElementOptions(s) : this.resolveDataElementOptions(t || 0, s);
    }
    getContext(t, e, s) {
        let n = this.getDataset(), o;
        if (t >= 0 && t < this._cachedMeta.data.length) {
            let a = this._cachedMeta.data[t];
            o = a.$context || (a.$context = wa(this.getContext(), t, a)), o.parsed = this.getParsed(t), o.raw = n.data[t], o.index = o.dataIndex = t;
        } else o = this.$context || (this.$context = ka(this.chart.getContext(), this.index)), o.dataset = n, o.index = o.datasetIndex = this.index;
        return o.active = !!e, o.mode = s, o;
    }
    resolveDatasetElementOptions(t) {
        return this._resolveElementOptions(this.datasetElementType.id, t);
    }
    resolveDataElementOptions(t, e) {
        return this._resolveElementOptions(this.dataElementType.id, e, t);
    }
    _resolveElementOptions(t, e = "default", s) {
        let n = e === "active", o = this._cachedDataOpts, a = t + "-" + e, r = o[a], l = this.enableOptionSharing && et1(s);
        if (r) return ln(r, l);
        let c = this.chart.config, h = c.datasetElementScopeKeys(this._type, t), d = n ? [
            `${t}Hover`,
            "hover",
            t,
            ""
        ] : [
            t,
            ""
        ], u = c.getOptionScopes(this.getDataset(), h), f = Object.keys(W1.elements[t]), p = ()=>this.getContext(s, n, e), g = c.resolveNamedOptions(u, f, p, d);
        return g.$shared && (g.$shared = l, o[a] = Object.freeze(ln(g, l))), g;
    }
    _resolveAnimations(t, e, s) {
        let n = this.chart, o = this._cachedDataOpts, a = `animation-${e}`, r = o[a];
        if (r) return r;
        let l;
        if (n.options.animation !== !1) {
            let h = this.chart.config, d = h.datasetAnimationScopeKeys(this._type, e), u = h.getOptionScopes(this.getDataset(), d);
            l = h.createResolver(u, this.getContext(t, s, e));
        }
        let c = new $e(n, l && l.animations);
        return l && l._cacheable && (o[a] = Object.freeze(c)), c;
    }
    getSharedOptions(t) {
        if (t.$shared) return this._sharedOptions || (this._sharedOptions = Object.assign({}, t));
    }
    includeOptions(t, e) {
        return !e || Li(t) || this.chart._animationsDisabled;
    }
    _getSharedOptions(t, e) {
        let s = this.resolveDataElementOptions(t, e), n = this._sharedOptions, o = this.getSharedOptions(s), a = this.includeOptions(e, o) || o !== n;
        return this.updateSharedOptions(o, e, s), {
            sharedOptions: o,
            includeOptions: a
        };
    }
    updateElement(t, e, s, n) {
        Li(n) ? Object.assign(t, s) : this._resolveAnimations(e, n).update(t, s);
    }
    updateSharedOptions(t, e, s) {
        t && !Li(e) && this._resolveAnimations(void 0, e).update(t, s);
    }
    _setStyle(t, e, s, n) {
        t.active = n;
        let o = this.getStyle(e, n);
        this._resolveAnimations(e, s, n).update(t, {
            options: !n && this.getSharedOptions(o) || o
        });
    }
    removeHoverStyle(t, e, s) {
        this._setStyle(t, s, "active", !1);
    }
    setHoverStyle(t, e, s) {
        this._setStyle(t, s, "active", !0);
    }
    _removeDatasetHoverStyle() {
        let t = this._cachedMeta.dataset;
        t && this._setStyle(t, void 0, "active", !1);
    }
    _setDatasetHoverStyle() {
        let t = this._cachedMeta.dataset;
        t && this._setStyle(t, void 0, "active", !0);
    }
    _resyncElements(t) {
        let e = this._data, s = this._cachedMeta.data;
        for (let [r, l, c] of this._syncList)this[r](l, c);
        this._syncList = [];
        let n = s.length, o = e.length, a = Math.min(o, n);
        a && this.parse(0, a), o > n ? this._insertElements(n, o - n, t) : o < n && this._removeElements(o, n - o);
    }
    _insertElements(t, e, s = !0) {
        let n = this._cachedMeta, o = n.data, a = t + e, r, l = (c)=>{
            for(c.length += e, r = c.length - 1; r >= a; r--)c[r] = c[r - e];
        };
        for(l(o), r = t; r < a; ++r)o[r] = new this.dataElementType;
        this._parsing && l(n._parsed), this.parse(t, e), s && this.updateElements(o, t, e, "reset");
    }
    updateElements(t, e, s, n) {}
    _removeElements(t, e) {
        let s = this._cachedMeta;
        if (this._parsing) {
            let n = s._parsed.splice(t, e);
            s._stacked && oe(s, n);
        }
        s.data.splice(t, e);
    }
    _sync(t) {
        if (this._parsing) this._syncList.push(t);
        else {
            let [e, s, n] = t;
            this[e](s, n);
        }
        this.chart._dataChanges.push([
            this.index,
            ...t
        ]);
    }
    _onDataPush() {
        let t = arguments.length;
        this._sync([
            "_insertElements",
            this.getDataset().data.length - t,
            t
        ]);
    }
    _onDataPop() {
        this._sync([
            "_removeElements",
            this._cachedMeta.data.length - 1,
            1
        ]);
    }
    _onDataShift() {
        this._sync([
            "_removeElements",
            0,
            1
        ]);
    }
    _onDataSplice(t, e) {
        e && this._sync([
            "_removeElements",
            t,
            e
        ]);
        let s = arguments.length - 2;
        s && this._sync([
            "_insertElements",
            t,
            s
        ]);
    }
    _onDataUnshift() {
        this._sync([
            "_insertElements",
            0,
            arguments.length
        ]);
    }
};
function Pa(i, t) {
    if (!i._cache.$bar) {
        let e = i.getMatchingVisibleMetas(t), s = [];
        for(let n = 0, o = e.length; n < o; n++)s = s.concat(e[n].controller.getAllParsedValues(i));
        i._cache.$bar = hi(s.sort((n, o)=>n - o));
    }
    return i._cache.$bar;
}
function Ca(i) {
    let t = i.iScale, e = Pa(t, i.type), s = t._length, n, o, a, r, l = ()=>{
        a === 32767 || a === -32768 || (et1(r) && (s = Math.min(s, Math.abs(a - r) || s)), r = a);
    };
    for(n = 0, o = e.length; n < o; ++n)a = t.getPixelForValue(e[n]), l();
    for(r = void 0, n = 0, o = t.ticks.length; n < o; ++n)a = t.getPixelForTick(n), l();
    return s;
}
function Da(i, t, e, s) {
    let n = e.barThickness, o, a;
    return A1(n) ? (o = t.min * e.categoryPercentage, a = e.barPercentage) : (o = n * s, a = 1), {
        chunk: o / s,
        ratio: a,
        start: t.pixels[i] - o / 2
    };
}
function Oa(i, t, e, s) {
    let n = t.pixels, o = n[i], a = i > 0 ? n[i - 1] : null, r = i < n.length - 1 ? n[i + 1] : null, l = e.categoryPercentage;
    a === null && (a = o - (r === null ? t.end - t.start : r - o)), r === null && (r = o + o - a);
    let c = o - (o - Math.min(a, r)) / 2 * l;
    return {
        chunk: Math.abs(r - a) / 2 * l / s,
        ratio: e.barPercentage,
        start: c
    };
}
function Aa(i, t, e, s) {
    let n = e.parse(i[0], s), o = e.parse(i[1], s), a = Math.min(n, o), r = Math.max(n, o), l = a, c = r;
    Math.abs(a) > Math.abs(r) && (l = r, c = a), t[e.axis] = c, t._custom = {
        barStart: l,
        barEnd: c,
        start: n,
        end: o,
        min: a,
        max: r
    };
}
function Zn(i, t, e, s) {
    return I1(i) ? Aa(i, t, e, s) : t[e.axis] = e.parse(i, s), t;
}
function cn(i, t, e, s) {
    let n = i.iScale, o = i.vScale, a = n.getLabels(), r = n === o, l = [], c, h, d, u;
    for(c = e, h = e + s; c < h; ++c)u = t[c], d = {}, d[n.axis] = r || n.parse(a[c], c), l.push(Zn(u, d, o, c));
    return l;
}
function Ti(i) {
    return i && i.barStart !== void 0 && i.barEnd !== void 0;
}
function La(i, t, e) {
    return i !== 0 ? nt1(i) : (t.isHorizontal() ? 1 : -1) * (t.min >= e ? 1 : -1);
}
function Ta(i) {
    let t, e, s, n, o;
    return i.horizontal ? (t = i.base > i.x, e = "left", s = "right") : (t = i.base < i.y, e = "bottom", s = "top"), t ? (n = "end", o = "start") : (n = "start", o = "end"), {
        start: e,
        end: s,
        reverse: t,
        top: n,
        bottom: o
    };
}
function Ra(i, t, e, s) {
    let n = t.borderSkipped, o = {};
    if (!n) {
        i.borderSkipped = o;
        return;
    }
    if (n === !0) {
        i.borderSkipped = {
            top: !0,
            right: !0,
            bottom: !0,
            left: !0
        };
        return;
    }
    let { start: a, end: r, reverse: l, top: c, bottom: h } = Ta(i);
    n === "middle" && e && (i.enableBorderRadius = !0, (e._top || 0) === s ? n = c : (e._bottom || 0) === s ? n = h : (o[hn(h, a, r, l)] = !0, n = c)), o[hn(n, a, r, l)] = !0, i.borderSkipped = o;
}
function hn(i, t, e, s) {
    return s ? (i = Ea(i, t, e), i = dn(i, e, t)) : i = dn(i, t, e), i;
}
function Ea(i, t, e) {
    return i === t ? e : i === e ? t : i;
}
function dn(i, t, e) {
    return i === "start" ? t : i === "end" ? e : i;
}
function Ia(i, { inflateAmount: t }, e) {
    i.inflateAmount = t === "auto" ? e === 1 ? .33 : 0 : t;
}
var Wi = class extends dt {
    static id = "bar";
    static defaults = {
        datasetElementType: !1,
        dataElementType: "bar",
        categoryPercentage: .8,
        barPercentage: .9,
        grouped: !0,
        animations: {
            numbers: {
                type: "number",
                properties: [
                    "x",
                    "y",
                    "base",
                    "width",
                    "height"
                ]
            }
        }
    };
    static overrides = {
        scales: {
            _index_: {
                type: "category",
                offset: !0,
                grid: {
                    offset: !0
                }
            },
            _value_: {
                type: "linear",
                beginAtZero: !0
            }
        }
    };
    parsePrimitiveData(t, e, s, n) {
        return cn(t, e, s, n);
    }
    parseArrayData(t, e, s, n) {
        return cn(t, e, s, n);
    }
    parseObjectData(t, e, s, n) {
        let { iScale: o, vScale: a } = t, { xAxisKey: r = "x", yAxisKey: l = "y" } = this._parsing, c = o.axis === "x" ? r : l, h = a.axis === "x" ? r : l, d = [], u, f, p, g;
        for(u = s, f = s + n; u < f; ++u)g = e[u], p = {}, p[o.axis] = o.parse(gt(g, c), u), d.push(Zn(gt(g, h), p, a, u));
        return d;
    }
    updateRangeFromParsed(t, e, s, n) {
        super.updateRangeFromParsed(t, e, s, n);
        let o = s._custom;
        o && e === this._cachedMeta.vScale && (t.min = Math.min(t.min, o.min), t.max = Math.max(t.max, o.max));
    }
    getMaxOverflow() {
        return 0;
    }
    getLabelAndValue(t) {
        let e = this._cachedMeta, { iScale: s, vScale: n } = e, o = this.getParsed(t), a = o._custom, r = Ti(a) ? "[" + a.start + ", " + a.end + "]" : "" + n.getLabelForValue(o[n.axis]);
        return {
            label: "" + s.getLabelForValue(o[s.axis]),
            value: r
        };
    }
    initialize() {
        this.enableOptionSharing = !0, super.initialize();
        let t = this._cachedMeta;
        t.stack = this.getDataset().stack;
    }
    update(t) {
        let e = this._cachedMeta;
        this.updateElements(e.data, 0, e.data.length, t);
    }
    updateElements(t, e, s, n) {
        let o = n === "reset", { index: a, _cachedMeta: { vScale: r } } = this, l = r.getBasePixel(), c = r.isHorizontal(), h = this._getRuler(), { sharedOptions: d, includeOptions: u } = this._getSharedOptions(e, n);
        for(let f = e; f < e + s; f++){
            let p = this.getParsed(f), g = o || A1(p[r.axis]) ? {
                base: l,
                head: l
            } : this._calculateBarValuePixels(f), m = this._calculateBarIndexPixels(f, h), b = (p._stacks || {})[r.axis], _ = {
                horizontal: c,
                base: g.base,
                enableBorderRadius: !b || Ti(p._custom) || a === b._top || a === b._bottom,
                x: c ? g.head : m.center,
                y: c ? m.center : g.head,
                height: c ? m.size : Math.abs(g.size),
                width: c ? Math.abs(g.size) : m.size
            };
            u && (_.options = d || this.resolveDataElementOptions(f, t[f].active ? "active" : n));
            let y = _.options || t[f].options;
            Ra(_, y, b, a), Ia(_, y, h.ratio), this.updateElement(t[f], f, _, n);
        }
    }
    _getStacks(t, e) {
        let { iScale: s } = this._cachedMeta, n = s.getMatchingVisibleMetas(this._type).filter((l)=>l.controller.options.grouped), o = s.options.stacked, a = [], r = (l)=>{
            let c = l.controller.getParsed(e), h = c && c[l.vScale.axis];
            if (A1(h) || isNaN(h)) return !0;
        };
        for (let l of n)if (!(e !== void 0 && r(l)) && ((o === !1 || a.indexOf(l.stack) === -1 || o === void 0 && l.stack === void 0) && a.push(l.stack), l.index === t)) break;
        return a.length || a.push(void 0), a;
    }
    _getStackCount(t) {
        return this._getStacks(void 0, t).length;
    }
    _getStackIndex(t, e, s) {
        let n = this._getStacks(t, s), o = e !== void 0 ? n.indexOf(e) : -1;
        return o === -1 ? n.length - 1 : o;
    }
    _getRuler() {
        let t = this.options, e = this._cachedMeta, s = e.iScale, n = [], o, a;
        for(o = 0, a = e.data.length; o < a; ++o)n.push(s.getPixelForValue(this.getParsed(o)[s.axis], o));
        let r = t.barThickness;
        return {
            min: r || Ca(e),
            pixels: n,
            start: s._startPixel,
            end: s._endPixel,
            stackCount: this._getStackCount(),
            scale: s,
            grouped: t.grouped,
            ratio: r ? 1 : t.categoryPercentage * t.barPercentage
        };
    }
    _calculateBarValuePixels(t) {
        let { _cachedMeta: { vScale: e, _stacked: s, index: n }, options: { base: o, minBarLength: a } } = this, r = o || 0, l = this.getParsed(t), c = l._custom, h = Ti(c), d = l[e.axis], u = 0, f = s ? this.applyStack(e, l, s) : d, p, g;
        f !== d && (u = f - d, f = d), h && (d = c.barStart, f = c.barEnd - c.barStart, d !== 0 && nt1(d) !== nt1(c.barEnd) && (u = 0), u += d);
        let m = !A1(o) && !h ? o : u, b = e.getPixelForValue(m);
        if (this.chart.getDataVisibility(t) ? p = e.getPixelForValue(u + f) : p = b, g = p - b, Math.abs(g) < a) {
            g = La(g, e, r) * a, d === r && (b -= g / 2);
            let _ = e.getPixelForDecimal(0), y = e.getPixelForDecimal(1), v = Math.min(_, y), x = Math.max(_, y);
            b = Math.max(Math.min(b, x), v), p = b + g, s && !h && (l._stacks[e.axis]._visualValues[n] = e.getValueForPixel(p) - e.getValueForPixel(b));
        }
        if (b === e.getPixelForValue(r)) {
            let _ = nt1(g) * e.getLineWidthForValue(r) / 2;
            b += _, g -= _;
        }
        return {
            size: g,
            base: b,
            head: p,
            center: p + g / 2
        };
    }
    _calculateBarIndexPixels(t, e) {
        let s = e.scale, n = this.options, o = n.skipNull, a = P1(n.maxBarThickness, 1 / 0), r, l;
        if (e.grouped) {
            let c = o ? this._getStackCount(t) : e.stackCount, h = n.barThickness === "flex" ? Oa(t, e, n, c) : Da(t, e, n, c), d = this._getStackIndex(this.index, this._cachedMeta.stack, o ? t : void 0);
            r = h.start + h.chunk * d + h.chunk / 2, l = Math.min(a, h.chunk * h.ratio);
        } else r = s.getPixelForValue(this.getParsed(t)[s.axis], t), l = Math.min(a, e.min * e.ratio);
        return {
            base: r - l / 2,
            head: r + l / 2,
            center: r,
            size: l
        };
    }
    draw() {
        let t = this._cachedMeta, e = t.vScale, s = t.data, n = s.length, o = 0;
        for(; o < n; ++o)this.getParsed(o)[e.axis] !== null && s[o].draw(this._ctx);
    }
}, Hi = class extends dt {
    static id = "bubble";
    static defaults = {
        datasetElementType: !1,
        dataElementType: "point",
        animations: {
            numbers: {
                type: "number",
                properties: [
                    "x",
                    "y",
                    "borderWidth",
                    "radius"
                ]
            }
        }
    };
    static overrides = {
        scales: {
            x: {
                type: "linear"
            },
            y: {
                type: "linear"
            }
        }
    };
    initialize() {
        this.enableOptionSharing = !0, super.initialize();
    }
    parsePrimitiveData(t, e, s, n) {
        let o = super.parsePrimitiveData(t, e, s, n);
        for(let a = 0; a < o.length; a++)o[a]._custom = this.resolveDataElementOptions(a + s).radius;
        return o;
    }
    parseArrayData(t, e, s, n) {
        let o = super.parseArrayData(t, e, s, n);
        for(let a = 0; a < o.length; a++){
            let r = e[s + a];
            o[a]._custom = P1(r[2], this.resolveDataElementOptions(a + s).radius);
        }
        return o;
    }
    parseObjectData(t, e, s, n) {
        let o = super.parseObjectData(t, e, s, n);
        for(let a = 0; a < o.length; a++){
            let r = e[s + a];
            o[a]._custom = P1(r && r.r && +r.r, this.resolveDataElementOptions(a + s).radius);
        }
        return o;
    }
    getMaxOverflow() {
        let t = this._cachedMeta.data, e = 0;
        for(let s = t.length - 1; s >= 0; --s)e = Math.max(e, t[s].size(this.resolveDataElementOptions(s)) / 2);
        return e > 0 && e;
    }
    getLabelAndValue(t) {
        let e = this._cachedMeta, s = this.chart.data.labels || [], { xScale: n, yScale: o } = e, a = this.getParsed(t), r = n.getLabelForValue(a.x), l = o.getLabelForValue(a.y), c = a._custom;
        return {
            label: s[t] || "",
            value: "(" + r + ", " + l + (c ? ", " + c : "") + ")"
        };
    }
    update(t) {
        let e = this._cachedMeta.data;
        this.updateElements(e, 0, e.length, t);
    }
    updateElements(t, e, s, n) {
        let o = n === "reset", { iScale: a, vScale: r } = this._cachedMeta, { sharedOptions: l, includeOptions: c } = this._getSharedOptions(e, n), h = a.axis, d = r.axis;
        for(let u = e; u < e + s; u++){
            let f = t[u], p = !o && this.getParsed(u), g = {}, m = g[h] = o ? a.getPixelForDecimal(.5) : a.getPixelForValue(p[h]), b = g[d] = o ? r.getBasePixel() : r.getPixelForValue(p[d]);
            g.skip = isNaN(m) || isNaN(b), c && (g.options = l || this.resolveDataElementOptions(u, f.active ? "active" : n), o && (g.options.radius = 0)), this.updateElement(f, u, g, n);
        }
    }
    resolveDataElementOptions(t, e) {
        let s = this.getParsed(t), n = super.resolveDataElementOptions(t, e);
        n.$shared && (n = Object.assign({}, n, {
            $shared: !1
        }));
        let o = n.radius;
        return e !== "active" && (n.radius = 0), n.radius += P1(s && s._custom, o), n;
    }
};
function za(i, t, e) {
    let s = 1, n = 1, o = 0, a = 0;
    if (t < z1) {
        let r = i, l = r + t, c = Math.cos(r), h = Math.sin(r), d = Math.cos(l), u = Math.sin(l), f = (y, v, x)=>Wt(y, r, l, !0) ? 1 : Math.max(v, v * e, x, x * e), p = (y, v, x)=>Wt(y, r, l, !0) ? -1 : Math.min(v, v * e, x, x * e), g = f(0, c, d), m = f(V1, h, u), b = p(F2, c, d), _ = p(F2 + V1, h, u);
        s = (g - b) / 2, n = (m - _) / 2, o = -(g + b) / 2, a = -(m + _) / 2;
    }
    return {
        ratioX: s,
        ratioY: n,
        offsetX: o,
        offsetY: a
    };
}
var ue = class extends dt {
    static id = "doughnut";
    static defaults = {
        datasetElementType: !1,
        dataElementType: "arc",
        animation: {
            animateRotate: !0,
            animateScale: !1
        },
        animations: {
            numbers: {
                type: "number",
                properties: [
                    "circumference",
                    "endAngle",
                    "innerRadius",
                    "outerRadius",
                    "startAngle",
                    "x",
                    "y",
                    "offset",
                    "borderWidth",
                    "spacing"
                ]
            }
        },
        cutout: "50%",
        rotation: 0,
        circumference: 360,
        radius: "100%",
        spacing: 0,
        indexAxis: "r"
    };
    static descriptors = {
        _scriptable: (t)=>t !== "spacing",
        _indexable: (t)=>t !== "spacing"
    };
    static overrides = {
        aspectRatio: 1,
        plugins: {
            legend: {
                labels: {
                    generateLabels (t) {
                        let e = t.data;
                        if (e.labels.length && e.datasets.length) {
                            let { labels: { pointStyle: s, color: n } } = t.legend.options;
                            return e.labels.map((o, a)=>{
                                let l = t.getDatasetMeta(0).controller.getStyle(a);
                                return {
                                    text: o,
                                    fillStyle: l.backgroundColor,
                                    strokeStyle: l.borderColor,
                                    fontColor: n,
                                    lineWidth: l.borderWidth,
                                    pointStyle: s,
                                    hidden: !t.getDataVisibility(a),
                                    index: a
                                };
                            });
                        }
                        return [];
                    }
                },
                onClick (t, e, s) {
                    s.chart.toggleDataVisibility(e.index), s.chart.update();
                }
            }
        }
    };
    constructor(t, e){
        super(t, e), this.enableOptionSharing = !0, this.innerRadius = void 0, this.outerRadius = void 0, this.offsetX = void 0, this.offsetY = void 0;
    }
    linkScales() {}
    parse(t, e) {
        let s = this.getDataset().data, n = this._cachedMeta;
        if (this._parsing === !1) n._parsed = s;
        else {
            let o = (l)=>+s[l];
            if (O2(s[t])) {
                let { key: l = "value" } = this._parsing;
                o = (c)=>+gt(s[c], l);
            }
            let a, r;
            for(a = t, r = t + e; a < r; ++a)n._parsed[a] = o(a);
        }
    }
    _getRotation() {
        return it1(this.options.rotation - 90);
    }
    _getCircumference() {
        return it1(this.options.circumference);
    }
    _getRotationExtents() {
        let t = z1, e = -z1;
        for(let s = 0; s < this.chart.data.datasets.length; ++s)if (this.chart.isDatasetVisible(s) && this.chart.getDatasetMeta(s).type === this._type) {
            let n = this.chart.getDatasetMeta(s).controller, o = n._getRotation(), a = n._getCircumference();
            t = Math.min(t, o), e = Math.max(e, o + a);
        }
        return {
            rotation: t,
            circumference: e - t
        };
    }
    update(t) {
        let e = this.chart, { chartArea: s } = e, n = this._cachedMeta, o = n.data, a = this.getMaxBorderWidth() + this.getMaxOffset(o) + this.options.spacing, r = Math.max((Math.min(s.width, s.height) - a) / 2, 0), l = Math.min(Ps(this.options.cutout, r), 1), c = this._getRingWeight(this.index), { circumference: h, rotation: d } = this._getRotationExtents(), { ratioX: u, ratioY: f, offsetX: p, offsetY: g } = za(d, h, l), m = (s.width - a) / u, b = (s.height - a) / f, _ = Math.max(Math.min(m, b) / 2, 0), y = si(this.options.radius, _), v = Math.max(y * l, 0), x = (y - v) / this._getVisibleDatasetWeightTotal();
        this.offsetX = p * y, this.offsetY = g * y, n.total = this.calculateTotal(), this.outerRadius = y - x * this._getRingWeightOffset(this.index), this.innerRadius = Math.max(this.outerRadius - x * c, 0), this.updateElements(o, 0, o.length, t);
    }
    _circumference(t, e) {
        let s = this.options, n = this._cachedMeta, o = this._getCircumference();
        return e && s.animation.animateRotate || !this.chart.getDataVisibility(t) || n._parsed[t] === null || n.data[t].hidden ? 0 : this.calculateCircumference(n._parsed[t] * o / z1);
    }
    updateElements(t, e, s, n) {
        let o = n === "reset", a = this.chart, r = a.chartArea, c = a.options.animation, h = (r.left + r.right) / 2, d = (r.top + r.bottom) / 2, u = o && c.animateScale, f = u ? 0 : this.innerRadius, p = u ? 0 : this.outerRadius, { sharedOptions: g, includeOptions: m } = this._getSharedOptions(e, n), b = this._getRotation(), _;
        for(_ = 0; _ < e; ++_)b += this._circumference(_, o);
        for(_ = e; _ < e + s; ++_){
            let y = this._circumference(_, o), v = t[_], x = {
                x: h + this.offsetX,
                y: d + this.offsetY,
                startAngle: b,
                endAngle: b + y,
                circumference: y,
                outerRadius: p,
                innerRadius: f
            };
            m && (x.options = g || this.resolveDataElementOptions(_, v.active ? "active" : n)), b += y, this.updateElement(v, _, x, n);
        }
    }
    calculateTotal() {
        let t = this._cachedMeta, e = t.data, s = 0, n;
        for(n = 0; n < e.length; n++){
            let o = t._parsed[n];
            o !== null && !isNaN(o) && this.chart.getDataVisibility(n) && !e[n].hidden && (s += Math.abs(o));
        }
        return s;
    }
    calculateCircumference(t) {
        let e = this._cachedMeta.total;
        return e > 0 && !isNaN(t) ? z1 * (Math.abs(t) / e) : 0;
    }
    getLabelAndValue(t) {
        let e = this._cachedMeta, s = this.chart, n = s.data.labels || [], o = Ht(e._parsed[t], s.options.locale);
        return {
            label: n[t] || "",
            value: o
        };
    }
    getMaxBorderWidth(t) {
        let e = 0, s = this.chart, n, o, a, r, l;
        if (!t) {
            for(n = 0, o = s.data.datasets.length; n < o; ++n)if (s.isDatasetVisible(n)) {
                a = s.getDatasetMeta(n), t = a.data, r = a.controller;
                break;
            }
        }
        if (!t) return 0;
        for(n = 0, o = t.length; n < o; ++n)l = r.resolveDataElementOptions(n), l.borderAlign !== "inner" && (e = Math.max(e, l.borderWidth || 0, l.hoverBorderWidth || 0));
        return e;
    }
    getMaxOffset(t) {
        let e = 0;
        for(let s = 0, n = t.length; s < n; ++s){
            let o = this.resolveDataElementOptions(s);
            e = Math.max(e, o.offset || 0, o.hoverOffset || 0);
        }
        return e;
    }
    _getRingWeightOffset(t) {
        let e = 0;
        for(let s = 0; s < t; ++s)this.chart.isDatasetVisible(s) && (e += this._getRingWeight(s));
        return e;
    }
    _getRingWeight(t) {
        return Math.max(P1(this.chart.data.datasets[t].weight, 1), 0);
    }
    _getVisibleDatasetWeightTotal() {
        return this._getRingWeightOffset(this.chart.data.datasets.length) || 1;
    }
}, ji = class extends dt {
    static id = "line";
    static defaults = {
        datasetElementType: "line",
        dataElementType: "point",
        showLine: !0,
        spanGaps: !1
    };
    static overrides = {
        scales: {
            _index_: {
                type: "category"
            },
            _value_: {
                type: "linear"
            }
        }
    };
    initialize() {
        this.enableOptionSharing = !0, this.supportsDecimation = !0, super.initialize();
    }
    update(t) {
        let e = this._cachedMeta, { dataset: s, data: n = [], _dataset: o } = e, a = this.chart._animationsDisabled, { start: r, count: l } = fi(e, n, a);
        this._drawStart = r, this._drawCount = l, gi(e) && (r = 0, l = n.length), s._chart = this.chart, s._datasetIndex = this.index, s._decimated = !!o._decimated, s.points = n;
        let c = this.resolveDatasetElementOptions(t);
        this.options.showLine || (c.borderWidth = 0), c.segment = this.options.segment, this.updateElement(s, void 0, {
            animated: !a,
            options: c
        }, t), this.updateElements(n, r, l, t);
    }
    updateElements(t, e, s, n) {
        let o = n === "reset", { iScale: a, vScale: r, _stacked: l, _dataset: c } = this._cachedMeta, { sharedOptions: h, includeOptions: d } = this._getSharedOptions(e, n), u = a.axis, f = r.axis, { spanGaps: p, segment: g } = this.options, m = Dt(p) ? p : Number.POSITIVE_INFINITY, b = this.chart._animationsDisabled || o || n === "none", _ = e + s, y = t.length, v = e > 0 && this.getParsed(e - 1);
        for(let x = 0; x < y; ++x){
            let M = t[x], k = b ? M : {};
            if (x < e || x >= _) {
                k.skip = !0;
                continue;
            }
            let w = this.getParsed(x), S = A1(w[f]), C = k[u] = a.getPixelForValue(w[u], x), D = k[f] = o || S ? r.getBasePixel() : r.getPixelForValue(l ? this.applyStack(r, w, l) : w[f], x);
            k.skip = isNaN(C) || isNaN(D) || S, k.stop = x > 0 && Math.abs(w[u] - v[u]) > m, g && (k.parsed = w, k.raw = c.data[x]), d && (k.options = h || this.resolveDataElementOptions(x, M.active ? "active" : n)), b || this.updateElement(M, x, k, n), v = w;
        }
    }
    getMaxOverflow() {
        let t = this._cachedMeta, e = t.dataset, s = e.options && e.options.borderWidth || 0, n = t.data || [];
        if (!n.length) return s;
        let o = n[0].size(this.resolveDataElementOptions(0)), a = n[n.length - 1].size(this.resolveDataElementOptions(n.length - 1));
        return Math.max(s, o, a) / 2;
    }
    draw() {
        let t = this._cachedMeta;
        t.dataset.updateControlPoints(this.chart.chartArea, t.iScale.axis), super.draw();
    }
}, Ue1 = class extends dt {
    static id = "polarArea";
    static defaults = {
        dataElementType: "arc",
        animation: {
            animateRotate: !0,
            animateScale: !0
        },
        animations: {
            numbers: {
                type: "number",
                properties: [
                    "x",
                    "y",
                    "startAngle",
                    "endAngle",
                    "innerRadius",
                    "outerRadius"
                ]
            }
        },
        indexAxis: "r",
        startAngle: 0
    };
    static overrides = {
        aspectRatio: 1,
        plugins: {
            legend: {
                labels: {
                    generateLabels (t) {
                        let e = t.data;
                        if (e.labels.length && e.datasets.length) {
                            let { labels: { pointStyle: s, color: n } } = t.legend.options;
                            return e.labels.map((o, a)=>{
                                let l = t.getDatasetMeta(0).controller.getStyle(a);
                                return {
                                    text: o,
                                    fillStyle: l.backgroundColor,
                                    strokeStyle: l.borderColor,
                                    fontColor: n,
                                    lineWidth: l.borderWidth,
                                    pointStyle: s,
                                    hidden: !t.getDataVisibility(a),
                                    index: a
                                };
                            });
                        }
                        return [];
                    }
                },
                onClick (t, e, s) {
                    s.chart.toggleDataVisibility(e.index), s.chart.update();
                }
            }
        },
        scales: {
            r: {
                type: "radialLinear",
                angleLines: {
                    display: !1
                },
                beginAtZero: !0,
                grid: {
                    circular: !0
                },
                pointLabels: {
                    display: !1
                },
                startAngle: 0
            }
        }
    };
    constructor(t, e){
        super(t, e), this.innerRadius = void 0, this.outerRadius = void 0;
    }
    getLabelAndValue(t) {
        let e = this._cachedMeta, s = this.chart, n = s.data.labels || [], o = Ht(e._parsed[t].r, s.options.locale);
        return {
            label: n[t] || "",
            value: o
        };
    }
    parseObjectData(t, e, s, n) {
        return Mi.bind(this)(t, e, s, n);
    }
    update(t) {
        let e = this._cachedMeta.data;
        this._updateRadius(), this.updateElements(e, 0, e.length, t);
    }
    getMinMax() {
        let t = this._cachedMeta, e = {
            min: Number.POSITIVE_INFINITY,
            max: Number.NEGATIVE_INFINITY
        };
        return t.data.forEach((s, n)=>{
            let o = this.getParsed(n).r;
            !isNaN(o) && this.chart.getDataVisibility(n) && (o < e.min && (e.min = o), o > e.max && (e.max = o));
        }), e;
    }
    _updateRadius() {
        let t = this.chart, e = t.chartArea, s = t.options, n = Math.min(e.right - e.left, e.bottom - e.top), o = Math.max(n / 2, 0), a = Math.max(s.cutoutPercentage ? o / 100 * s.cutoutPercentage : 1, 0), r = (o - a) / t.getVisibleDatasetCount();
        this.outerRadius = o - r * this.index, this.innerRadius = this.outerRadius - r;
    }
    updateElements(t, e, s, n) {
        let o = n === "reset", a = this.chart, l = a.options.animation, c = this._cachedMeta.rScale, h = c.xCenter, d = c.yCenter, u = c.getIndexAngle(0) - .5 * F2, f = u, p, g = 360 / this.countVisibleElements();
        for(p = 0; p < e; ++p)f += this._computeAngle(p, n, g);
        for(p = e; p < e + s; p++){
            let m = t[p], b = f, _ = f + this._computeAngle(p, n, g), y = a.getDataVisibility(p) ? c.getDistanceFromCenterForValue(this.getParsed(p).r) : 0;
            f = _, o && (l.animateScale && (y = 0), l.animateRotate && (b = _ = u));
            let v = {
                x: h,
                y: d,
                innerRadius: 0,
                outerRadius: y,
                startAngle: b,
                endAngle: _,
                options: this.resolveDataElementOptions(p, m.active ? "active" : n)
            };
            this.updateElement(m, p, v, n);
        }
    }
    countVisibleElements() {
        let t = this._cachedMeta, e = 0;
        return t.data.forEach((s, n)=>{
            !isNaN(this.getParsed(n).r) && this.chart.getDataVisibility(n) && e++;
        }), e;
    }
    _computeAngle(t, e, s) {
        return this.chart.getDataVisibility(t) ? it1(this.resolveDataElementOptions(t, e).angle || s) : 0;
    }
}, $i = class extends ue {
    static id = "pie";
    static defaults = {
        cutout: 0,
        rotation: 0,
        circumference: 360,
        radius: "100%"
    };
}, Ui = class extends dt {
    static id = "radar";
    static defaults = {
        datasetElementType: "line",
        dataElementType: "point",
        indexAxis: "r",
        showLine: !0,
        elements: {
            line: {
                fill: "start"
            }
        }
    };
    static overrides = {
        aspectRatio: 1,
        scales: {
            r: {
                type: "radialLinear"
            }
        }
    };
    getLabelAndValue(t) {
        let e = this._cachedMeta.vScale, s = this.getParsed(t);
        return {
            label: e.getLabels()[t],
            value: "" + e.getLabelForValue(s[e.axis])
        };
    }
    parseObjectData(t, e, s, n) {
        return Mi.bind(this)(t, e, s, n);
    }
    update(t) {
        let e = this._cachedMeta, s = e.dataset, n = e.data || [], o = e.iScale.getLabels();
        if (s.points = n, t !== "resize") {
            let a = this.resolveDatasetElementOptions(t);
            this.options.showLine || (a.borderWidth = 0);
            let r = {
                _loop: !0,
                _fullLoop: o.length === n.length,
                options: a
            };
            this.updateElement(s, void 0, r, t);
        }
        this.updateElements(n, 0, n.length, t);
    }
    updateElements(t, e, s, n) {
        let o = this._cachedMeta.rScale, a = n === "reset";
        for(let r = e; r < e + s; r++){
            let l = t[r], c = this.resolveDataElementOptions(r, l.active ? "active" : n), h = o.getPointPositionForValue(r, this.getParsed(r).r), d = a ? o.xCenter : h.x, u = a ? o.yCenter : h.y, f = {
                x: d,
                y: u,
                angle: h.angle,
                skip: isNaN(d) || isNaN(u),
                options: c
            };
            this.updateElement(l, r, f, n);
        }
    }
}, Yi = class extends dt {
    static id = "scatter";
    static defaults = {
        datasetElementType: !1,
        dataElementType: "point",
        showLine: !1,
        fill: !1
    };
    static overrides = {
        interaction: {
            mode: "point"
        },
        scales: {
            x: {
                type: "linear"
            },
            y: {
                type: "linear"
            }
        }
    };
    getLabelAndValue(t) {
        let e = this._cachedMeta, s = this.chart.data.labels || [], { xScale: n, yScale: o } = e, a = this.getParsed(t), r = n.getLabelForValue(a.x), l = o.getLabelForValue(a.y);
        return {
            label: s[t] || "",
            value: "(" + r + ", " + l + ")"
        };
    }
    update(t) {
        let e = this._cachedMeta, { data: s = [] } = e, n = this.chart._animationsDisabled, { start: o, count: a } = fi(e, s, n);
        if (this._drawStart = o, this._drawCount = a, gi(e) && (o = 0, a = s.length), this.options.showLine) {
            let { dataset: r, _dataset: l } = e;
            r._chart = this.chart, r._datasetIndex = this.index, r._decimated = !!l._decimated, r.points = s;
            let c = this.resolveDatasetElementOptions(t);
            c.segment = this.options.segment, this.updateElement(r, void 0, {
                animated: !n,
                options: c
            }, t);
        }
        this.updateElements(s, o, a, t);
    }
    addElements() {
        let { showLine: t } = this.options;
        !this.datasetElementType && t && (this.datasetElementType = this.chart.registry.getElement("line")), super.addElements();
    }
    updateElements(t, e, s, n) {
        let o = n === "reset", { iScale: a, vScale: r, _stacked: l, _dataset: c } = this._cachedMeta, h = this.resolveDataElementOptions(e, n), d = this.getSharedOptions(h), u = this.includeOptions(n, d), f = a.axis, p = r.axis, { spanGaps: g, segment: m } = this.options, b = Dt(g) ? g : Number.POSITIVE_INFINITY, _ = this.chart._animationsDisabled || o || n === "none", y = e > 0 && this.getParsed(e - 1);
        for(let v = e; v < e + s; ++v){
            let x = t[v], M = this.getParsed(v), k = _ ? x : {}, w = A1(M[p]), S = k[f] = a.getPixelForValue(M[f], v), C = k[p] = o || w ? r.getBasePixel() : r.getPixelForValue(l ? this.applyStack(r, M, l) : M[p], v);
            k.skip = isNaN(S) || isNaN(C) || w, k.stop = v > 0 && Math.abs(M[f] - y[f]) > b, m && (k.parsed = M, k.raw = c.data[v]), u && (k.options = d || this.resolveDataElementOptions(v, x.active ? "active" : n)), _ || this.updateElement(x, v, k, n), y = M;
        }
        this.updateSharedOptions(d, n, h);
    }
    getMaxOverflow() {
        let t = this._cachedMeta, e = t.data || [];
        if (!this.options.showLine) {
            let r = 0;
            for(let l = e.length - 1; l >= 0; --l)r = Math.max(r, e[l].size(this.resolveDataElementOptions(l)) / 2);
            return r > 0 && r;
        }
        let s = t.dataset, n = s.options && s.options.borderWidth || 0;
        if (!e.length) return n;
        let o = e[0].size(this.resolveDataElementOptions(0)), a = e[e.length - 1].size(this.resolveDataElementOptions(e.length - 1));
        return Math.max(n, o, a) / 2;
    }
}, Fa = Object.freeze({
    __proto__: null,
    BarController: Wi,
    BubbleController: Hi,
    DoughnutController: ue,
    LineController: ji,
    PolarAreaController: Ue1,
    PieController: $i,
    RadarController: Ui,
    ScatterController: Yi
});
function At() {
    throw new Error("This method is not implemented: Check that a complete date adapter is provided.");
}
var Xi = class i {
    static override(t) {
        Object.assign(i.prototype, t);
    }
    constructor(t){
        this.options = t || {};
    }
    init() {}
    formats() {
        return At();
    }
    parse() {
        return At();
    }
    format() {
        return At();
    }
    add() {
        return At();
    }
    diff() {
        return At();
    }
    startOf() {
        return At();
    }
    endOf() {
        return At();
    }
}, Ba = {
    _date: Xi
};
function Va(i, t, e, s) {
    let { controller: n, data: o, _sorted: a } = i, r = n._cachedMeta.iScale;
    if (r && t === r.axis && t !== "r" && a && o.length) {
        let l = r._reversePixels ? Ts : at;
        if (s) {
            if (n._sharedOptions) {
                let c = o[0], h = typeof c.getRange == "function" && c.getRange(t);
                if (h) {
                    let d = l(o, t, e - h), u = l(o, t, e + h);
                    return {
                        lo: d.lo,
                        hi: u.hi
                    };
                }
            }
        } else return l(o, t, e);
    }
    return {
        lo: 0,
        hi: o.length - 1
    };
}
function be(i, t, e, s, n) {
    let o = i.getSortedVisibleDatasetMetas(), a = e[t];
    for(let r = 0, l = o.length; r < l; ++r){
        let { index: c, data: h } = o[r], { lo: d, hi: u } = Va(o[r], t, a, n);
        for(let f = d; f <= u; ++f){
            let p = h[f];
            p.skip || s(p, c, f);
        }
    }
}
function Na(i) {
    let t = i.indexOf("x") !== -1, e = i.indexOf("y") !== -1;
    return function(s, n) {
        let o = t ? Math.abs(s.x - n.x) : 0, a = e ? Math.abs(s.y - n.y) : 0;
        return Math.sqrt(Math.pow(o, 2) + Math.pow(a, 2));
    };
}
function Ri(i, t, e, s, n) {
    let o = [];
    return !n && !i.isPointInArea(t) || be(i, e, t, function(r, l, c) {
        !n && !Ft(r, i.chartArea, 0) || r.inRange(t.x, t.y, s) && o.push({
            element: r,
            datasetIndex: l,
            index: c
        });
    }, !0), o;
}
function Wa(i, t, e, s) {
    let n = [];
    function o(a, r, l) {
        let { startAngle: c, endAngle: h } = a.getProps([
            "startAngle",
            "endAngle"
        ], s), { angle: d } = li(a, {
            x: t.x,
            y: t.y
        });
        Wt(d, c, h) && n.push({
            element: a,
            datasetIndex: r,
            index: l
        });
    }
    return be(i, e, t, o), n;
}
function Ha(i, t, e, s, n, o) {
    let a = [], r = Na(e), l = Number.POSITIVE_INFINITY;
    function c(h, d, u) {
        let f = h.inRange(t.x, t.y, n);
        if (s && !f) return;
        let p = h.getCenterPoint(n);
        if (!(!!o || i.isPointInArea(p)) && !f) return;
        let m = r(t, p);
        m < l ? (a = [
            {
                element: h,
                datasetIndex: d,
                index: u
            }
        ], l = m) : m === l && a.push({
            element: h,
            datasetIndex: d,
            index: u
        });
    }
    return be(i, e, t, c), a;
}
function Ei(i, t, e, s, n, o) {
    return !o && !i.isPointInArea(t) ? [] : e === "r" && !s ? Wa(i, t, e, n) : Ha(i, t, e, s, n, o);
}
function un(i, t, e, s, n) {
    let o = [], a = e === "x" ? "inXRange" : "inYRange", r = !1;
    return be(i, e, t, (l, c, h)=>{
        l[a](t[e], n) && (o.push({
            element: l,
            datasetIndex: c,
            index: h
        }), r = r || l.inRange(t.x, t.y, n));
    }), s && !r ? [] : o;
}
var ja = {
    evaluateInteractionItems: be,
    modes: {
        index (i, t, e, s) {
            let n = kt(t, i), o = e.axis || "x", a = e.includeInvisible || !1, r = e.intersect ? Ri(i, n, o, s, a) : Ei(i, n, o, !1, s, a), l = [];
            return r.length ? (i.getSortedVisibleDatasetMetas().forEach((c)=>{
                let h = r[0].index, d = c.data[h];
                d && !d.skip && l.push({
                    element: d,
                    datasetIndex: c.index,
                    index: h
                });
            }), l) : [];
        },
        dataset (i, t, e, s) {
            let n = kt(t, i), o = e.axis || "xy", a = e.includeInvisible || !1, r = e.intersect ? Ri(i, n, o, s, a) : Ei(i, n, o, !1, s, a);
            if (r.length > 0) {
                let l = r[0].datasetIndex, c = i.getDatasetMeta(l).data;
                r = [];
                for(let h = 0; h < c.length; ++h)r.push({
                    element: c[h],
                    datasetIndex: l,
                    index: h
                });
            }
            return r;
        },
        point (i, t, e, s) {
            let n = kt(t, i), o = e.axis || "xy", a = e.includeInvisible || !1;
            return Ri(i, n, o, s, a);
        },
        nearest (i, t, e, s) {
            let n = kt(t, i), o = e.axis || "xy", a = e.includeInvisible || !1;
            return Ei(i, n, o, e.intersect, s, a);
        },
        x (i, t, e, s) {
            let n = kt(t, i);
            return un(i, n, "x", e.intersect, s);
        },
        y (i, t, e, s) {
            let n = kt(t, i);
            return un(i, n, "y", e.intersect, s);
        }
    }
}, to = [
    "left",
    "top",
    "right",
    "bottom"
];
function ae1(i, t) {
    return i.filter((e)=>e.pos === t);
}
function fn(i, t) {
    return i.filter((e)=>to.indexOf(e.pos) === -1 && e.box.axis === t);
}
function re(i, t) {
    return i.sort((e, s)=>{
        let n = t ? s : e, o = t ? e : s;
        return n.weight === o.weight ? n.index - o.index : n.weight - o.weight;
    });
}
function $a(i) {
    let t = [], e, s, n, o, a, r;
    for(e = 0, s = (i || []).length; e < s; ++e)n = i[e], ({ position: o, options: { stack: a, stackWeight: r = 1 } } = n), t.push({
        index: e,
        box: n,
        pos: o,
        horizontal: n.isHorizontal(),
        weight: n.weight,
        stack: a && o + a,
        stackWeight: r
    });
    return t;
}
function Ua(i) {
    let t = {};
    for (let e of i){
        let { stack: s, pos: n, stackWeight: o } = e;
        if (!s || !to.includes(n)) continue;
        let a = t[s] || (t[s] = {
            count: 0,
            placed: 0,
            weight: 0,
            size: 0
        });
        a.count++, a.weight += o;
    }
    return t;
}
function Ya(i, t) {
    let e = Ua(i), { vBoxMaxWidth: s, hBoxMaxHeight: n } = t, o, a, r;
    for(o = 0, a = i.length; o < a; ++o){
        r = i[o];
        let { fullSize: l } = r.box, c = e[r.stack], h = c && r.stackWeight / c.weight;
        r.horizontal ? (r.width = h ? h * s : l && t.availableWidth, r.height = n) : (r.width = s, r.height = h ? h * n : l && t.availableHeight);
    }
    return e;
}
function Xa(i) {
    let t = $a(i), e = re(t.filter((c)=>c.box.fullSize), !0), s = re(ae1(t, "left"), !0), n = re(ae1(t, "right")), o = re(ae1(t, "top"), !0), a = re(ae1(t, "bottom")), r = fn(t, "x"), l = fn(t, "y");
    return {
        fullSize: e,
        leftAndTop: s.concat(o),
        rightAndBottom: n.concat(l).concat(a).concat(r),
        chartArea: ae1(t, "chartArea"),
        vertical: s.concat(n).concat(l),
        horizontal: o.concat(a).concat(r)
    };
}
function gn(i, t, e, s) {
    return Math.max(i[e], t[e]) + Math.max(i[s], t[s]);
}
function eo(i, t) {
    i.top = Math.max(i.top, t.top), i.left = Math.max(i.left, t.left), i.bottom = Math.max(i.bottom, t.bottom), i.right = Math.max(i.right, t.right);
}
function Ka(i, t, e, s) {
    let { pos: n, box: o } = e, a = i.maxPadding;
    if (!O2(n)) {
        e.size && (i[n] -= e.size);
        let d = s[e.stack] || {
            size: 0,
            count: 1
        };
        d.size = Math.max(d.size, e.horizontal ? o.height : o.width), e.size = d.size / d.count, i[n] += e.size;
    }
    o.getPadding && eo(a, o.getPadding());
    let r = Math.max(0, t.outerWidth - gn(a, i, "left", "right")), l = Math.max(0, t.outerHeight - gn(a, i, "top", "bottom")), c = r !== i.w, h = l !== i.h;
    return i.w = r, i.h = l, e.horizontal ? {
        same: c,
        other: h
    } : {
        same: h,
        other: c
    };
}
function qa(i) {
    let t = i.maxPadding;
    function e(s) {
        let n = Math.max(t[s] - i[s], 0);
        return i[s] += n, n;
    }
    i.y += e("top"), i.x += e("left"), e("right"), e("bottom");
}
function Ga(i, t) {
    let e = t.maxPadding;
    function s(n) {
        let o = {
            left: 0,
            top: 0,
            right: 0,
            bottom: 0
        };
        return n.forEach((a)=>{
            o[a] = Math.max(t[a], e[a]);
        }), o;
    }
    return s(i ? [
        "left",
        "right"
    ] : [
        "top",
        "bottom"
    ]);
}
function he(i, t, e, s) {
    let n = [], o, a, r, l, c, h;
    for(o = 0, a = i.length, c = 0; o < a; ++o){
        r = i[o], l = r.box, l.update(r.width || t.w, r.height || t.h, Ga(r.horizontal, t));
        let { same: d, other: u } = Ka(t, e, r, s);
        c |= d && n.length, h = h || u, l.fullSize || n.push(r);
    }
    return c && he(n, t, e, s) || h;
}
function ze(i, t, e, s, n) {
    i.top = e, i.left = t, i.right = t + s, i.bottom = e + n, i.width = s, i.height = n;
}
function pn(i, t, e, s) {
    let n = e.padding, { x: o, y: a } = t;
    for (let r of i){
        let l = r.box, c = s[r.stack] || {
            count: 1,
            placed: 0,
            weight: 1
        }, h = r.stackWeight / c.weight || 1;
        if (r.horizontal) {
            let d = t.w * h, u = c.size || l.height;
            et1(c.start) && (a = c.start), l.fullSize ? ze(l, n.left, a, e.outerWidth - n.right - n.left, u) : ze(l, t.left + c.placed, a, d, u), c.start = a, c.placed += d, a = l.bottom;
        } else {
            let d = t.h * h, u = c.size || l.width;
            et1(c.start) && (o = c.start), l.fullSize ? ze(l, o, n.top, u, e.outerHeight - n.bottom - n.top) : ze(l, o, t.top + c.placed, u, d), c.start = o, c.placed += d, o = l.right;
        }
    }
    t.x = o, t.y = a;
}
var q1 = {
    addBox (i, t) {
        i.boxes || (i.boxes = []), t.fullSize = t.fullSize || !1, t.position = t.position || "top", t.weight = t.weight || 0, t._layers = t._layers || function() {
            return [
                {
                    z: 0,
                    draw (e) {
                        t.draw(e);
                    }
                }
            ];
        }, i.boxes.push(t);
    },
    removeBox (i, t) {
        let e = i.boxes ? i.boxes.indexOf(t) : -1;
        e !== -1 && i.boxes.splice(e, 1);
    },
    configure (i, t, e) {
        t.fullSize = e.fullSize, t.position = e.position, t.weight = e.weight;
    },
    update (i, t, e, s) {
        if (!i) return;
        let n = X2(i.options.layout.padding), o = Math.max(t - n.width, 0), a = Math.max(e - n.height, 0), r = Xa(i.boxes), l = r.vertical, c = r.horizontal;
        T2(i.boxes, (g)=>{
            typeof g.beforeLayout == "function" && g.beforeLayout();
        });
        let h = l.reduce((g, m)=>m.box.options && m.box.options.display === !1 ? g : g + 1, 0) || 1, d = Object.freeze({
            outerWidth: t,
            outerHeight: e,
            padding: n,
            availableWidth: o,
            availableHeight: a,
            vBoxMaxWidth: o / 2 / h,
            hBoxMaxHeight: a / 2
        }), u = Object.assign({}, n);
        eo(u, X2(s));
        let f = Object.assign({
            maxPadding: u,
            w: o,
            h: a,
            x: n.left,
            y: n.top
        }, n), p = Ya(l.concat(c), d);
        he(r.fullSize, f, d, p), he(l, f, d, p), he(c, f, d, p) && he(l, f, d, p), qa(f), pn(r.leftAndTop, f, d, p), f.x += f.w, f.y += f.h, pn(r.rightAndBottom, f, d, p), i.chartArea = {
            left: f.left,
            top: f.top,
            right: f.left + f.w,
            bottom: f.top + f.h,
            height: f.h,
            width: f.w
        }, T2(r.chartArea, (g)=>{
            let m = g.box;
            Object.assign(m, i.chartArea), m.update(f.w, f.h, {
                left: 0,
                top: 0,
                right: 0,
                bottom: 0
            });
        });
    }
}, Ye1 = class {
    acquireContext(t, e) {}
    releaseContext(t) {
        return !1;
    }
    addEventListener(t, e, s) {}
    removeEventListener(t, e, s) {}
    getDevicePixelRatio() {
        return 1;
    }
    getMaximumSize(t, e, s, n) {
        return e = Math.max(0, e || t.width), s = s || t.height, {
            width: e,
            height: Math.max(0, n ? Math.floor(e / n) : s)
        };
    }
    isAttached(t) {
        return !0;
    }
    updateConfig(t) {}
}, Ki = class extends Ye1 {
    acquireContext(t) {
        return t && t.getContext && t.getContext("2d") || null;
    }
    updateConfig(t) {
        t.options.animation = !1;
    }
}, He = "$chartjs", Ja = {
    touchstart: "mousedown",
    touchmove: "mousemove",
    touchend: "mouseup",
    pointerenter: "mouseenter",
    pointerdown: "mousedown",
    pointermove: "mousemove",
    pointerup: "mouseup",
    pointerleave: "mouseout",
    pointerout: "mouseout"
}, mn = (i)=>i === null || i === "";
function Qa(i, t) {
    let e = i.style, s = i.getAttribute("height"), n = i.getAttribute("width");
    if (i[He] = {
        initial: {
            height: s,
            width: n,
            style: {
                display: e.display,
                height: e.height,
                width: e.width
            }
        }
    }, e.display = e.display || "block", e.boxSizing = e.boxSizing || "border-box", mn(n)) {
        let o = Si(i, "width");
        o !== void 0 && (i.width = o);
    }
    if (mn(s)) if (i.style.height === "") i.height = i.width / (t || 2);
    else {
        let o = Si(i, "height");
        o !== void 0 && (i.height = o);
    }
    return i;
}
var io = Gs ? {
    passive: !0
} : !1;
function Za(i, t, e) {
    i.addEventListener(t, e, io);
}
function tr(i, t, e) {
    i.canvas.removeEventListener(t, e, io);
}
function er(i, t) {
    let e = Ja[i.type] || i.type, { x: s, y: n } = kt(i, t);
    return {
        type: e,
        chart: t,
        native: i,
        x: s !== void 0 ? s : null,
        y: n !== void 0 ? n : null
    };
}
function Xe1(i, t) {
    for (let e of i)if (e === t || e.contains(t)) return !0;
}
function ir(i, t, e) {
    let s = i.canvas, n = new MutationObserver((o)=>{
        let a = !1;
        for (let r of o)a = a || Xe1(r.addedNodes, s), a = a && !Xe1(r.removedNodes, s);
        a && e();
    });
    return n.observe(document, {
        childList: !0,
        subtree: !0
    }), n;
}
function sr(i, t, e) {
    let s = i.canvas, n = new MutationObserver((o)=>{
        let a = !1;
        for (let r of o)a = a || Xe1(r.removedNodes, s), a = a && !Xe1(r.addedNodes, s);
        a && e();
    });
    return n.observe(document, {
        childList: !0,
        subtree: !0
    }), n;
}
var fe = new Map, bn = 0;
function so() {
    let i = window.devicePixelRatio;
    i !== bn && (bn = i, fe.forEach((t, e)=>{
        e.currentDevicePixelRatio !== i && t();
    }));
}
function nr(i, t) {
    fe.size || window.addEventListener("resize", so), fe.set(i, t);
}
function or(i) {
    fe.delete(i), fe.size || window.removeEventListener("resize", so);
}
function ar(i, t, e) {
    let s = i.canvas, n = s && Ee(s);
    if (!n) return;
    let o = ui((r, l)=>{
        let c = n.clientWidth;
        e(r, l), c < n.clientWidth && e();
    }, window), a = new ResizeObserver((r)=>{
        let l = r[0], c = l.contentRect.width, h = l.contentRect.height;
        c === 0 && h === 0 || o(c, h);
    });
    return a.observe(n), nr(i, o), a;
}
function Ii(i, t, e) {
    e && e.disconnect(), t === "resize" && or(i);
}
function rr(i, t, e) {
    let s = i.canvas, n = ui((o)=>{
        i.ctx !== null && e(er(o, i));
    }, i);
    return Za(s, t, n), n;
}
var qi = class extends Ye1 {
    acquireContext(t, e) {
        let s = t && t.getContext && t.getContext("2d");
        return s && s.canvas === t ? (Qa(t, e), s) : null;
    }
    releaseContext(t) {
        let e = t.canvas;
        if (!e[He]) return !1;
        let s = e[He].initial;
        [
            "height",
            "width"
        ].forEach((o)=>{
            let a = s[o];
            A1(a) ? e.removeAttribute(o) : e.setAttribute(o, a);
        });
        let n = s.style || {};
        return Object.keys(n).forEach((o)=>{
            e.style[o] = n[o];
        }), e.width = e.width, delete e[He], !0;
    }
    addEventListener(t, e, s) {
        this.removeEventListener(t, e);
        let n = t.$proxies || (t.$proxies = {}), a = {
            attach: ir,
            detach: sr,
            resize: ar
        }[e] || rr;
        n[e] = a(t, e, s);
    }
    removeEventListener(t, e) {
        let s = t.$proxies || (t.$proxies = {}), n = s[e];
        if (!n) return;
        (({
            attach: Ii,
            detach: Ii,
            resize: Ii
        })[e] || tr)(t, e, n), s[e] = void 0;
    }
    getDevicePixelRatio() {
        return window.devicePixelRatio;
    }
    getMaximumSize(t, e, s, n) {
        return qs(t, e, s, n);
    }
    isAttached(t) {
        let e = Ee(t);
        return !!(e && e.isConnected);
    }
};
function lr(i) {
    return !ki() || typeof OffscreenCanvas < "u" && i instanceof OffscreenCanvas ? Ki : qi;
}
var ot1 = class {
    static defaults = {};
    static defaultRoutes = void 0;
    active = !1;
    tooltipPosition(t) {
        let { x: e, y: s } = this.getProps([
            "x",
            "y"
        ], t);
        return {
            x: e,
            y: s
        };
    }
    hasValue() {
        return Dt(this.x) && Dt(this.y);
    }
    getProps(t, e) {
        let s = this.$animations;
        if (!e || !s) return this;
        let n = {};
        return t.forEach((o)=>{
            n[o] = s[o] && s[o].active() ? s[o]._to : this[o];
        }), n;
    }
};
function cr(i, t) {
    let e = i.options.ticks, s = hr(i), n = Math.min(e.maxTicksLimit || s, s), o = e.major.enabled ? ur(t) : [], a = o.length, r = o[0], l = o[a - 1], c = [];
    if (a > n) return fr(t, c, o, a / n), c;
    let h = dr(o, t, n);
    if (a > 0) {
        let d, u, f = a > 1 ? Math.round((l - r) / (a - 1)) : null;
        for(Fe(t, c, h, A1(f) ? 0 : r - f, r), d = 0, u = a - 1; d < u; d++)Fe(t, c, h, o[d], o[d + 1]);
        return Fe(t, c, h, l, A1(f) ? t.length : l + f), c;
    }
    return Fe(t, c, h), c;
}
function hr(i) {
    let t = i.options.offset, e = i._tickSize(), s = i._length / e + (t ? 0 : 1), n = i._maxLength / e;
    return Math.floor(Math.min(s, n));
}
function dr(i, t, e) {
    let s = gr(i), n = t.length / e;
    if (!s) return Math.max(n, 1);
    let o = Os(s);
    for(let a = 0, r = o.length - 1; a < r; a++){
        let l = o[a];
        if (l > n) return l;
    }
    return Math.max(n, 1);
}
function ur(i) {
    let t = [], e, s;
    for(e = 0, s = i.length; e < s; e++)i[e].major && t.push(e);
    return t;
}
function fr(i, t, e, s) {
    let n = 0, o = e[0], a;
    for(s = Math.ceil(s), a = 0; a < i.length; a++)a === o && (t.push(i[a]), n++, o = e[n * s]);
}
function Fe(i, t, e, s, n) {
    let o = P1(s, 0), a = Math.min(P1(n, i.length), i.length), r = 0, l, c, h;
    for(e = Math.ceil(e), n && (l = n - s, e = l / Math.floor(l / e)), h = o; h < 0;)r++, h = Math.round(o + r * e);
    for(c = Math.max(o, 0); c < a; c++)c === h && (t.push(i[c]), r++, h = Math.round(o + r * e));
}
function gr(i) {
    let t = i.length, e, s;
    if (t < 2) return !1;
    for(s = i[0], e = 1; e < t; ++e)if (i[e] - i[e - 1] !== s) return !1;
    return s;
}
var pr = (i)=>i === "left" ? "right" : i === "right" ? "left" : i, _n = (i, t, e)=>t === "top" || t === "left" ? i[t] + e : i[t] - e;
function xn(i, t) {
    let e = [], s = i.length / t, n = i.length, o = 0;
    for(; o < n; o += s)e.push(i[Math.floor(o)]);
    return e;
}
function mr(i, t, e) {
    let s = i.ticks.length, n = Math.min(t, s - 1), o = i._startPixel, a = i._endPixel, r = 1e-6, l = i.getPixelForTick(n), c;
    if (!(e && (s === 1 ? c = Math.max(l - o, a - l) : t === 0 ? c = (i.getPixelForTick(1) - l) / 2 : c = (l - i.getPixelForTick(n - 1)) / 2, l += n < t ? c : -c, l < o - r || l > a + r))) return l;
}
function br(i, t) {
    T2(i, (e)=>{
        let s = e.gc, n = s.length / 2, o;
        if (n > t) {
            for(o = 0; o < n; ++o)delete e.data[s[o]];
            s.splice(0, n);
        }
    });
}
function le(i) {
    return i.drawTicks ? i.tickLength : 0;
}
function yn(i, t) {
    if (!i.display) return 0;
    let e = j1(i.font, t), s = X2(i.padding);
    return (I1(i.text) ? i.text.length : 1) * e.lineHeight + s.height;
}
function _r(i, t) {
    return pt(i, {
        scale: t,
        type: "scale"
    });
}
function xr(i, t, e) {
    return pt(i, {
        tick: e,
        index: t,
        type: "tick"
    });
}
function yr(i, t, e) {
    let s = Oe(i);
    return (e && t !== "right" || !e && t === "right") && (s = pr(s)), s;
}
function vr(i, t, e, s) {
    let { top: n, left: o, bottom: a, right: r, chart: l } = i, { chartArea: c, scales: h } = l, d = 0, u, f, p, g = a - n, m = r - o;
    if (i.isHorizontal()) {
        if (f = Y2(s, o, r), O2(e)) {
            let b = Object.keys(e)[0], _ = e[b];
            p = h[b].getPixelForValue(_) + g - t;
        } else e === "center" ? p = (c.bottom + c.top) / 2 + g - t : p = _n(i, e, t);
        u = r - o;
    } else {
        if (O2(e)) {
            let b = Object.keys(e)[0], _ = e[b];
            f = h[b].getPixelForValue(_) - m + t;
        } else e === "center" ? f = (c.left + c.right) / 2 - m + t : f = _n(i, e, t);
        p = Y2(s, a, n), d = e === "left" ? -V1 : V1;
    }
    return {
        titleX: f,
        titleY: p,
        maxWidth: u,
        rotation: d
    };
}
var Tt = class i extends ot1 {
    constructor(t){
        super(), this.id = t.id, this.type = t.type, this.options = void 0, this.ctx = t.ctx, this.chart = t.chart, this.top = void 0, this.bottom = void 0, this.left = void 0, this.right = void 0, this.width = void 0, this.height = void 0, this._margins = {
            left: 0,
            right: 0,
            top: 0,
            bottom: 0
        }, this.maxWidth = void 0, this.maxHeight = void 0, this.paddingTop = void 0, this.paddingBottom = void 0, this.paddingLeft = void 0, this.paddingRight = void 0, this.axis = void 0, this.labelRotation = void 0, this.min = void 0, this.max = void 0, this._range = void 0, this.ticks = [], this._gridLineItems = null, this._labelItems = null, this._labelSizes = null, this._length = 0, this._maxLength = 0, this._longestTextCache = {}, this._startPixel = void 0, this._endPixel = void 0, this._reversePixels = !1, this._userMax = void 0, this._userMin = void 0, this._suggestedMax = void 0, this._suggestedMin = void 0, this._ticksLength = 0, this._borderValue = 0, this._cache = {}, this._dataLimitsCached = !1, this.$context = void 0;
    }
    init(t) {
        this.options = t.setContext(this.getContext()), this.axis = t.axis, this._userMin = this.parse(t.min), this._userMax = this.parse(t.max), this._suggestedMin = this.parse(t.suggestedMin), this._suggestedMax = this.parse(t.suggestedMax);
    }
    parse(t, e) {
        return t;
    }
    getUserBounds() {
        let { _userMin: t, _userMax: e, _suggestedMin: s, _suggestedMax: n } = this;
        return t = J1(t, Number.POSITIVE_INFINITY), e = J1(e, Number.NEGATIVE_INFINITY), s = J1(s, Number.POSITIVE_INFINITY), n = J1(n, Number.NEGATIVE_INFINITY), {
            min: J1(t, s),
            max: J1(e, n),
            minDefined: N2(t),
            maxDefined: N2(e)
        };
    }
    getMinMax(t) {
        let { min: e, max: s, minDefined: n, maxDefined: o } = this.getUserBounds(), a;
        if (n && o) return {
            min: e,
            max: s
        };
        let r = this.getMatchingVisibleMetas();
        for(let l = 0, c = r.length; l < c; ++l)a = r[l].controller.getMinMax(this, t), n || (e = Math.min(e, a.min)), o || (s = Math.max(s, a.max));
        return e = o && e > s ? s : e, s = n && e > s ? e : s, {
            min: J1(e, J1(s, e)),
            max: J1(s, J1(e, s))
        };
    }
    getPadding() {
        return {
            left: this.paddingLeft || 0,
            top: this.paddingTop || 0,
            right: this.paddingRight || 0,
            bottom: this.paddingBottom || 0
        };
    }
    getTicks() {
        return this.ticks;
    }
    getLabels() {
        let t = this.chart.data;
        return this.options.labels || (this.isHorizontal() ? t.xLabels : t.yLabels) || t.labels || [];
    }
    getLabelItems(t = this.chart.chartArea) {
        return this._labelItems || (this._labelItems = this._computeLabelItems(t));
    }
    beforeLayout() {
        this._cache = {}, this._dataLimitsCached = !1;
    }
    beforeUpdate() {
        E1(this.options.beforeUpdate, [
            this
        ]);
    }
    update(t, e, s) {
        let { beginAtZero: n, grace: o, ticks: a } = this.options, r = a.sampleSize;
        this.beforeUpdate(), this.maxWidth = t, this.maxHeight = e, this._margins = s = Object.assign({
            left: 0,
            right: 0,
            top: 0,
            bottom: 0
        }, s), this.ticks = null, this._labelSizes = null, this._gridLineItems = null, this._labelItems = null, this.beforeSetDimensions(), this.setDimensions(), this.afterSetDimensions(), this._maxLength = this.isHorizontal() ? this.width + s.left + s.right : this.height + s.top + s.bottom, this._dataLimitsCached || (this.beforeDataLimits(), this.determineDataLimits(), this.afterDataLimits(), this._range = js(this, o, n), this._dataLimitsCached = !0), this.beforeBuildTicks(), this.ticks = this.buildTicks() || [], this.afterBuildTicks();
        let l = r < this.ticks.length;
        this._convertTicksToLabels(l ? xn(this.ticks, r) : this.ticks), this.configure(), this.beforeCalculateLabelRotation(), this.calculateLabelRotation(), this.afterCalculateLabelRotation(), a.display && (a.autoSkip || a.source === "auto") && (this.ticks = cr(this, this.ticks), this._labelSizes = null, this.afterAutoSkip()), l && this._convertTicksToLabels(this.ticks), this.beforeFit(), this.fit(), this.afterFit(), this.afterUpdate();
    }
    configure() {
        let t = this.options.reverse, e, s;
        this.isHorizontal() ? (e = this.left, s = this.right) : (e = this.top, s = this.bottom, t = !t), this._startPixel = e, this._endPixel = s, this._reversePixels = t, this._length = s - e, this._alignToPixels = this.options.alignToPixels;
    }
    afterUpdate() {
        E1(this.options.afterUpdate, [
            this
        ]);
    }
    beforeSetDimensions() {
        E1(this.options.beforeSetDimensions, [
            this
        ]);
    }
    setDimensions() {
        this.isHorizontal() ? (this.width = this.maxWidth, this.left = 0, this.right = this.width) : (this.height = this.maxHeight, this.top = 0, this.bottom = this.height), this.paddingLeft = 0, this.paddingTop = 0, this.paddingRight = 0, this.paddingBottom = 0;
    }
    afterSetDimensions() {
        E1(this.options.afterSetDimensions, [
            this
        ]);
    }
    _callHooks(t) {
        this.chart.notifyPlugins(t, this.getContext()), E1(this.options[t], [
            this
        ]);
    }
    beforeDataLimits() {
        this._callHooks("beforeDataLimits");
    }
    determineDataLimits() {}
    afterDataLimits() {
        this._callHooks("afterDataLimits");
    }
    beforeBuildTicks() {
        this._callHooks("beforeBuildTicks");
    }
    buildTicks() {
        return [];
    }
    afterBuildTicks() {
        this._callHooks("afterBuildTicks");
    }
    beforeTickToLabelConversion() {
        E1(this.options.beforeTickToLabelConversion, [
            this
        ]);
    }
    generateTickLabels(t) {
        let e = this.options.ticks, s, n, o;
        for(s = 0, n = t.length; s < n; s++)o = t[s], o.label = E1(e.callback, [
            o.value,
            s,
            t
        ], this);
    }
    afterTickToLabelConversion() {
        E1(this.options.afterTickToLabelConversion, [
            this
        ]);
    }
    beforeCalculateLabelRotation() {
        E1(this.options.beforeCalculateLabelRotation, [
            this
        ]);
    }
    calculateLabelRotation() {
        let t = this.options, e = t.ticks, s = this.ticks.length, n = e.minRotation || 0, o = e.maxRotation, a = n, r, l, c;
        if (!this._isVisible() || !e.display || n >= o || s <= 1 || !this.isHorizontal()) {
            this.labelRotation = n;
            return;
        }
        let h = this._getLabelSizes(), d = h.widest.width, u = h.highest.height, f = $2(this.chart.width - d, 0, this.maxWidth);
        r = t.offset ? this.maxWidth / s : f / (s - 1), d + 6 > r && (r = f / (s - (t.offset ? .5 : 1)), l = this.maxHeight - le(t.grid) - e.padding - yn(t.title, this.chart.options.font), c = Math.sqrt(d * d + u * u), a = Ce(Math.min(Math.asin($2((h.highest.height + 6) / r, -1, 1)), Math.asin($2(l / c, -1, 1)) - Math.asin($2(u / c, -1, 1)))), a = Math.max(n, Math.min(o, a))), this.labelRotation = a;
    }
    afterCalculateLabelRotation() {
        E1(this.options.afterCalculateLabelRotation, [
            this
        ]);
    }
    afterAutoSkip() {}
    beforeFit() {
        E1(this.options.beforeFit, [
            this
        ]);
    }
    fit() {
        let t = {
            width: 0,
            height: 0
        }, { chart: e, options: { ticks: s, title: n, grid: o } } = this, a = this._isVisible(), r = this.isHorizontal();
        if (a) {
            let l = yn(n, e.options.font);
            if (r ? (t.width = this.maxWidth, t.height = le(o) + l) : (t.height = this.maxHeight, t.width = le(o) + l), s.display && this.ticks.length) {
                let { first: c, last: h, widest: d, highest: u } = this._getLabelSizes(), f = s.padding * 2, p = it1(this.labelRotation), g = Math.cos(p), m = Math.sin(p);
                if (r) {
                    let b = s.mirror ? 0 : m * d.width + g * u.height;
                    t.height = Math.min(this.maxHeight, t.height + b + f);
                } else {
                    let b = s.mirror ? 0 : g * d.width + m * u.height;
                    t.width = Math.min(this.maxWidth, t.width + b + f);
                }
                this._calculatePadding(c, h, m, g);
            }
        }
        this._handleMargins(), r ? (this.width = this._length = e.width - this._margins.left - this._margins.right, this.height = t.height) : (this.width = t.width, this.height = this._length = e.height - this._margins.top - this._margins.bottom);
    }
    _calculatePadding(t, e, s, n) {
        let { ticks: { align: o, padding: a }, position: r } = this.options, l = this.labelRotation !== 0, c = r !== "top" && this.axis === "x";
        if (this.isHorizontal()) {
            let h = this.getPixelForTick(0) - this.left, d = this.right - this.getPixelForTick(this.ticks.length - 1), u = 0, f = 0;
            l ? c ? (u = n * t.width, f = s * e.height) : (u = s * t.height, f = n * e.width) : o === "start" ? f = e.width : o === "end" ? u = t.width : o !== "inner" && (u = t.width / 2, f = e.width / 2), this.paddingLeft = Math.max((u - h + a) * this.width / (this.width - h), 0), this.paddingRight = Math.max((f - d + a) * this.width / (this.width - d), 0);
        } else {
            let h = e.height / 2, d = t.height / 2;
            o === "start" ? (h = 0, d = t.height) : o === "end" && (h = e.height, d = 0), this.paddingTop = h + a, this.paddingBottom = d + a;
        }
    }
    _handleMargins() {
        this._margins && (this._margins.left = Math.max(this.paddingLeft, this._margins.left), this._margins.top = Math.max(this.paddingTop, this._margins.top), this._margins.right = Math.max(this.paddingRight, this._margins.right), this._margins.bottom = Math.max(this.paddingBottom, this._margins.bottom));
    }
    afterFit() {
        E1(this.options.afterFit, [
            this
        ]);
    }
    isHorizontal() {
        let { axis: t, position: e } = this.options;
        return e === "top" || e === "bottom" || t === "x";
    }
    isFullSize() {
        return this.options.fullSize;
    }
    _convertTicksToLabels(t) {
        this.beforeTickToLabelConversion(), this.generateTickLabels(t);
        let e, s;
        for(e = 0, s = t.length; e < s; e++)A1(t[e].label) && (t.splice(e, 1), s--, e--);
        this.afterTickToLabelConversion();
    }
    _getLabelSizes() {
        let t = this._labelSizes;
        if (!t) {
            let e = this.options.ticks.sampleSize, s = this.ticks;
            e < s.length && (s = xn(s, e)), this._labelSizes = t = this._computeLabelSizes(s, s.length);
        }
        return t;
    }
    _computeLabelSizes(t, e) {
        let { ctx: s, _longestTextCache: n } = this, o = [], a = [], r = 0, l = 0, c, h, d, u, f, p, g, m, b, _, y;
        for(c = 0; c < e; ++c){
            if (u = t[c].label, f = this._resolveTickFontOptions(c), s.font = p = f.string, g = n[p] = n[p] || {
                data: {},
                gc: []
            }, m = f.lineHeight, b = _ = 0, !A1(u) && !I1(u)) b = ee1(s, g.data, g.gc, b, u), _ = m;
            else if (I1(u)) for(h = 0, d = u.length; h < d; ++h)y = u[h], !A1(y) && !I1(y) && (b = ee1(s, g.data, g.gc, b, y), _ += m);
            o.push(b), a.push(_), r = Math.max(b, r), l = Math.max(_, l);
        }
        br(n, e);
        let v = o.indexOf(r), x = a.indexOf(l), M = (k)=>({
                width: o[k] || 0,
                height: a[k] || 0
            });
        return {
            first: M(0),
            last: M(e - 1),
            widest: M(v),
            highest: M(x),
            widths: o,
            heights: a
        };
    }
    getLabelForValue(t) {
        return t;
    }
    getPixelForValue(t, e) {
        return NaN;
    }
    getValueForPixel(t) {}
    getPixelForTick(t) {
        let e = this.ticks;
        return t < 0 || t > e.length - 1 ? null : this.getPixelForValue(e[t].value);
    }
    getPixelForDecimal(t) {
        this._reversePixels && (t = 1 - t);
        let e = this._startPixel + t * this._length;
        return Ls(this._alignToPixels ? yt(this.chart, e, 0) : e);
    }
    getDecimalForPixel(t) {
        let e = (t - this._startPixel) / this._length;
        return this._reversePixels ? 1 - e : e;
    }
    getBasePixel() {
        return this.getPixelForValue(this.getBaseValue());
    }
    getBaseValue() {
        let { min: t, max: e } = this;
        return t < 0 && e < 0 ? e : t > 0 && e > 0 ? t : 0;
    }
    getContext(t) {
        let e = this.ticks || [];
        if (t >= 0 && t < e.length) {
            let s = e[t];
            return s.$context || (s.$context = xr(this.getContext(), t, s));
        }
        return this.$context || (this.$context = _r(this.chart.getContext(), this));
    }
    _tickSize() {
        let t = this.options.ticks, e = it1(this.labelRotation), s = Math.abs(Math.cos(e)), n = Math.abs(Math.sin(e)), o = this._getLabelSizes(), a = t.autoSkipPadding || 0, r = o ? o.widest.width + a : 0, l = o ? o.highest.height + a : 0;
        return this.isHorizontal() ? l * s > r * n ? r / s : l / n : l * n < r * s ? l / s : r / n;
    }
    _isVisible() {
        let t = this.options.display;
        return t !== "auto" ? !!t : this.getMatchingVisibleMetas().length > 0;
    }
    _computeGridLineItems(t) {
        let e = this.axis, s = this.chart, n = this.options, { grid: o, position: a, border: r } = n, l = o.offset, c = this.isHorizontal(), d = this.ticks.length + (l ? 1 : 0), u = le(o), f = [], p = r.setContext(this.getContext()), g = p.display ? p.width : 0, m = g / 2, b = function(B) {
            return yt(s, B, g);
        }, _, y, v, x, M, k, w, S, C, D, L, U;
        if (a === "top") _ = b(this.bottom), k = this.bottom - u, S = _ - m, D = b(t.top) + m, U = t.bottom;
        else if (a === "bottom") _ = b(this.top), D = t.top, U = b(t.bottom) - m, k = _ + m, S = this.top + u;
        else if (a === "left") _ = b(this.right), M = this.right - u, w = _ - m, C = b(t.left) + m, L = t.right;
        else if (a === "right") _ = b(this.left), C = t.left, L = b(t.right) - m, M = _ + m, w = this.left + u;
        else if (e === "x") {
            if (a === "center") _ = b((t.top + t.bottom) / 2 + .5);
            else if (O2(a)) {
                let B = Object.keys(a)[0], H = a[B];
                _ = b(this.chart.scales[B].getPixelForValue(H));
            }
            D = t.top, U = t.bottom, k = _ + m, S = k + u;
        } else if (e === "y") {
            if (a === "center") _ = b((t.left + t.right) / 2);
            else if (O2(a)) {
                let B = Object.keys(a)[0], H = a[B];
                _ = b(this.chart.scales[B].getPixelForValue(H));
            }
            M = _ - m, w = M - u, C = t.left, L = t.right;
        }
        let tt = P1(n.ticks.maxTicksLimit, d), R = Math.max(1, Math.ceil(d / tt));
        for(y = 0; y < d; y += R){
            let B = this.getContext(y), H = o.setContext(B), st = r.setContext(B), K = H.lineWidth, Rt = H.color, _e = st.dash || [], Et = st.dashOffset, Gt = H.tickWidth, Jt = H.tickColor, Qt = H.tickBorderDash || [], Zt = H.tickBorderDashOffset;
            v = mr(this, y, l), v !== void 0 && (x = yt(s, v, K), c ? M = w = C = L = x : k = S = D = U = x, f.push({
                tx1: M,
                ty1: k,
                tx2: w,
                ty2: S,
                x1: C,
                y1: D,
                x2: L,
                y2: U,
                width: K,
                color: Rt,
                borderDash: _e,
                borderDashOffset: Et,
                tickWidth: Gt,
                tickColor: Jt,
                tickBorderDash: Qt,
                tickBorderDashOffset: Zt
            }));
        }
        return this._ticksLength = d, this._borderValue = _, f;
    }
    _computeLabelItems(t) {
        let e = this.axis, s = this.options, { position: n, ticks: o } = s, a = this.isHorizontal(), r = this.ticks, { align: l, crossAlign: c, padding: h, mirror: d } = o, u = le(s.grid), f = u + h, p = d ? -h : f, g = -it1(this.labelRotation), m = [], b, _, y, v, x, M, k, w, S, C, D, L, U = "middle";
        if (n === "top") M = this.bottom - p, k = this._getXAxisLabelAlignment();
        else if (n === "bottom") M = this.top + p, k = this._getXAxisLabelAlignment();
        else if (n === "left") {
            let R = this._getYAxisLabelAlignment(u);
            k = R.textAlign, x = R.x;
        } else if (n === "right") {
            let R = this._getYAxisLabelAlignment(u);
            k = R.textAlign, x = R.x;
        } else if (e === "x") {
            if (n === "center") M = (t.top + t.bottom) / 2 + f;
            else if (O2(n)) {
                let R = Object.keys(n)[0], B = n[R];
                M = this.chart.scales[R].getPixelForValue(B) + f;
            }
            k = this._getXAxisLabelAlignment();
        } else if (e === "y") {
            if (n === "center") x = (t.left + t.right) / 2 - f;
            else if (O2(n)) {
                let R = Object.keys(n)[0], B = n[R];
                x = this.chart.scales[R].getPixelForValue(B);
            }
            k = this._getYAxisLabelAlignment(u).textAlign;
        }
        e === "y" && (l === "start" ? U = "top" : l === "end" && (U = "bottom"));
        let tt = this._getLabelSizes();
        for(b = 0, _ = r.length; b < _; ++b){
            y = r[b], v = y.label;
            let R = o.setContext(this.getContext(b));
            w = this.getPixelForTick(b) + o.labelOffset, S = this._resolveTickFontOptions(b), C = S.lineHeight, D = I1(v) ? v.length : 1;
            let B = D / 2, H = R.color, st = R.textStrokeColor, K = R.textStrokeWidth, Rt = k;
            a ? (x = w, k === "inner" && (b === _ - 1 ? Rt = this.options.reverse ? "left" : "right" : b === 0 ? Rt = this.options.reverse ? "right" : "left" : Rt = "center"), n === "top" ? c === "near" || g !== 0 ? L = -D * C + C / 2 : c === "center" ? L = -tt.highest.height / 2 - B * C + C : L = -tt.highest.height + C / 2 : c === "near" || g !== 0 ? L = C / 2 : c === "center" ? L = tt.highest.height / 2 - B * C : L = tt.highest.height - D * C, d && (L *= -1), g !== 0 && !R.showLabelBackdrop && (x += C / 2 * Math.sin(g))) : (M = w, L = (1 - D) * C / 2);
            let _e;
            if (R.showLabelBackdrop) {
                let Et = X2(R.backdropPadding), Gt = tt.heights[b], Jt = tt.widths[b], Qt = L - Et.top, Zt = 0 - Et.left;
                switch(U){
                    case "middle":
                        Qt -= Gt / 2;
                        break;
                    case "bottom":
                        Qt -= Gt;
                        break;
                }
                switch(k){
                    case "center":
                        Zt -= Jt / 2;
                        break;
                    case "right":
                        Zt -= Jt;
                        break;
                }
                _e = {
                    left: Zt,
                    top: Qt,
                    width: Jt + Et.width,
                    height: Gt + Et.height,
                    color: R.backdropColor
                };
            }
            m.push({
                label: v,
                font: S,
                textOffset: L,
                options: {
                    rotation: g,
                    color: H,
                    strokeColor: st,
                    strokeWidth: K,
                    textAlign: Rt,
                    textBaseline: U,
                    translation: [
                        x,
                        M
                    ],
                    backdrop: _e
                }
            });
        }
        return m;
    }
    _getXAxisLabelAlignment() {
        let { position: t, ticks: e } = this.options;
        if (-it1(this.labelRotation)) return t === "top" ? "left" : "right";
        let n = "center";
        return e.align === "start" ? n = "left" : e.align === "end" ? n = "right" : e.align === "inner" && (n = "inner"), n;
    }
    _getYAxisLabelAlignment(t) {
        let { position: e, ticks: { crossAlign: s, mirror: n, padding: o } } = this.options, a = this._getLabelSizes(), r = t + o, l = a.widest.width, c, h;
        return e === "left" ? n ? (h = this.right + o, s === "near" ? c = "left" : s === "center" ? (c = "center", h += l / 2) : (c = "right", h += l)) : (h = this.right - r, s === "near" ? c = "right" : s === "center" ? (c = "center", h -= l / 2) : (c = "left", h = this.left)) : e === "right" ? n ? (h = this.left + o, s === "near" ? c = "right" : s === "center" ? (c = "center", h -= l / 2) : (c = "left", h -= l)) : (h = this.left + r, s === "near" ? c = "left" : s === "center" ? (c = "center", h += l / 2) : (c = "right", h = this.right)) : c = "right", {
            textAlign: c,
            x: h
        };
    }
    _computeLabelArea() {
        if (this.options.ticks.mirror) return;
        let t = this.chart, e = this.options.position;
        if (e === "left" || e === "right") return {
            top: 0,
            left: this.left,
            bottom: t.height,
            right: this.right
        };
        if (e === "top" || e === "bottom") return {
            top: this.top,
            left: 0,
            bottom: this.bottom,
            right: t.width
        };
    }
    drawBackground() {
        let { ctx: t, options: { backgroundColor: e }, left: s, top: n, width: o, height: a } = this;
        e && (t.save(), t.fillStyle = e, t.fillRect(s, n, o, a), t.restore());
    }
    getLineWidthForValue(t) {
        let e = this.options.grid;
        if (!this._isVisible() || !e.display) return 0;
        let n = this.ticks.findIndex((o)=>o.value === t);
        return n >= 0 ? e.setContext(this.getContext(n)).lineWidth : 0;
    }
    drawGrid(t) {
        let e = this.options.grid, s = this.ctx, n = this._gridLineItems || (this._gridLineItems = this._computeGridLineItems(t)), o, a, r = (l, c, h)=>{
            !h.width || !h.color || (s.save(), s.lineWidth = h.width, s.strokeStyle = h.color, s.setLineDash(h.borderDash || []), s.lineDashOffset = h.borderDashOffset, s.beginPath(), s.moveTo(l.x, l.y), s.lineTo(c.x, c.y), s.stroke(), s.restore());
        };
        if (e.display) for(o = 0, a = n.length; o < a; ++o){
            let l = n[o];
            e.drawOnChartArea && r({
                x: l.x1,
                y: l.y1
            }, {
                x: l.x2,
                y: l.y2
            }, l), e.drawTicks && r({
                x: l.tx1,
                y: l.ty1
            }, {
                x: l.tx2,
                y: l.ty2
            }, {
                color: l.tickColor,
                width: l.tickWidth,
                borderDash: l.tickBorderDash,
                borderDashOffset: l.tickBorderDashOffset
            });
        }
    }
    drawBorder() {
        let { chart: t, ctx: e, options: { border: s, grid: n } } = this, o = s.setContext(this.getContext()), a = s.display ? o.width : 0;
        if (!a) return;
        let r = n.setContext(this.getContext(0)).lineWidth, l = this._borderValue, c, h, d, u;
        this.isHorizontal() ? (c = yt(t, this.left, a) - a / 2, h = yt(t, this.right, r) + r / 2, d = u = l) : (d = yt(t, this.top, a) - a / 2, u = yt(t, this.bottom, r) + r / 2, c = h = l), e.save(), e.lineWidth = o.width, e.strokeStyle = o.color, e.beginPath(), e.moveTo(c, d), e.lineTo(h, u), e.stroke(), e.restore();
    }
    drawLabels(t) {
        if (!this.options.ticks.display) return;
        let s = this.ctx, n = this._computeLabelArea();
        n && se1(s, n);
        let o = this.getLabelItems(t);
        for (let a of o){
            let r = a.options, l = a.font, c = a.label, h = a.textOffset;
            vt(s, c, 0, h, l, r);
        }
        n && ne1(s);
    }
    drawTitle() {
        let { ctx: t, options: { position: e, title: s, reverse: n } } = this;
        if (!s.display) return;
        let o = j1(s.font), a = X2(s.padding), r = s.align, l = o.lineHeight / 2;
        e === "bottom" || e === "center" || O2(e) ? (l += a.bottom, I1(s.text) && (l += o.lineHeight * (s.text.length - 1))) : l += a.top;
        let { titleX: c, titleY: h, maxWidth: d, rotation: u } = vr(this, l, e, r);
        vt(t, s.text, 0, 0, o, {
            color: s.color,
            maxWidth: d,
            rotation: u,
            textAlign: yr(r, e, n),
            textBaseline: "middle",
            translation: [
                c,
                h
            ]
        });
    }
    draw(t) {
        this._isVisible() && (this.drawBackground(), this.drawGrid(t), this.drawBorder(), this.drawTitle(), this.drawLabels(t));
    }
    _layers() {
        let t = this.options, e = t.ticks && t.ticks.z || 0, s = P1(t.grid && t.grid.z, -1), n = P1(t.border && t.border.z, 0);
        return !this._isVisible() || this.draw !== i.prototype.draw ? [
            {
                z: e,
                draw: (o)=>{
                    this.draw(o);
                }
            }
        ] : [
            {
                z: s,
                draw: (o)=>{
                    this.drawBackground(), this.drawGrid(o), this.drawTitle();
                }
            },
            {
                z: n,
                draw: ()=>{
                    this.drawBorder();
                }
            },
            {
                z: e,
                draw: (o)=>{
                    this.drawLabels(o);
                }
            }
        ];
    }
    getMatchingVisibleMetas(t) {
        let e = this.chart.getSortedVisibleDatasetMetas(), s = this.axis + "AxisID", n = [], o, a;
        for(o = 0, a = e.length; o < a; ++o){
            let r = e[o];
            r[s] === this.id && (!t || r.type === t) && n.push(r);
        }
        return n;
    }
    _resolveTickFontOptions(t) {
        let e = this.options.ticks.setContext(this.getContext(t));
        return j1(e.font);
    }
    _maxDigits() {
        let t = this._resolveTickFontOptions(0).lineHeight;
        return (this.isHorizontal() ? this.width : this.height) / t;
    }
}, Xt = class {
    constructor(t, e, s){
        this.type = t, this.scope = e, this.override = s, this.items = Object.create(null);
    }
    isForType(t) {
        return Object.prototype.isPrototypeOf.call(this.type.prototype, t.prototype);
    }
    register(t) {
        let e = Object.getPrototypeOf(t), s;
        wr(e) && (s = this.register(e));
        let n = this.items, o = t.id, a = this.scope + "." + o;
        if (!o) throw new Error("class does not have id: " + t);
        return o in n || (n[o] = t, Mr(t, a, s), this.override && W1.override(t.id, t.overrides)), a;
    }
    get(t) {
        return this.items[t];
    }
    unregister(t) {
        let e = this.items, s = t.id, n = this.scope;
        s in e && delete e[s], n && s in W1[n] && (delete W1[n][s], this.override && delete xt[s]);
    }
};
function Mr(i, t, e) {
    let s = zt(Object.create(null), [
        e ? W1.get(e) : {},
        W1.get(t),
        i.defaults
    ]);
    W1.set(t, s), i.defaultRoutes && kr(t, i.defaultRoutes), i.descriptors && W1.describe(t, i.descriptors);
}
function kr(i, t) {
    Object.keys(t).forEach((e)=>{
        let s = e.split("."), n = s.pop(), o = [
            i
        ].concat(s).join("."), a = t[e].split("."), r = a.pop(), l = a.join(".");
        W1.route(o, n, l, r);
    });
}
function wr(i) {
    return "id" in i && "defaults" in i;
}
var Gi = class {
    constructor(){
        this.controllers = new Xt(dt, "datasets", !0), this.elements = new Xt(ot1, "elements"), this.plugins = new Xt(Object, "plugins"), this.scales = new Xt(Tt, "scales"), this._typedRegistries = [
            this.controllers,
            this.scales,
            this.elements
        ];
    }
    add(...t) {
        this._each("register", t);
    }
    remove(...t) {
        this._each("unregister", t);
    }
    addControllers(...t) {
        this._each("register", t, this.controllers);
    }
    addElements(...t) {
        this._each("register", t, this.elements);
    }
    addPlugins(...t) {
        this._each("register", t, this.plugins);
    }
    addScales(...t) {
        this._each("register", t, this.scales);
    }
    getController(t) {
        return this._get(t, this.controllers, "controller");
    }
    getElement(t) {
        return this._get(t, this.elements, "element");
    }
    getPlugin(t) {
        return this._get(t, this.plugins, "plugin");
    }
    getScale(t) {
        return this._get(t, this.scales, "scale");
    }
    removeControllers(...t) {
        this._each("unregister", t, this.controllers);
    }
    removeElements(...t) {
        this._each("unregister", t, this.elements);
    }
    removePlugins(...t) {
        this._each("unregister", t, this.plugins);
    }
    removeScales(...t) {
        this._each("unregister", t, this.scales);
    }
    _each(t, e, s) {
        [
            ...e
        ].forEach((n)=>{
            let o = s || this._getRegistryForType(n);
            s || o.isForType(n) || o === this.plugins && n.id ? this._exec(t, o, n) : T2(n, (a)=>{
                let r = s || this._getRegistryForType(a);
                this._exec(t, r, a);
            });
        });
    }
    _exec(t, e, s) {
        let n = Pe1(t);
        E1(s["before" + n], [], s), e[t](s), E1(s["after" + n], [], s);
    }
    _getRegistryForType(t) {
        for(let e = 0; e < this._typedRegistries.length; e++){
            let s = this._typedRegistries[e];
            if (s.isForType(t)) return s;
        }
        return this.plugins;
    }
    _get(t, e, s) {
        let n = e.get(t);
        if (n === void 0) throw new Error('"' + t + '" is not a registered ' + s + ".");
        return n;
    }
}, ht = new Gi, Ji = class {
    constructor(){
        this._init = [];
    }
    notify(t, e, s, n) {
        e === "beforeInit" && (this._init = this._createDescriptors(t, !0), this._notify(this._init, t, "install"));
        let o = n ? this._descriptors(t).filter(n) : this._descriptors(t), a = this._notify(o, t, e, s);
        return e === "afterDestroy" && (this._notify(o, t, "stop"), this._notify(this._init, t, "uninstall")), a;
    }
    _notify(t, e, s, n) {
        n = n || {};
        for (let o of t){
            let a = o.plugin, r = a[s], l = [
                e,
                n,
                o.options
            ];
            if (E1(r, l, a) === !1 && n.cancelable) return !1;
        }
        return !0;
    }
    invalidate() {
        A1(this._cache) || (this._oldCache = this._cache, this._cache = void 0);
    }
    _descriptors(t) {
        if (this._cache) return this._cache;
        let e = this._cache = this._createDescriptors(t);
        return this._notifyStateChanges(t), e;
    }
    _createDescriptors(t, e) {
        let s = t && t.config, n = P1(s.options && s.options.plugins, {}), o = Sr(s);
        return n === !1 && !e ? [] : Cr(t, o, n, e);
    }
    _notifyStateChanges(t) {
        let e = this._oldCache || [], s = this._cache, n = (o, a)=>o.filter((r)=>!a.some((l)=>r.plugin.id === l.plugin.id));
        this._notify(n(e, s), t, "stop"), this._notify(n(s, e), t, "start");
    }
};
function Sr(i) {
    let t = {}, e = [], s = Object.keys(ht.plugins.items);
    for(let o = 0; o < s.length; o++)e.push(ht.getPlugin(s[o]));
    let n = i.plugins || [];
    for(let o = 0; o < n.length; o++){
        let a = n[o];
        e.indexOf(a) === -1 && (e.push(a), t[a.id] = !0);
    }
    return {
        plugins: e,
        localIds: t
    };
}
function Pr(i, t) {
    return !t && i === !1 ? null : i === !0 ? {} : i;
}
function Cr(i, { plugins: t, localIds: e }, s, n) {
    let o = [], a = i.getContext();
    for (let r of t){
        let l = r.id, c = Pr(s[l], n);
        c !== null && o.push({
            plugin: r,
            options: Dr(i.config, {
                plugin: r,
                local: e[l]
            }, c, a)
        });
    }
    return o;
}
function Dr(i, { plugin: t, local: e }, s, n) {
    let o = i.pluginScopeKeys(t), a = i.getOptionScopes(s, o);
    return e && t.defaults && a.push(t.defaults), i.createResolver(a, n, [
        ""
    ], {
        scriptable: !1,
        indexable: !1,
        allKeys: !0
    });
}
function Qi(i, t) {
    let e = W1.datasets[i] || {};
    return ((t.datasets || {})[i] || {}).indexAxis || t.indexAxis || e.indexAxis || "x";
}
function Or(i, t) {
    let e = i;
    return i === "_index_" ? e = t : i === "_value_" && (e = t === "x" ? "y" : "x"), e;
}
function Ar(i, t) {
    return i === t ? "_index_" : "_value_";
}
function Lr(i) {
    if (i === "top" || i === "bottom") return "x";
    if (i === "left" || i === "right") return "y";
}
function Ke(i, t) {
    if (i === "x" || i === "y" || i === "r" || (i = t.axis || Lr(t.position) || i.length > 1 && Ke(i[0].toLowerCase(), t), i)) return i;
    throw new Error(`Cannot determine type of '${name}' axis. Please provide 'axis' or 'position' option.`);
}
function Tr(i, t) {
    let e = xt[i.type] || {
        scales: {}
    }, s = t.scales || {}, n = Qi(i.type, t), o = Object.create(null);
    return Object.keys(s).forEach((a)=>{
        let r = s[a];
        if (!O2(r)) return console.error(`Invalid scale configuration for scale: ${a}`);
        if (r._proxy) return console.warn(`Ignoring resolver passed as options for scale: ${a}`);
        let l = Ke(a, r), c = Ar(l, n), h = e.scales || {};
        o[a] = Vt(Object.create(null), [
            {
                axis: l
            },
            r,
            h[l],
            h[c]
        ]);
    }), i.data.datasets.forEach((a)=>{
        let r = a.type || i.type, l = a.indexAxis || Qi(r, t), h = (xt[r] || {}).scales || {};
        Object.keys(h).forEach((d)=>{
            let u = Or(d, l), f = a[u + "AxisID"] || u;
            o[f] = o[f] || Object.create(null), Vt(o[f], [
                {
                    axis: u
                },
                s[f],
                h[d]
            ]);
        });
    }), Object.keys(o).forEach((a)=>{
        let r = o[a];
        Vt(r, [
            W1.scales[r.type],
            W1.scale
        ]);
    }), o;
}
function no(i) {
    let t = i.options || (i.options = {});
    t.plugins = P1(t.plugins, {}), t.scales = Tr(i, t);
}
function oo(i) {
    return i = i || {}, i.datasets = i.datasets || [], i.labels = i.labels || [], i;
}
function Rr(i) {
    return i = i || {}, i.data = oo(i.data), no(i), i;
}
var vn = new Map, ao = new Set;
function Be(i, t) {
    let e = vn.get(i);
    return e || (e = t(), vn.set(i, e), ao.add(e)), e;
}
var ce = (i, t, e)=>{
    let s = gt(t, e);
    s !== void 0 && i.add(s);
}, Zi = class {
    constructor(t){
        this._config = Rr(t), this._scopeCache = new Map, this._resolverCache = new Map;
    }
    get platform() {
        return this._config.platform;
    }
    get type() {
        return this._config.type;
    }
    set type(t) {
        this._config.type = t;
    }
    get data() {
        return this._config.data;
    }
    set data(t) {
        this._config.data = oo(t);
    }
    get options() {
        return this._config.options;
    }
    set options(t) {
        this._config.options = t;
    }
    get plugins() {
        return this._config.plugins;
    }
    update() {
        let t = this._config;
        this.clearCache(), no(t);
    }
    clearCache() {
        this._scopeCache.clear(), this._resolverCache.clear();
    }
    datasetScopeKeys(t) {
        return Be(t, ()=>[
                [
                    `datasets.${t}`,
                    ""
                ]
            ]);
    }
    datasetAnimationScopeKeys(t, e) {
        return Be(`${t}.transition.${e}`, ()=>[
                [
                    `datasets.${t}.transitions.${e}`,
                    `transitions.${e}`
                ],
                [
                    `datasets.${t}`,
                    ""
                ]
            ]);
    }
    datasetElementScopeKeys(t, e) {
        return Be(`${t}-${e}`, ()=>[
                [
                    `datasets.${t}.elements.${e}`,
                    `datasets.${t}`,
                    `elements.${e}`,
                    ""
                ]
            ]);
    }
    pluginScopeKeys(t) {
        let e = t.id, s = this.type;
        return Be(`${s}-plugin-${e}`, ()=>[
                [
                    `plugins.${e}`,
                    ...t.additionalOptionScopes || []
                ]
            ]);
    }
    _cachedScopes(t, e) {
        let s = this._scopeCache, n = s.get(t);
        return (!n || e) && (n = new Map, s.set(t, n)), n;
    }
    getOptionScopes(t, e, s) {
        let { options: n, type: o } = this, a = this._cachedScopes(t, s), r = a.get(e);
        if (r) return r;
        let l = new Set;
        e.forEach((h)=>{
            t && (l.add(t), h.forEach((d)=>ce(l, t, d))), h.forEach((d)=>ce(l, n, d)), h.forEach((d)=>ce(l, xt[o] || {}, d)), h.forEach((d)=>ce(l, W1, d)), h.forEach((d)=>ce(l, Ae, d));
        });
        let c = Array.from(l);
        return c.length === 0 && c.push(Object.create(null)), ao.has(e) && a.set(e, c), c;
    }
    chartOptionScopes() {
        let { options: t, type: e } = this;
        return [
            t,
            xt[e] || {},
            W1.datasets[e] || {},
            {
                type: e
            },
            W1,
            Ae
        ];
    }
    resolveNamedOptions(t, e, s, n = [
        ""
    ]) {
        let o = {
            $shared: !0
        }, { resolver: a, subPrefixes: r } = Mn(this._resolverCache, t, n), l = a;
        if (Ir(a, e)) {
            o.$shared = !1, s = ut(s) ? s() : s;
            let c = this.createResolver(t, s, r);
            l = Ct(a, s, c);
        }
        for (let c of e)o[c] = l[c];
        return o;
    }
    createResolver(t, e, s = [
        ""
    ], n) {
        let { resolver: o } = Mn(this._resolverCache, t, s);
        return O2(e) ? Ct(o, e, void 0, n) : o;
    }
};
function Mn(i, t, e) {
    let s = i.get(t);
    s || (s = new Map, i.set(t, s));
    let n = e.join(), o = s.get(n);
    return o || (o = {
        resolver: Re(t, e),
        subPrefixes: e.filter((r)=>!r.toLowerCase().includes("hover"))
    }, s.set(n, o)), o;
}
var Er = (i)=>O2(i) && Object.getOwnPropertyNames(i).reduce((t, e)=>t || ut(i[e]), !1);
function Ir(i, t) {
    let { isScriptable: e, isIndexable: s } = xi(i);
    for (let n of t){
        let o = e(n), a = s(n), r = (a || o) && i[n];
        if (o && (ut(r) || Er(r)) || a && I1(r)) return !0;
    }
    return !1;
}
var zr = "4.1.1", Fr = [
    "top",
    "bottom",
    "left",
    "right",
    "chartArea"
];
function kn(i, t) {
    return i === "top" || i === "bottom" || Fr.indexOf(i) === -1 && t === "x";
}
function wn(i, t) {
    return function(e, s) {
        return e[i] === s[i] ? e[t] - s[t] : e[i] - s[i];
    };
}
function Sn(i) {
    let t = i.chart, e = t.options.animation;
    t.notifyPlugins("afterRender"), E1(e && e.onComplete, [
        i
    ], t);
}
function Br(i) {
    let t = i.chart, e = t.options.animation;
    E1(e && e.onProgress, [
        i
    ], t);
}
function ro(i) {
    return ki() && typeof i == "string" ? i = document.getElementById(i) : i && i.length && (i = i[0]), i && i.canvas && (i = i.canvas), i;
}
var je = {}, Pn = (i)=>{
    let t = ro(i);
    return Object.values(je).filter((e)=>e.canvas === t).pop();
};
function Vr(i, t, e) {
    let s = Object.keys(i);
    for (let n of s){
        let o = +n;
        if (o >= t) {
            let a = i[n];
            delete i[n], (e > 0 || o > t) && (i[o + e] = a);
        }
    }
}
function Nr(i, t, e, s) {
    return !e || i.type === "mouseout" ? null : s ? t : i;
}
function Wr(i) {
    let { xScale: t, yScale: e } = i;
    if (t && e) return {
        left: t.left,
        right: t.right,
        top: e.top,
        bottom: e.bottom
    };
}
var ts = class {
    static defaults = W1;
    static instances = je;
    static overrides = xt;
    static registry = ht;
    static version = zr;
    static getChart = Pn;
    static register(...t) {
        ht.add(...t), Cn();
    }
    static unregister(...t) {
        ht.remove(...t), Cn();
    }
    constructor(t, e){
        let s = this.config = new Zi(e), n = ro(t), o = Pn(n);
        if (o) throw new Error("Canvas is already in use. Chart with ID '" + o.id + "' must be destroyed before the canvas with ID '" + o.canvas.id + "' can be reused.");
        let a = s.createResolver(s.chartOptionScopes(), this.getContext());
        this.platform = new (s.platform || lr(n)), this.platform.updateConfig(s);
        let r = this.platform.acquireContext(n, a.aspectRatio), l = r && r.canvas, c = l && l.height, h = l && l.width;
        if (this.id = Ss(), this.ctx = r, this.canvas = l, this.width = h, this.height = c, this._options = a, this._aspectRatio = this.aspectRatio, this._layers = [], this._metasets = [], this._stacks = void 0, this.boxes = [], this.currentDevicePixelRatio = void 0, this.chartArea = void 0, this._active = [], this._lastEvent = void 0, this._listeners = {}, this._responsiveListeners = void 0, this._sortedMetasets = [], this.scales = {}, this._plugins = new Ji, this.$proxies = {}, this._hiddenIndices = {}, this.attached = !1, this._animationsDisabled = void 0, this.$context = void 0, this._doResize = zs((d)=>this.update(d), a.resizeDelay || 0), this._dataChanges = [], je[this.id] = this, !r || !l) {
            console.error("Failed to create chart: can't acquire context from the given item");
            return;
        }
        mt.listen(this, "complete", Sn), mt.listen(this, "progress", Br), this._initialize(), this.attached && this.update();
    }
    get aspectRatio() {
        let { options: { aspectRatio: t, maintainAspectRatio: e }, width: s, height: n, _aspectRatio: o } = this;
        return A1(t) ? e && o ? o : n ? s / n : null : t;
    }
    get data() {
        return this.config.data;
    }
    set data(t) {
        this.config.data = t;
    }
    get options() {
        return this._options;
    }
    set options(t) {
        this.config.options = t;
    }
    get registry() {
        return ht;
    }
    _initialize() {
        return this.notifyPlugins("beforeInit"), this.options.responsive ? this.resize() : wi(this, this.options.devicePixelRatio), this.bindEvents(), this.notifyPlugins("afterInit"), this;
    }
    clear() {
        return mi(this.canvas, this.ctx), this;
    }
    stop() {
        return mt.stop(this), this;
    }
    resize(t, e) {
        mt.running(this) ? this._resizeBeforeDraw = {
            width: t,
            height: e
        } : this._resize(t, e);
    }
    _resize(t, e) {
        let s = this.options, n = this.canvas, o = s.maintainAspectRatio && this.aspectRatio, a = this.platform.getMaximumSize(n, t, e, o), r = s.devicePixelRatio || this.platform.getDevicePixelRatio(), l = this.width ? "resize" : "attach";
        this.width = a.width, this.height = a.height, this._aspectRatio = this.aspectRatio, wi(this, r, !0) && (this.notifyPlugins("resize", {
            size: a
        }), E1(s.onResize, [
            this,
            a
        ], this), this.attached && this._doResize(l) && this.render());
    }
    ensureScalesHaveIDs() {
        let e = this.options.scales || {};
        T2(e, (s, n)=>{
            s.id = n;
        });
    }
    buildOrUpdateScales() {
        let t = this.options, e = t.scales, s = this.scales, n = Object.keys(s).reduce((a, r)=>(a[r] = !1, a), {}), o = [];
        e && (o = o.concat(Object.keys(e).map((a)=>{
            let r = e[a], l = Ke(a, r), c = l === "r", h = l === "x";
            return {
                options: r,
                dposition: c ? "chartArea" : h ? "bottom" : "left",
                dtype: c ? "radialLinear" : h ? "category" : "linear"
            };
        }))), T2(o, (a)=>{
            let r = a.options, l = r.id, c = Ke(l, r), h = P1(r.type, a.dtype);
            (r.position === void 0 || kn(r.position, c) !== kn(a.dposition)) && (r.position = a.dposition), n[l] = !0;
            let d = null;
            if (l in s && s[l].type === h) d = s[l];
            else {
                let u = ht.getScale(h);
                d = new u({
                    id: l,
                    type: h,
                    ctx: this.ctx,
                    chart: this
                }), s[d.id] = d;
            }
            d.init(r, t);
        }), T2(n, (a, r)=>{
            a || delete s[r];
        }), T2(s, (a)=>{
            q1.configure(this, a, a.options), q1.addBox(this, a);
        });
    }
    _updateMetasets() {
        let t = this._metasets, e = this.data.datasets.length, s = t.length;
        if (t.sort((n, o)=>n.index - o.index), s > e) {
            for(let n = e; n < s; ++n)this._destroyDatasetMeta(n);
            t.splice(e, s - e);
        }
        this._sortedMetasets = t.slice(0).sort(wn("order", "index"));
    }
    _removeUnreferencedMetasets() {
        let { _metasets: t, data: { datasets: e } } = this;
        t.length > e.length && delete this._stacks, t.forEach((s, n)=>{
            e.filter((o)=>o === s._dataset).length === 0 && this._destroyDatasetMeta(n);
        });
    }
    buildOrUpdateControllers() {
        let t = [], e = this.data.datasets, s, n;
        for(this._removeUnreferencedMetasets(), s = 0, n = e.length; s < n; s++){
            let o = e[s], a = this.getDatasetMeta(s), r = o.type || this.config.type;
            if (a.type && a.type !== r && (this._destroyDatasetMeta(s), a = this.getDatasetMeta(s)), a.type = r, a.indexAxis = o.indexAxis || Qi(r, this.options), a.order = o.order || 0, a.index = s, a.label = "" + o.label, a.visible = this.isDatasetVisible(s), a.controller) a.controller.updateIndex(s), a.controller.linkScales();
            else {
                let l = ht.getController(r), { datasetElementType: c, dataElementType: h } = W1.datasets[r];
                Object.assign(l, {
                    dataElementType: ht.getElement(h),
                    datasetElementType: c && ht.getElement(c)
                }), a.controller = new l(this, s), t.push(a.controller);
            }
        }
        return this._updateMetasets(), t;
    }
    _resetElements() {
        T2(this.data.datasets, (t, e)=>{
            this.getDatasetMeta(e).controller.reset();
        }, this);
    }
    reset() {
        this._resetElements(), this.notifyPlugins("reset");
    }
    update(t) {
        let e = this.config;
        e.update();
        let s = this._options = e.createResolver(e.chartOptionScopes(), this.getContext()), n = this._animationsDisabled = !s.animation;
        if (this._updateScales(), this._checkEventBindings(), this._updateHiddenIndices(), this._plugins.invalidate(), this.notifyPlugins("beforeUpdate", {
            mode: t,
            cancelable: !0
        }) === !1) return;
        let o = this.buildOrUpdateControllers();
        this.notifyPlugins("beforeElementsUpdate");
        let a = 0;
        for(let c = 0, h = this.data.datasets.length; c < h; c++){
            let { controller: d } = this.getDatasetMeta(c), u = !n && o.indexOf(d) === -1;
            d.buildOrUpdateElements(u), a = Math.max(+d.getMaxOverflow(), a);
        }
        a = this._minPadding = s.layout.autoPadding ? a : 0, this._updateLayout(a), n || T2(o, (c)=>{
            c.reset();
        }), this._updateDatasets(t), this.notifyPlugins("afterUpdate", {
            mode: t
        }), this._layers.sort(wn("z", "_idx"));
        let { _active: r, _lastEvent: l } = this;
        l ? this._eventHandler(l, !0) : r.length && this._updateHoverStyles(r, r, !0), this.render();
    }
    _updateScales() {
        T2(this.scales, (t)=>{
            q1.removeBox(this, t);
        }), this.ensureScalesHaveIDs(), this.buildOrUpdateScales();
    }
    _checkEventBindings() {
        let t = this.options, e = new Set(Object.keys(this._listeners)), s = new Set(t.events);
        (!ni(e, s) || !!this._responsiveListeners !== t.responsive) && (this.unbindEvents(), this.bindEvents());
    }
    _updateHiddenIndices() {
        let { _hiddenIndices: t } = this, e = this._getUniformDataChanges() || [];
        for (let { method: s, start: n, count: o } of e){
            let a = s === "_removeElements" ? -o : o;
            Vr(t, n, a);
        }
    }
    _getUniformDataChanges() {
        let t = this._dataChanges;
        if (!t || !t.length) return;
        this._dataChanges = [];
        let e = this.data.datasets.length, s = (o)=>new Set(t.filter((a)=>a[0] === o).map((a, r)=>r + "," + a.splice(1).join(","))), n = s(0);
        for(let o = 1; o < e; o++)if (!ni(n, s(o))) return;
        return Array.from(n).map((o)=>o.split(",")).map((o)=>({
                method: o[1],
                start: +o[2],
                count: +o[3]
            }));
    }
    _updateLayout(t) {
        if (this.notifyPlugins("beforeLayout", {
            cancelable: !0
        }) === !1) return;
        q1.update(this, this.width, this.height, t);
        let e = this.chartArea, s = e.width <= 0 || e.height <= 0;
        this._layers = [], T2(this.boxes, (n)=>{
            s && n.position === "chartArea" || (n.configure && n.configure(), this._layers.push(...n._layers()));
        }, this), this._layers.forEach((n, o)=>{
            n._idx = o;
        }), this.notifyPlugins("afterLayout");
    }
    _updateDatasets(t) {
        if (this.notifyPlugins("beforeDatasetsUpdate", {
            mode: t,
            cancelable: !0
        }) !== !1) {
            for(let e = 0, s = this.data.datasets.length; e < s; ++e)this.getDatasetMeta(e).controller.configure();
            for(let e = 0, s = this.data.datasets.length; e < s; ++e)this._updateDataset(e, ut(t) ? t({
                datasetIndex: e
            }) : t);
            this.notifyPlugins("afterDatasetsUpdate", {
                mode: t
            });
        }
    }
    _updateDataset(t, e) {
        let s = this.getDatasetMeta(t), n = {
            meta: s,
            index: t,
            mode: e,
            cancelable: !0
        };
        this.notifyPlugins("beforeDatasetUpdate", n) !== !1 && (s.controller._update(e), n.cancelable = !1, this.notifyPlugins("afterDatasetUpdate", n));
    }
    render() {
        this.notifyPlugins("beforeRender", {
            cancelable: !0
        }) !== !1 && (mt.has(this) ? this.attached && !mt.running(this) && mt.start(this) : (this.draw(), Sn({
            chart: this
        })));
    }
    draw() {
        let t;
        if (this._resizeBeforeDraw) {
            let { width: s, height: n } = this._resizeBeforeDraw;
            this._resize(s, n), this._resizeBeforeDraw = null;
        }
        if (this.clear(), this.width <= 0 || this.height <= 0 || this.notifyPlugins("beforeDraw", {
            cancelable: !0
        }) === !1) return;
        let e = this._layers;
        for(t = 0; t < e.length && e[t].z <= 0; ++t)e[t].draw(this.chartArea);
        for(this._drawDatasets(); t < e.length; ++t)e[t].draw(this.chartArea);
        this.notifyPlugins("afterDraw");
    }
    _getSortedDatasetMetas(t) {
        let e = this._sortedMetasets, s = [], n, o;
        for(n = 0, o = e.length; n < o; ++n){
            let a = e[n];
            (!t || a.visible) && s.push(a);
        }
        return s;
    }
    getSortedVisibleDatasetMetas() {
        return this._getSortedDatasetMetas(!0);
    }
    _drawDatasets() {
        if (this.notifyPlugins("beforeDatasetsDraw", {
            cancelable: !0
        }) === !1) return;
        let t = this.getSortedVisibleDatasetMetas();
        for(let e = t.length - 1; e >= 0; --e)this._drawDataset(t[e]);
        this.notifyPlugins("afterDatasetsDraw");
    }
    _drawDataset(t) {
        let e = this.ctx, s = t._clip, n = !s.disabled, o = Wr(t) || this.chartArea, a = {
            meta: t,
            index: t.index,
            cancelable: !0
        };
        this.notifyPlugins("beforeDatasetDraw", a) !== !1 && (n && se1(e, {
            left: s.left === !1 ? 0 : o.left - s.left,
            right: s.right === !1 ? this.width : o.right + s.right,
            top: s.top === !1 ? 0 : o.top - s.top,
            bottom: s.bottom === !1 ? this.height : o.bottom + s.bottom
        }), t.controller.draw(), n && ne1(e), a.cancelable = !1, this.notifyPlugins("afterDatasetDraw", a));
    }
    isPointInArea(t) {
        return Ft(t, this.chartArea, this._minPadding);
    }
    getElementsAtEventForMode(t, e, s, n) {
        let o = ja.modes[e];
        return typeof o == "function" ? o(this, t, s, n) : [];
    }
    getDatasetMeta(t) {
        let e = this.data.datasets[t], s = this._metasets, n = s.filter((o)=>o && o._dataset === e).pop();
        return n || (n = {
            type: null,
            data: [],
            dataset: null,
            controller: null,
            hidden: null,
            xAxisID: null,
            yAxisID: null,
            order: e && e.order || 0,
            index: t,
            _dataset: e,
            _parsed: [],
            _sorted: !1
        }, s.push(n)), n;
    }
    getContext() {
        return this.$context || (this.$context = pt(null, {
            chart: this,
            type: "chart"
        }));
    }
    getVisibleDatasetCount() {
        return this.getSortedVisibleDatasetMetas().length;
    }
    isDatasetVisible(t) {
        let e = this.data.datasets[t];
        if (!e) return !1;
        let s = this.getDatasetMeta(t);
        return typeof s.hidden == "boolean" ? !s.hidden : !e.hidden;
    }
    setDatasetVisibility(t, e) {
        let s = this.getDatasetMeta(t);
        s.hidden = !e;
    }
    toggleDataVisibility(t) {
        this._hiddenIndices[t] = !this._hiddenIndices[t];
    }
    getDataVisibility(t) {
        return !this._hiddenIndices[t];
    }
    _updateVisibility(t, e, s) {
        let n = s ? "show" : "hide", o = this.getDatasetMeta(t), a = o.controller._resolveAnimations(void 0, n);
        et1(e) ? (o.data[e].hidden = !s, this.update()) : (this.setDatasetVisibility(t, s), a.update(o, {
            visible: s
        }), this.update((r)=>r.datasetIndex === t ? n : void 0));
    }
    hide(t, e) {
        this._updateVisibility(t, e, !1);
    }
    show(t, e) {
        this._updateVisibility(t, e, !0);
    }
    _destroyDatasetMeta(t) {
        let e = this._metasets[t];
        e && e.controller && e.controller._destroy(), delete this._metasets[t];
    }
    _stop() {
        let t, e;
        for(this.stop(), mt.remove(this), t = 0, e = this.data.datasets.length; t < e; ++t)this._destroyDatasetMeta(t);
    }
    destroy() {
        this.notifyPlugins("beforeDestroy");
        let { canvas: t, ctx: e } = this;
        this._stop(), this.config.clearCache(), t && (this.unbindEvents(), mi(t, e), this.platform.releaseContext(e), this.canvas = null, this.ctx = null), delete je[this.id], this.notifyPlugins("afterDestroy");
    }
    toBase64Image(...t) {
        return this.canvas.toDataURL(...t);
    }
    bindEvents() {
        this.bindUserEvents(), this.options.responsive ? this.bindResponsiveEvents() : this.attached = !0;
    }
    bindUserEvents() {
        let t = this._listeners, e = this.platform, s = (o, a)=>{
            e.addEventListener(this, o, a), t[o] = a;
        }, n = (o, a, r)=>{
            o.offsetX = a, o.offsetY = r, this._eventHandler(o);
        };
        T2(this.options.events, (o)=>s(o, n));
    }
    bindResponsiveEvents() {
        this._responsiveListeners || (this._responsiveListeners = {});
        let t = this._responsiveListeners, e = this.platform, s = (l, c)=>{
            e.addEventListener(this, l, c), t[l] = c;
        }, n = (l, c)=>{
            t[l] && (e.removeEventListener(this, l, c), delete t[l]);
        }, o = (l, c)=>{
            this.canvas && this.resize(l, c);
        }, a, r = ()=>{
            n("attach", r), this.attached = !0, this.resize(), s("resize", o), s("detach", a);
        };
        a = ()=>{
            this.attached = !1, n("resize", o), this._stop(), this._resize(0, 0), s("attach", r);
        }, e.isAttached(this.canvas) ? r() : a();
    }
    unbindEvents() {
        T2(this._listeners, (t, e)=>{
            this.platform.removeEventListener(this, e, t);
        }), this._listeners = {}, T2(this._responsiveListeners, (t, e)=>{
            this.platform.removeEventListener(this, e, t);
        }), this._responsiveListeners = void 0;
    }
    updateHoverStyle(t, e, s) {
        let n = s ? "set" : "remove", o, a, r, l;
        for(e === "dataset" && (o = this.getDatasetMeta(t[0].datasetIndex), o.controller["_" + n + "DatasetHoverStyle"]()), r = 0, l = t.length; r < l; ++r){
            a = t[r];
            let c = a && this.getDatasetMeta(a.datasetIndex).controller;
            c && c[n + "HoverStyle"](a.element, a.datasetIndex, a.index);
        }
    }
    getActiveElements() {
        return this._active || [];
    }
    setActiveElements(t) {
        let e = this._active || [], s = t.map(({ datasetIndex: o, index: a })=>{
            let r = this.getDatasetMeta(o);
            if (!r) throw new Error("No dataset found at index " + o);
            return {
                datasetIndex: o,
                element: r.data[a],
                index: a
            };
        });
        !ie1(s, e) && (this._active = s, this._lastEvent = null, this._updateHoverStyles(s, e));
    }
    notifyPlugins(t, e, s) {
        return this._plugins.notify(this, t, e, s);
    }
    isPluginEnabled(t) {
        return this._plugins._cache.filter((e)=>e.plugin.id === t).length === 1;
    }
    _updateHoverStyles(t, e, s) {
        let n = this.options.hover, o = (l, c)=>l.filter((h)=>!c.some((d)=>h.datasetIndex === d.datasetIndex && h.index === d.index)), a = o(e, t), r = s ? t : o(t, e);
        a.length && this.updateHoverStyle(a, n.mode, !1), r.length && n.mode && this.updateHoverStyle(r, n.mode, !0);
    }
    _eventHandler(t, e) {
        let s = {
            event: t,
            replay: e,
            cancelable: !0,
            inChartArea: this.isPointInArea(t)
        }, n = (a)=>(a.options.events || this.options.events).includes(t.native.type);
        if (this.notifyPlugins("beforeEvent", s, n) === !1) return;
        let o = this._handleEvent(t, e, s.inChartArea);
        return s.cancelable = !1, this.notifyPlugins("afterEvent", s, n), (o || s.changed) && this.render(), this;
    }
    _handleEvent(t, e, s) {
        let { _active: n = [], options: o } = this, a = e, r = this._getActiveElements(t, n, s, a), l = Ds(t), c = Nr(t, this._lastEvent, s, l);
        s && (this._lastEvent = null, E1(o.onHover, [
            t,
            r,
            this
        ], this), l && E1(o.onClick, [
            t,
            r,
            this
        ], this));
        let h = !ie1(r, n);
        return (h || e) && (this._active = r, this._updateHoverStyles(r, n, e)), this._lastEvent = c, h;
    }
    _getActiveElements(t, e, s, n) {
        if (t.type === "mouseout") return [];
        if (!s) return e;
        let o = this.options.hover;
        return this.getElementsAtEventForMode(t, o.mode, o, n);
    }
};
function Cn() {
    return T2(ts.instances, (i)=>i._plugins.invalidate());
}
function Hr(i, t, e) {
    let { startAngle: s, pixelMargin: n, x: o, y: a, outerRadius: r, innerRadius: l } = t, c = n / r;
    i.beginPath(), i.arc(o, a, r, s - c, e + c), l > n ? (c = n / l, i.arc(o, a, l, e + c, s - c, !0)) : i.arc(o, a, n, e + V1, s - V1), i.closePath(), i.clip();
}
function jr(i) {
    return Te(i, [
        "outerStart",
        "outerEnd",
        "innerStart",
        "innerEnd"
    ]);
}
function $r(i, t, e, s) {
    let n = jr(i.options.borderRadius), o = (e - t) / 2, a = Math.min(o, s * t / 2), r = (l)=>{
        let c = (e - Math.min(o, l)) * s / 2;
        return $2(l, 0, Math.min(o, c));
    };
    return {
        outerStart: r(n.outerStart),
        outerEnd: r(n.outerEnd),
        innerStart: $2(n.innerStart, 0, a),
        innerEnd: $2(n.innerEnd, 0, a)
    };
}
function Yt(i, t, e, s) {
    return {
        x: e + i * Math.cos(t),
        y: s + i * Math.sin(t)
    };
}
function qe(i, t, e, s, n, o) {
    let { x: a, y: r, startAngle: l, pixelMargin: c, innerRadius: h } = t, d = Math.max(t.outerRadius + s + e - c, 0), u = h > 0 ? h + s + e + c : 0, f = 0, p = n - l;
    if (s) {
        let R = h > 0 ? h - s : 0, B = d > 0 ? d - s : 0, H = (R + B) / 2, st = H !== 0 ? p * H / (H + s) : p;
        f = (p - st) / 2;
    }
    let g = Math.max(.001, p * d - e / F2) / d, m = (p - g) / 2, b = l + m + f, _ = n - m - f, { outerStart: y, outerEnd: v, innerStart: x, innerEnd: M } = $r(t, u, d, _ - b), k = d - y, w = d - v, S = b + y / k, C = _ - v / w, D = u + x, L = u + M, U = b + x / D, tt = _ - M / L;
    if (i.beginPath(), o) {
        let R = (S + C) / 2;
        if (i.arc(a, r, d, S, R), i.arc(a, r, d, R, C), v > 0) {
            let K = Yt(w, C, a, r);
            i.arc(K.x, K.y, v, C, _ + V1);
        }
        let B = Yt(L, _, a, r);
        if (i.lineTo(B.x, B.y), M > 0) {
            let K = Yt(L, tt, a, r);
            i.arc(K.x, K.y, M, _ + V1, tt + Math.PI);
        }
        let H = (_ - M / u + (b + x / u)) / 2;
        if (i.arc(a, r, u, _ - M / u, H, !0), i.arc(a, r, u, H, b + x / u, !0), x > 0) {
            let K = Yt(D, U, a, r);
            i.arc(K.x, K.y, x, U + Math.PI, b - V1);
        }
        let st = Yt(k, b, a, r);
        if (i.lineTo(st.x, st.y), y > 0) {
            let K = Yt(k, S, a, r);
            i.arc(K.x, K.y, y, b - V1, S);
        }
    } else {
        i.moveTo(a, r);
        let R = Math.cos(S) * d + a, B = Math.sin(S) * d + r;
        i.lineTo(R, B);
        let H = Math.cos(C) * d + a, st = Math.sin(C) * d + r;
        i.lineTo(H, st);
    }
    i.closePath();
}
function Ur(i, t, e, s, n) {
    let { fullCircles: o, startAngle: a, circumference: r } = t, l = t.endAngle;
    if (o) {
        qe(i, t, e, s, l, n);
        for(let c = 0; c < o; ++c)i.fill();
        isNaN(r) || (l = a + (r % z1 || z1));
    }
    return qe(i, t, e, s, l, n), i.fill(), l;
}
function Yr(i, t, e, s, n) {
    let { fullCircles: o, startAngle: a, circumference: r, options: l } = t, { borderWidth: c, borderJoinStyle: h } = l, d = l.borderAlign === "inner";
    if (!c) return;
    d ? (i.lineWidth = c * 2, i.lineJoin = h || "round") : (i.lineWidth = c, i.lineJoin = h || "bevel");
    let u = t.endAngle;
    if (o) {
        qe(i, t, e, s, u, n);
        for(let f = 0; f < o; ++f)i.stroke();
        isNaN(r) || (u = a + (r % z1 || z1));
    }
    d && Hr(i, t, u), o || (qe(i, t, e, s, u, n), i.stroke());
}
var es = class extends ot1 {
    static id = "arc";
    static defaults = {
        borderAlign: "center",
        borderColor: "#fff",
        borderJoinStyle: void 0,
        borderRadius: 0,
        borderWidth: 2,
        offset: 0,
        spacing: 0,
        angle: void 0,
        circular: !0
    };
    static defaultRoutes = {
        backgroundColor: "backgroundColor"
    };
    constructor(t){
        super(), this.options = void 0, this.circumference = void 0, this.startAngle = void 0, this.endAngle = void 0, this.innerRadius = void 0, this.outerRadius = void 0, this.pixelMargin = 0, this.fullCircles = 0, t && Object.assign(this, t);
    }
    inRange(t, e, s) {
        let n = this.getProps([
            "x",
            "y"
        ], s), { angle: o, distance: a } = li(n, {
            x: t,
            y: e
        }), { startAngle: r, endAngle: l, innerRadius: c, outerRadius: h, circumference: d } = this.getProps([
            "startAngle",
            "endAngle",
            "innerRadius",
            "outerRadius",
            "circumference"
        ], s), u = this.options.spacing / 2, p = P1(d, l - r) >= z1 || Wt(o, r, l), g = lt(a, c + u, h + u);
        return p && g;
    }
    getCenterPoint(t) {
        let { x: e, y: s, startAngle: n, endAngle: o, innerRadius: a, outerRadius: r } = this.getProps([
            "x",
            "y",
            "startAngle",
            "endAngle",
            "innerRadius",
            "outerRadius",
            "circumference"
        ], t), { offset: l, spacing: c } = this.options, h = (n + o) / 2, d = (a + r + c + l) / 2;
        return {
            x: e + Math.cos(h) * d,
            y: s + Math.sin(h) * d
        };
    }
    tooltipPosition(t) {
        return this.getCenterPoint(t);
    }
    draw(t) {
        let { options: e, circumference: s } = this, n = (e.offset || 0) / 4, o = (e.spacing || 0) / 2, a = e.circular;
        if (this.pixelMargin = e.borderAlign === "inner" ? .33 : 0, this.fullCircles = s > z1 ? Math.floor(s / z1) : 0, s === 0 || this.innerRadius < 0 || this.outerRadius < 0) return;
        t.save();
        let r = (this.startAngle + this.endAngle) / 2;
        t.translate(Math.cos(r) * n, Math.sin(r) * n);
        let l = 1 - Math.sin(Math.min(F2, s || 0)), c = n * l;
        t.fillStyle = e.backgroundColor, t.strokeStyle = e.borderColor, Ur(t, this, c, o, a), Yr(t, this, c, o, a), t.restore();
    }
};
function lo(i, t, e = t) {
    i.lineCap = P1(e.borderCapStyle, t.borderCapStyle), i.setLineDash(P1(e.borderDash, t.borderDash)), i.lineDashOffset = P1(e.borderDashOffset, t.borderDashOffset), i.lineJoin = P1(e.borderJoinStyle, t.borderJoinStyle), i.lineWidth = P1(e.borderWidth, t.borderWidth), i.strokeStyle = P1(e.borderColor, t.borderColor);
}
function Xr(i, t, e) {
    i.lineTo(e.x, e.y);
}
function Kr(i) {
    return i.stepped ? Ws : i.tension || i.cubicInterpolationMode === "monotone" ? Hs : Xr;
}
function co(i, t, e = {}) {
    let s = i.length, { start: n = 0, end: o = s - 1 } = e, { start: a, end: r } = t, l = Math.max(n, a), c = Math.min(o, r), h = n < a && o < a || n > r && o > r;
    return {
        count: s,
        start: l,
        loop: t.loop,
        ilen: c < l && !h ? s + c - l : c - l
    };
}
function qr(i, t, e, s) {
    let { points: n, options: o } = t, { count: a, start: r, loop: l, ilen: c } = co(n, e, s), h = Kr(o), { move: d = !0, reverse: u } = s || {}, f, p, g;
    for(f = 0; f <= c; ++f)p = n[(r + (u ? c - f : f)) % a], !p.skip && (d ? (i.moveTo(p.x, p.y), d = !1) : h(i, g, p, u, o.stepped), g = p);
    return l && (p = n[(r + (u ? c : 0)) % a], h(i, g, p, u, o.stepped)), !!l;
}
function Gr(i, t, e, s) {
    let n = t.points, { count: o, start: a, ilen: r } = co(n, e, s), { move: l = !0, reverse: c } = s || {}, h = 0, d = 0, u, f, p, g, m, b, _ = (v)=>(a + (c ? r - v : v)) % o, y = ()=>{
        g !== m && (i.lineTo(h, m), i.lineTo(h, g), i.lineTo(h, b));
    };
    for(l && (f = n[_(0)], i.moveTo(f.x, f.y)), u = 0; u <= r; ++u){
        if (f = n[_(u)], f.skip) continue;
        let v = f.x, x = f.y, M = v | 0;
        M === p ? (x < g ? g = x : x > m && (m = x), h = (d * h + v) / ++d) : (y(), i.lineTo(v, x), p = M, d = 0, g = m = x), b = x;
    }
    y();
}
function is(i) {
    let t = i.options, e = t.borderDash && t.borderDash.length;
    return !i._decimated && !i._loop && !t.tension && t.cubicInterpolationMode !== "monotone" && !t.stepped && !e ? Gr : qr;
}
function Jr(i) {
    return i.stepped ? Js : i.tension || i.cubicInterpolationMode === "monotone" ? Qs : _t;
}
function Qr(i, t, e, s) {
    let n = t._path;
    n || (n = t._path = new Path2D, t.path(n, e, s) && n.closePath()), lo(i, t.options), i.stroke(n);
}
function Zr(i, t, e, s) {
    let { segments: n, options: o } = t, a = is(t);
    for (let r of n)lo(i, o, r.style), i.beginPath(), a(i, t, r, {
        start: e,
        end: e + s - 1
    }) && i.closePath(), i.stroke();
}
var tl = typeof Path2D == "function";
function el(i, t, e, s) {
    tl && !t.options.segment ? Qr(i, t, e, s) : Zr(i, t, e, s);
}
var Kt = class extends ot1 {
    static id = "line";
    static defaults = {
        borderCapStyle: "butt",
        borderDash: [],
        borderDashOffset: 0,
        borderJoinStyle: "miter",
        borderWidth: 3,
        capBezierPoints: !0,
        cubicInterpolationMode: "default",
        fill: !1,
        spanGaps: !1,
        stepped: !1,
        tension: 0
    };
    static defaultRoutes = {
        backgroundColor: "backgroundColor",
        borderColor: "borderColor"
    };
    static descriptors = {
        _scriptable: !0,
        _indexable: (t)=>t !== "borderDash" && t !== "fill"
    };
    constructor(t){
        super(), this.animated = !0, this.options = void 0, this._chart = void 0, this._loop = void 0, this._fullLoop = void 0, this._path = void 0, this._points = void 0, this._segments = void 0, this._decimated = !1, this._pointsUpdated = !1, this._datasetIndex = void 0, t && Object.assign(this, t);
    }
    updateControlPoints(t, e) {
        let s = this.options;
        if ((s.tension || s.cubicInterpolationMode === "monotone") && !s.stepped && !this._pointsUpdated) {
            let n = s.spanGaps ? this._loop : this._fullLoop;
            Ks(this._points, s, t, n, e), this._pointsUpdated = !0;
        }
    }
    set points(t) {
        this._points = t, delete this._segments, delete this._path, this._pointsUpdated = !1;
    }
    get points() {
        return this._points;
    }
    get segments() {
        return this._segments || (this._segments = tn(this, this.options.segment));
    }
    first() {
        let t = this.segments, e = this.points;
        return t.length && e[t[0].start];
    }
    last() {
        let t = this.segments, e = this.points, s = t.length;
        return s && e[t[s - 1].end];
    }
    interpolate(t, e) {
        let s = this.options, n = t[e], o = this.points, a = Oi(this, {
            property: e,
            start: n,
            end: n
        });
        if (!a.length) return;
        let r = [], l = Jr(s), c, h;
        for(c = 0, h = a.length; c < h; ++c){
            let { start: d, end: u } = a[c], f = o[d], p = o[u];
            if (f === p) {
                r.push(f);
                continue;
            }
            let g = Math.abs((n - f[e]) / (p[e] - f[e])), m = l(f, p, g, s.stepped);
            m[e] = t[e], r.push(m);
        }
        return r.length === 1 ? r[0] : r;
    }
    pathSegment(t, e, s) {
        return is(this)(t, this, e, s);
    }
    path(t, e, s) {
        let n = this.segments, o = is(this), a = this._loop;
        e = e || 0, s = s || this.points.length - e;
        for (let r of n)a &= o(t, this, r, {
            start: e,
            end: e + s - 1
        });
        return !!a;
    }
    draw(t, e, s, n) {
        let o = this.options || {};
        (this.points || []).length && o.borderWidth && (t.save(), el(t, this, s, n), t.restore()), this.animated && (this._pointsUpdated = !1, this._path = void 0);
    }
};
function Dn(i, t, e, s) {
    let n = i.options, { [e]: o } = i.getProps([
        e
    ], s);
    return Math.abs(t - o) < n.radius + n.hitRadius;
}
var ss = class extends ot1 {
    static id = "point";
    static defaults = {
        borderWidth: 1,
        hitRadius: 1,
        hoverBorderWidth: 1,
        hoverRadius: 4,
        pointStyle: "circle",
        radius: 3,
        rotation: 0
    };
    static defaultRoutes = {
        backgroundColor: "backgroundColor",
        borderColor: "borderColor"
    };
    constructor(t){
        super(), this.options = void 0, this.parsed = void 0, this.skip = void 0, this.stop = void 0, t && Object.assign(this, t);
    }
    inRange(t, e, s) {
        let n = this.options, { x: o, y: a } = this.getProps([
            "x",
            "y"
        ], s);
        return Math.pow(t - o, 2) + Math.pow(e - a, 2) < Math.pow(n.hitRadius + n.radius, 2);
    }
    inXRange(t, e) {
        return Dn(this, t, "x", e);
    }
    inYRange(t, e) {
        return Dn(this, t, "y", e);
    }
    getCenterPoint(t) {
        let { x: e, y: s } = this.getProps([
            "x",
            "y"
        ], t);
        return {
            x: e,
            y: s
        };
    }
    size(t) {
        t = t || this.options || {};
        let e = t.radius || 0;
        e = Math.max(e, e && t.hoverRadius || 0);
        let s = e && t.borderWidth || 0;
        return (e + s) * 2;
    }
    draw(t, e) {
        let s = this.options;
        this.skip || s.radius < .1 || !Ft(this, e, this.size(s) / 2) || (t.strokeStyle = s.borderColor, t.lineWidth = s.borderWidth, t.fillStyle = s.backgroundColor, Le1(t, s, this.x, this.y));
    }
    getRange() {
        let t = this.options || {};
        return t.radius + t.hitRadius;
    }
};
function ho(i, t) {
    let { x: e, y: s, base: n, width: o, height: a } = i.getProps([
        "x",
        "y",
        "base",
        "width",
        "height"
    ], t), r, l, c, h, d;
    return i.horizontal ? (d = a / 2, r = Math.min(e, n), l = Math.max(e, n), c = s - d, h = s + d) : (d = o / 2, r = e - d, l = e + d, c = Math.min(s, n), h = Math.max(s, n)), {
        left: r,
        top: c,
        right: l,
        bottom: h
    };
}
function wt(i, t, e, s) {
    return i ? 0 : $2(t, e, s);
}
function il(i, t, e) {
    let s = i.options.borderWidth, n = i.borderSkipped, o = _i(s);
    return {
        t: wt(n.top, o.top, 0, e),
        r: wt(n.right, o.right, 0, t),
        b: wt(n.bottom, o.bottom, 0, e),
        l: wt(n.left, o.left, 0, t)
    };
}
function sl(i, t, e) {
    let { enableBorderRadius: s } = i.getProps([
        "enableBorderRadius"
    ]), n = i.options.borderRadius, o = Mt(n), a = Math.min(t, e), r = i.borderSkipped, l = s || O2(n);
    return {
        topLeft: wt(!l || r.top || r.left, o.topLeft, 0, a),
        topRight: wt(!l || r.top || r.right, o.topRight, 0, a),
        bottomLeft: wt(!l || r.bottom || r.left, o.bottomLeft, 0, a),
        bottomRight: wt(!l || r.bottom || r.right, o.bottomRight, 0, a)
    };
}
function nl(i) {
    let t = ho(i), e = t.right - t.left, s = t.bottom - t.top, n = il(i, e / 2, s / 2), o = sl(i, e / 2, s / 2);
    return {
        outer: {
            x: t.left,
            y: t.top,
            w: e,
            h: s,
            radius: o
        },
        inner: {
            x: t.left + n.l,
            y: t.top + n.t,
            w: e - n.l - n.r,
            h: s - n.t - n.b,
            radius: {
                topLeft: Math.max(0, o.topLeft - Math.max(n.t, n.l)),
                topRight: Math.max(0, o.topRight - Math.max(n.t, n.r)),
                bottomLeft: Math.max(0, o.bottomLeft - Math.max(n.b, n.l)),
                bottomRight: Math.max(0, o.bottomRight - Math.max(n.b, n.r))
            }
        }
    };
}
function zi(i, t, e, s) {
    let n = t === null, o = e === null, r = i && !(n && o) && ho(i, s);
    return r && (n || lt(t, r.left, r.right)) && (o || lt(e, r.top, r.bottom));
}
function ol(i) {
    return i.topLeft || i.topRight || i.bottomLeft || i.bottomRight;
}
function al(i, t) {
    i.rect(t.x, t.y, t.w, t.h);
}
function Fi(i, t, e = {}) {
    let s = i.x !== e.x ? -t : 0, n = i.y !== e.y ? -t : 0, o = (i.x + i.w !== e.x + e.w ? t : 0) - s, a = (i.y + i.h !== e.y + e.h ? t : 0) - n;
    return {
        x: i.x + s,
        y: i.y + n,
        w: i.w + o,
        h: i.h + a,
        radius: i.radius
    };
}
var ns = class extends ot1 {
    static id = "bar";
    static defaults = {
        borderSkipped: "start",
        borderWidth: 0,
        borderRadius: 0,
        inflateAmount: "auto",
        pointStyle: void 0
    };
    static defaultRoutes = {
        backgroundColor: "backgroundColor",
        borderColor: "borderColor"
    };
    constructor(t){
        super(), this.options = void 0, this.horizontal = void 0, this.base = void 0, this.width = void 0, this.height = void 0, this.inflateAmount = void 0, t && Object.assign(this, t);
    }
    draw(t) {
        let { inflateAmount: e, options: { borderColor: s, backgroundColor: n } } = this, { inner: o, outer: a } = nl(this), r = ol(a.radius) ? $t : al;
        t.save(), (a.w !== o.w || a.h !== o.h) && (t.beginPath(), r(t, Fi(a, e, o)), t.clip(), r(t, Fi(o, -e, a)), t.fillStyle = s, t.fill("evenodd")), t.beginPath(), r(t, Fi(o, e)), t.fillStyle = n, t.fill(), t.restore();
    }
    inRange(t, e, s) {
        return zi(this, t, e, s);
    }
    inXRange(t, e) {
        return zi(this, t, null, e);
    }
    inYRange(t, e) {
        return zi(this, null, t, e);
    }
    getCenterPoint(t) {
        let { x: e, y: s, base: n, horizontal: o } = this.getProps([
            "x",
            "y",
            "base",
            "horizontal"
        ], t);
        return {
            x: o ? (e + n) / 2 : e,
            y: o ? s : (s + n) / 2
        };
    }
    getRange(t) {
        return t === "x" ? this.width / 2 : this.height / 2;
    }
}, rl = Object.freeze({
    __proto__: null,
    ArcElement: es,
    LineElement: Kt,
    PointElement: ss,
    BarElement: ns
}), os = [
    "rgb(54, 162, 235)",
    "rgb(255, 99, 132)",
    "rgb(255, 159, 64)",
    "rgb(255, 205, 86)",
    "rgb(75, 192, 192)",
    "rgb(153, 102, 255)",
    "rgb(201, 203, 207)"
], On = os.map((i)=>i.replace("rgb(", "rgba(").replace(")", ", 0.5)"));
function uo(i) {
    return os[i % os.length];
}
function fo(i) {
    return On[i % On.length];
}
function ll(i, t) {
    return i.borderColor = uo(t), i.backgroundColor = fo(t), ++t;
}
function cl(i, t) {
    return i.backgroundColor = i.data.map(()=>uo(t++)), t;
}
function hl(i, t) {
    return i.backgroundColor = i.data.map(()=>fo(t++)), t;
}
function dl(i) {
    let t = 0;
    return (e, s)=>{
        let n = i.getDatasetMeta(s).controller;
        n instanceof ue ? t = cl(e, t) : n instanceof Ue1 ? t = hl(e, t) : n && (t = ll(e, t));
    };
}
function An(i) {
    let t;
    for(t in i)if (i[t].borderColor || i[t].backgroundColor) return !0;
    return !1;
}
var ul = {
    id: "colors",
    defaults: {
        enabled: !0,
        forceOverride: !1
    },
    beforeLayout (i, t, e) {
        if (!e.enabled) return;
        let { options: { elements: s }, data: { datasets: n } } = i.config;
        if (!e.forceOverride && (An(n) || s && An(s))) return;
        let o = dl(i);
        n.forEach(o);
    }
};
function fl(i, t, e, s, n) {
    let o = n.samples || s;
    if (o >= e) return i.slice(t, t + e);
    let a = [], r = (e - 2) / (o - 2), l = 0, c = t + e - 1, h = t, d, u, f, p, g;
    for(a[l++] = i[h], d = 0; d < o - 2; d++){
        let m = 0, b = 0, _, y = Math.floor((d + 1) * r) + 1 + t, v = Math.min(Math.floor((d + 2) * r) + 1, e) + t, x = v - y;
        for(_ = y; _ < v; _++)m += i[_].x, b += i[_].y;
        m /= x, b /= x;
        let M = Math.floor(d * r) + 1 + t, k = Math.min(Math.floor((d + 1) * r) + 1, e) + t, { x: w, y: S } = i[h];
        for(f = p = -1, _ = M; _ < k; _++)p = .5 * Math.abs((w - m) * (i[_].y - S) - (w - i[_].x) * (b - S)), p > f && (f = p, u = i[_], g = _);
        a[l++] = u, h = g;
    }
    return a[l++] = i[c], a;
}
function gl(i, t, e, s) {
    let n = 0, o = 0, a, r, l, c, h, d, u, f, p, g, m = [], b = t + e - 1, _ = i[t].x, v = i[b].x - _;
    for(a = t; a < t + e; ++a){
        r = i[a], l = (r.x - _) / v * s, c = r.y;
        let x = l | 0;
        if (x === h) c < p ? (p = c, d = a) : c > g && (g = c, u = a), n = (o * n + r.x) / ++o;
        else {
            let M = a - 1;
            if (!A1(d) && !A1(u)) {
                let k = Math.min(d, u), w = Math.max(d, u);
                k !== f && k !== M && m.push({
                    ...i[k],
                    x: n
                }), w !== f && w !== M && m.push({
                    ...i[w],
                    x: n
                });
            }
            a > 0 && M !== f && m.push(i[M]), m.push(r), h = x, o = 0, p = g = c, d = u = f = a;
        }
    }
    return m;
}
function go(i) {
    if (i._decimated) {
        let t = i._data;
        delete i._decimated, delete i._data, Object.defineProperty(i, "data", {
            value: t
        });
    }
}
function Ln(i) {
    i.data.datasets.forEach((t)=>{
        go(t);
    });
}
function pl(i, t) {
    let e = t.length, s = 0, n, { iScale: o } = i, { min: a, max: r, minDefined: l, maxDefined: c } = o.getUserBounds();
    return l && (s = $2(at(t, o.axis, a).lo, 0, e - 1)), c ? n = $2(at(t, o.axis, r).hi + 1, s, e) - s : n = e - s, {
        start: s,
        count: n
    };
}
var ml = {
    id: "decimation",
    defaults: {
        algorithm: "min-max",
        enabled: !1
    },
    beforeElementsUpdate: (i, t, e)=>{
        if (!e.enabled) {
            Ln(i);
            return;
        }
        let s = i.width;
        i.data.datasets.forEach((n, o)=>{
            let { _data: a, indexAxis: r } = n, l = i.getDatasetMeta(o), c = a || n.data;
            if (Ut([
                r,
                i.options.indexAxis
            ]) === "y" || !l.controller.supportsDecimation) return;
            let h = i.scales[l.xAxisID];
            if (h.type !== "linear" && h.type !== "time" || i.options.parsing) return;
            let { start: d, count: u } = pl(l, c), f = e.threshold || 4 * s;
            if (u <= f) {
                go(n);
                return;
            }
            A1(a) && (n._data = c, delete n.data, Object.defineProperty(n, "data", {
                configurable: !0,
                enumerable: !0,
                get: function() {
                    return this._decimated;
                },
                set: function(g) {
                    this._data = g;
                }
            }));
            let p;
            switch(e.algorithm){
                case "lttb":
                    p = fl(c, d, u, s, e);
                    break;
                case "min-max":
                    p = gl(c, d, u, s);
                    break;
                default:
                    throw new Error(`Unsupported decimation algorithm '${e.algorithm}'`);
            }
            n._decimated = p;
        });
    },
    destroy (i) {
        Ln(i);
    }
};
function bl(i, t, e) {
    let s = i.segments, n = i.points, o = t.points, a = [];
    for (let r of s){
        let { start: l, end: c } = r;
        c = fs(l, c, n);
        let h = as(e, n[l], n[c], r.loop);
        if (!t.segments) {
            a.push({
                source: r,
                target: h,
                start: n[l],
                end: n[c]
            });
            continue;
        }
        let d = Oi(t, h);
        for (let u of d){
            let f = as(e, o[u.start], o[u.end], u.loop), p = Di(r, n, f);
            for (let g of p)a.push({
                source: g,
                target: u,
                start: {
                    [e]: Tn(h, f, "start", Math.max)
                },
                end: {
                    [e]: Tn(h, f, "end", Math.min)
                }
            });
        }
    }
    return a;
}
function as(i, t, e, s) {
    if (s) return;
    let n = t[i], o = e[i];
    return i === "angle" && (n = G2(n), o = G2(o)), {
        property: i,
        start: n,
        end: o
    };
}
function _l(i, t) {
    let { x: e = null, y: s = null } = i || {}, n = t.points, o = [];
    return t.segments.forEach(({ start: a, end: r })=>{
        r = fs(a, r, n);
        let l = n[a], c = n[r];
        s !== null ? (o.push({
            x: l.x,
            y: s
        }), o.push({
            x: c.x,
            y: s
        })) : e !== null && (o.push({
            x: e,
            y: l.y
        }), o.push({
            x: e,
            y: c.y
        }));
    }), o;
}
function fs(i, t, e) {
    for(; t > i; t--){
        let s = e[t];
        if (!isNaN(s.x) && !isNaN(s.y)) break;
    }
    return t;
}
function Tn(i, t, e, s) {
    return i && t ? s(i[e], t[e]) : i ? i[e] : t ? t[e] : 0;
}
function po(i, t) {
    let e = [], s = !1;
    return I1(i) ? (s = !0, e = i) : e = _l(i, t), e.length ? new Kt({
        points: e,
        options: {
            tension: 0
        },
        _loop: s,
        _fullLoop: s
    }) : null;
}
function Rn(i) {
    return i && i.fill !== !1;
}
function xl(i, t, e) {
    let n = i[t].fill, o = [
        t
    ], a;
    if (!e) return n;
    for(; n !== !1 && o.indexOf(n) === -1;){
        if (!N2(n)) return n;
        if (a = i[n], !a) return !1;
        if (a.visible) return n;
        o.push(n), n = a.fill;
    }
    return !1;
}
function yl(i, t, e) {
    let s = wl(i);
    if (O2(s)) return isNaN(s.value) ? !1 : s;
    let n = parseFloat(s);
    return N2(n) && Math.floor(n) === n ? vl(s[0], t, n, e) : [
        "origin",
        "start",
        "end",
        "stack",
        "shape"
    ].indexOf(s) >= 0 && s;
}
function vl(i, t, e, s) {
    return (i === "-" || i === "+") && (e = t + e), e === t || e < 0 || e >= s ? !1 : e;
}
function Ml(i, t) {
    let e = null;
    return i === "start" ? e = t.bottom : i === "end" ? e = t.top : O2(i) ? e = t.getPixelForValue(i.value) : t.getBasePixel && (e = t.getBasePixel()), e;
}
function kl(i, t, e) {
    let s;
    return i === "start" ? s = e : i === "end" ? s = t.options.reverse ? t.min : t.max : O2(i) ? s = i.value : s = t.getBaseValue(), s;
}
function wl(i) {
    let t = i.options, e = t.fill, s = P1(e && e.target, e);
    return s === void 0 && (s = !!t.backgroundColor), s === !1 || s === null ? !1 : s === !0 ? "origin" : s;
}
function Sl(i) {
    let { scale: t, index: e, line: s } = i, n = [], o = s.segments, a = s.points, r = Pl(t, e);
    r.push(po({
        x: null,
        y: t.bottom
    }, s));
    for(let l = 0; l < o.length; l++){
        let c = o[l];
        for(let h = c.start; h <= c.end; h++)Cl(n, a[h], r);
    }
    return new Kt({
        points: n,
        options: {}
    });
}
function Pl(i, t) {
    let e = [], s = i.getMatchingVisibleMetas("line");
    for(let n = 0; n < s.length; n++){
        let o = s[n];
        if (o.index === t) break;
        o.hidden || e.unshift(o.dataset);
    }
    return e;
}
function Cl(i, t, e) {
    let s = [];
    for(let n = 0; n < e.length; n++){
        let o = e[n], { first: a, last: r, point: l } = Dl(o, t, "x");
        if (!(!l || a && r)) {
            if (a) s.unshift(l);
            else if (i.push(l), !r) break;
        }
    }
    i.push(...s);
}
function Dl(i, t, e) {
    let s = i.interpolate(t, e);
    if (!s) return {};
    let n = s[e], o = i.segments, a = i.points, r = !1, l = !1;
    for(let c = 0; c < o.length; c++){
        let h = o[c], d = a[h.start][e], u = a[h.end][e];
        if (lt(n, d, u)) {
            r = n === d, l = n === u;
            break;
        }
    }
    return {
        first: r,
        last: l,
        point: s
    };
}
var Ge = class {
    constructor(t){
        this.x = t.x, this.y = t.y, this.radius = t.radius;
    }
    pathSegment(t, e, s) {
        let { x: n, y: o, radius: a } = this;
        return e = e || {
            start: 0,
            end: z1
        }, t.arc(n, o, a, e.end, e.start, !0), !s.bounds;
    }
    interpolate(t) {
        let { x: e, y: s, radius: n } = this, o = t.angle;
        return {
            x: e + Math.cos(o) * n,
            y: s + Math.sin(o) * n,
            angle: o
        };
    }
};
function Ol(i) {
    let { chart: t, fill: e, line: s } = i;
    if (N2(e)) return Al(t, e);
    if (e === "stack") return Sl(i);
    if (e === "shape") return !0;
    let n = Ll(i);
    return n instanceof Ge ? n : po(n, s);
}
function Al(i, t) {
    let e = i.getDatasetMeta(t);
    return e && i.isDatasetVisible(t) ? e.dataset : null;
}
function Ll(i) {
    return (i.scale || {}).getPointPositionForValue ? Rl(i) : Tl(i);
}
function Tl(i) {
    let { scale: t = {}, fill: e } = i, s = Ml(e, t);
    if (N2(s)) {
        let n = t.isHorizontal();
        return {
            x: n ? s : null,
            y: n ? null : s
        };
    }
    return null;
}
function Rl(i) {
    let { scale: t, fill: e } = i, s = t.options, n = t.getLabels().length, o = s.reverse ? t.max : t.min, a = kl(e, t, o), r = [];
    if (s.grid.circular) {
        let l = t.getPointPositionForValue(0, o);
        return new Ge({
            x: l.x,
            y: l.y,
            radius: t.getDistanceFromCenterForValue(a)
        });
    }
    for(let l = 0; l < n; ++l)r.push(t.getPointPositionForValue(l, a));
    return r;
}
function Bi(i, t, e) {
    let s = Ol(t), { line: n, scale: o, axis: a } = t, r = n.options, l = r.fill, c = r.backgroundColor, { above: h = c, below: d = c } = l || {};
    s && n.points.length && (se1(i, e), El(i, {
        line: n,
        target: s,
        above: h,
        below: d,
        area: e,
        scale: o,
        axis: a
    }), ne1(i));
}
function El(i, t) {
    let { line: e, target: s, above: n, below: o, area: a, scale: r } = t, l = e._loop ? "angle" : t.axis;
    i.save(), l === "x" && o !== n && (En(i, s, a.top), In(i, {
        line: e,
        target: s,
        color: n,
        scale: r,
        property: l
    }), i.restore(), i.save(), En(i, s, a.bottom)), In(i, {
        line: e,
        target: s,
        color: o,
        scale: r,
        property: l
    }), i.restore();
}
function En(i, t, e) {
    let { segments: s, points: n } = t, o = !0, a = !1;
    i.beginPath();
    for (let r of s){
        let { start: l, end: c } = r, h = n[l], d = n[fs(l, c, n)];
        o ? (i.moveTo(h.x, h.y), o = !1) : (i.lineTo(h.x, e), i.lineTo(h.x, h.y)), a = !!t.pathSegment(i, r, {
            move: a
        }), a ? i.closePath() : i.lineTo(d.x, e);
    }
    i.lineTo(t.first().x, e), i.closePath(), i.clip();
}
function In(i, t) {
    let { line: e, target: s, property: n, color: o, scale: a } = t, r = bl(e, s, n);
    for (let { source: l, target: c, start: h, end: d } of r){
        let { style: { backgroundColor: u = o } = {} } = l, f = s !== !0;
        i.save(), i.fillStyle = u, Il(i, a, f && as(n, h, d)), i.beginPath();
        let p = !!e.pathSegment(i, l), g;
        if (f) {
            p ? i.closePath() : zn(i, s, d, n);
            let m = !!s.pathSegment(i, c, {
                move: p,
                reverse: !0
            });
            g = p && m, g || zn(i, s, h, n);
        }
        i.closePath(), i.fill(g ? "evenodd" : "nonzero"), i.restore();
    }
}
function Il(i, t, e) {
    let { top: s, bottom: n } = t.chart.chartArea, { property: o, start: a, end: r } = e || {};
    o === "x" && (i.beginPath(), i.rect(a, s, r - a, n - s), i.clip());
}
function zn(i, t, e, s) {
    let n = t.interpolate(e, s);
    n && i.lineTo(n.x, n.y);
}
var zl = {
    id: "filler",
    afterDatasetsUpdate (i, t, e) {
        let s = (i.data.datasets || []).length, n = [], o, a, r, l;
        for(a = 0; a < s; ++a)o = i.getDatasetMeta(a), r = o.dataset, l = null, r && r.options && r instanceof Kt && (l = {
            visible: i.isDatasetVisible(a),
            index: a,
            fill: yl(r, a, s),
            chart: i,
            axis: o.controller.options.indexAxis,
            scale: o.vScale,
            line: r
        }), o.$filler = l, n.push(l);
        for(a = 0; a < s; ++a)l = n[a], !(!l || l.fill === !1) && (l.fill = xl(n, a, e.propagate));
    },
    beforeDraw (i, t, e) {
        let s = e.drawTime === "beforeDraw", n = i.getSortedVisibleDatasetMetas(), o = i.chartArea;
        for(let a = n.length - 1; a >= 0; --a){
            let r = n[a].$filler;
            r && (r.line.updateControlPoints(o, r.axis), s && r.fill && Bi(i.ctx, r, o));
        }
    },
    beforeDatasetsDraw (i, t, e) {
        if (e.drawTime !== "beforeDatasetsDraw") return;
        let s = i.getSortedVisibleDatasetMetas();
        for(let n = s.length - 1; n >= 0; --n){
            let o = s[n].$filler;
            Rn(o) && Bi(i.ctx, o, i.chartArea);
        }
    },
    beforeDatasetDraw (i, t, e) {
        let s = t.meta.$filler;
        !Rn(s) || e.drawTime !== "beforeDatasetDraw" || Bi(i.ctx, s, i.chartArea);
    },
    defaults: {
        propagate: !0,
        drawTime: "beforeDatasetDraw"
    }
}, Fn = (i, t)=>{
    let { boxHeight: e = t, boxWidth: s = t } = i;
    return i.usePointStyle && (e = Math.min(e, t), s = i.pointStyleWidth || Math.min(s, t)), {
        boxWidth: s,
        boxHeight: e,
        itemHeight: Math.max(t, e)
    };
}, Fl = (i, t)=>i !== null && t !== null && i.datasetIndex === t.datasetIndex && i.index === t.index, Je1 = class extends ot1 {
    constructor(t){
        super(), this._added = !1, this.legendHitBoxes = [], this._hoveredItem = null, this.doughnutMode = !1, this.chart = t.chart, this.options = t.options, this.ctx = t.ctx, this.legendItems = void 0, this.columnSizes = void 0, this.lineWidths = void 0, this.maxHeight = void 0, this.maxWidth = void 0, this.top = void 0, this.bottom = void 0, this.left = void 0, this.right = void 0, this.height = void 0, this.width = void 0, this._margins = void 0, this.position = void 0, this.weight = void 0, this.fullSize = void 0;
    }
    update(t, e, s) {
        this.maxWidth = t, this.maxHeight = e, this._margins = s, this.setDimensions(), this.buildLabels(), this.fit();
    }
    setDimensions() {
        this.isHorizontal() ? (this.width = this.maxWidth, this.left = this._margins.left, this.right = this.width) : (this.height = this.maxHeight, this.top = this._margins.top, this.bottom = this.height);
    }
    buildLabels() {
        let t = this.options.labels || {}, e = E1(t.generateLabels, [
            this.chart
        ], this) || [];
        t.filter && (e = e.filter((s)=>t.filter(s, this.chart.data))), t.sort && (e = e.sort((s, n)=>t.sort(s, n, this.chart.data))), this.options.reverse && e.reverse(), this.legendItems = e;
    }
    fit() {
        let { options: t, ctx: e } = this;
        if (!t.display) {
            this.width = this.height = 0;
            return;
        }
        let s = t.labels, n = j1(s.font), o = n.size, a = this._computeTitleHeight(), { boxWidth: r, itemHeight: l } = Fn(s, o), c, h;
        e.font = n.string, this.isHorizontal() ? (c = this.maxWidth, h = this._fitRows(a, o, r, l) + 10) : (h = this.maxHeight, c = this._fitCols(a, n, r, l) + 10), this.width = Math.min(c, t.maxWidth || this.maxWidth), this.height = Math.min(h, t.maxHeight || this.maxHeight);
    }
    _fitRows(t, e, s, n) {
        let { ctx: o, maxWidth: a, options: { labels: { padding: r } } } = this, l = this.legendHitBoxes = [], c = this.lineWidths = [
            0
        ], h = n + r, d = t;
        o.textAlign = "left", o.textBaseline = "middle";
        let u = -1, f = -h;
        return this.legendItems.forEach((p, g)=>{
            let m = s + e / 2 + o.measureText(p.text).width;
            (g === 0 || c[c.length - 1] + m + 2 * r > a) && (d += h, c[c.length - (g > 0 ? 0 : 1)] = 0, f += h, u++), l[g] = {
                left: 0,
                top: f,
                row: u,
                width: m,
                height: n
            }, c[c.length - 1] += m + r;
        }), d;
    }
    _fitCols(t, e, s, n) {
        let { ctx: o, maxHeight: a, options: { labels: { padding: r } } } = this, l = this.legendHitBoxes = [], c = this.columnSizes = [], h = a - t, d = r, u = 0, f = 0, p = 0, g = 0;
        return this.legendItems.forEach((m, b)=>{
            let { itemWidth: _, itemHeight: y } = Bl(s, e, o, m, n);
            b > 0 && f + y + 2 * r > h && (d += u + r, c.push({
                width: u,
                height: f
            }), p += u + r, g++, u = f = 0), l[b] = {
                left: p,
                top: f,
                col: g,
                width: _,
                height: y
            }, u = Math.max(u, _), f += y + r;
        }), d += u, c.push({
            width: u,
            height: f
        }), d;
    }
    adjustHitBoxes() {
        if (!this.options.display) return;
        let t = this._computeTitleHeight(), { legendHitBoxes: e, options: { align: s, labels: { padding: n }, rtl: o } } = this, a = Ot(o, this.left, this.width);
        if (this.isHorizontal()) {
            let r = 0, l = Y2(s, this.left + n, this.right - this.lineWidths[r]);
            for (let c of e)r !== c.row && (r = c.row, l = Y2(s, this.left + n, this.right - this.lineWidths[r])), c.top += this.top + t + n, c.left = a.leftForLtr(a.x(l), c.width), l += c.width + n;
        } else {
            let r = 0, l = Y2(s, this.top + t + n, this.bottom - this.columnSizes[r].height);
            for (let c of e)c.col !== r && (r = c.col, l = Y2(s, this.top + t + n, this.bottom - this.columnSizes[r].height)), c.top = l, c.left += this.left + n, c.left = a.leftForLtr(a.x(c.left), c.width), l += c.height + n;
        }
    }
    isHorizontal() {
        return this.options.position === "top" || this.options.position === "bottom";
    }
    draw() {
        if (this.options.display) {
            let t = this.ctx;
            se1(t, this), this._draw(), ne1(t);
        }
    }
    _draw() {
        let { options: t, columnSizes: e, lineWidths: s, ctx: n } = this, { align: o, labels: a } = t, r = W1.color, l = Ot(t.rtl, this.left, this.width), c = j1(a.font), { padding: h } = a, d = c.size, u = d / 2, f;
        this.drawTitle(), n.textAlign = l.textAlign("left"), n.textBaseline = "middle", n.lineWidth = .5, n.font = c.string;
        let { boxWidth: p, boxHeight: g, itemHeight: m } = Fn(a, d), b = function(M, k, w) {
            if (isNaN(p) || p <= 0 || isNaN(g) || g < 0) return;
            n.save();
            let S = P1(w.lineWidth, 1);
            if (n.fillStyle = P1(w.fillStyle, r), n.lineCap = P1(w.lineCap, "butt"), n.lineDashOffset = P1(w.lineDashOffset, 0), n.lineJoin = P1(w.lineJoin, "miter"), n.lineWidth = S, n.strokeStyle = P1(w.strokeStyle, r), n.setLineDash(P1(w.lineDash, [])), a.usePointStyle) {
                let C = {
                    radius: g * Math.SQRT2 / 2,
                    pointStyle: w.pointStyle,
                    rotation: w.rotation,
                    borderWidth: S
                }, D = l.xPlus(M, p / 2), L = k + u;
                bi(n, C, D, L, a.pointStyleWidth && p);
            } else {
                let C = k + Math.max((d - g) / 2, 0), D = l.leftForLtr(M, p), L = Mt(w.borderRadius);
                n.beginPath(), Object.values(L).some((U)=>U !== 0) ? $t(n, {
                    x: D,
                    y: C,
                    w: p,
                    h: g,
                    radius: L
                }) : n.rect(D, C, p, g), n.fill(), S !== 0 && n.stroke();
            }
            n.restore();
        }, _ = function(M, k, w) {
            vt(n, w.text, M, k + m / 2, c, {
                strikethrough: w.hidden,
                textAlign: l.textAlign(w.textAlign)
            });
        }, y = this.isHorizontal(), v = this._computeTitleHeight();
        y ? f = {
            x: Y2(o, this.left + h, this.right - s[0]),
            y: this.top + h + v,
            line: 0
        } : f = {
            x: this.left + h,
            y: Y2(o, this.top + v + h, this.bottom - e[0].height),
            line: 0
        }, Pi(this.ctx, t.textDirection);
        let x = m + h;
        this.legendItems.forEach((M, k)=>{
            n.strokeStyle = M.fontColor, n.fillStyle = M.fontColor;
            let w = n.measureText(M.text).width, S = l.textAlign(M.textAlign || (M.textAlign = a.textAlign)), C = p + u + w, D = f.x, L = f.y;
            l.setWidth(this.width), y ? k > 0 && D + C + h > this.right && (L = f.y += x, f.line++, D = f.x = Y2(o, this.left + h, this.right - s[f.line])) : k > 0 && L + x > this.bottom && (D = f.x = D + e[f.line].width + h, f.line++, L = f.y = Y2(o, this.top + v + h, this.bottom - e[f.line].height));
            let U = l.x(D);
            if (b(U, L, M), D = Fs(S, D + p + u, y ? D + C : this.right, t.rtl), _(l.x(D), L, M), y) f.x += C + h;
            else if (typeof M.text != "string") {
                let tt = c.lineHeight;
                f.y += mo(M, tt);
            } else f.y += x;
        }), Ci(this.ctx, t.textDirection);
    }
    drawTitle() {
        let t = this.options, e = t.title, s = j1(e.font), n = X2(e.padding);
        if (!e.display) return;
        let o = Ot(t.rtl, this.left, this.width), a = this.ctx, r = e.position, l = s.size / 2, c = n.top + l, h, d = this.left, u = this.width;
        if (this.isHorizontal()) u = Math.max(...this.lineWidths), h = this.top + c, d = Y2(t.align, d, this.right - u);
        else {
            let p = this.columnSizes.reduce((g, m)=>Math.max(g, m.height), 0);
            h = c + Y2(t.align, this.top, this.bottom - p - t.labels.padding - this._computeTitleHeight());
        }
        let f = Y2(r, d, d + u);
        a.textAlign = o.textAlign(Oe(r)), a.textBaseline = "middle", a.strokeStyle = e.color, a.fillStyle = e.color, a.font = s.string, vt(a, e.text, f, h, s);
    }
    _computeTitleHeight() {
        let t = this.options.title, e = j1(t.font), s = X2(t.padding);
        return t.display ? e.lineHeight + s.height : 0;
    }
    _getLegendItemAt(t, e) {
        let s, n, o;
        if (lt(t, this.left, this.right) && lt(e, this.top, this.bottom)) {
            for(o = this.legendHitBoxes, s = 0; s < o.length; ++s)if (n = o[s], lt(t, n.left, n.left + n.width) && lt(e, n.top, n.top + n.height)) return this.legendItems[s];
        }
        return null;
    }
    handleEvent(t) {
        let e = this.options;
        if (!Wl(t.type, e)) return;
        let s = this._getLegendItemAt(t.x, t.y);
        if (t.type === "mousemove" || t.type === "mouseout") {
            let n = this._hoveredItem, o = Fl(n, s);
            n && !o && E1(e.onLeave, [
                t,
                n,
                this
            ], this), this._hoveredItem = s, s && !o && E1(e.onHover, [
                t,
                s,
                this
            ], this);
        } else s && E1(e.onClick, [
            t,
            s,
            this
        ], this);
    }
};
function Bl(i, t, e, s, n) {
    let o = Vl(s, i, t, e), a = Nl(n, s, t.lineHeight);
    return {
        itemWidth: o,
        itemHeight: a
    };
}
function Vl(i, t, e, s) {
    let n = i.text;
    return n && typeof n != "string" && (n = n.reduce((o, a)=>o.length > a.length ? o : a)), t + e.size / 2 + s.measureText(n).width;
}
function Nl(i, t, e) {
    let s = i;
    return typeof t.text != "string" && (s = mo(t, e)), s;
}
function mo(i, t) {
    let e = i.text ? i.text.length + .5 : 0;
    return t * e;
}
function Wl(i, t) {
    return !!((i === "mousemove" || i === "mouseout") && (t.onHover || t.onLeave) || t.onClick && (i === "click" || i === "mouseup"));
}
var Hl = {
    id: "legend",
    _element: Je1,
    start (i, t, e) {
        let s = i.legend = new Je1({
            ctx: i.ctx,
            options: e,
            chart: i
        });
        q1.configure(i, s, e), q1.addBox(i, s);
    },
    stop (i) {
        q1.removeBox(i, i.legend), delete i.legend;
    },
    beforeUpdate (i, t, e) {
        let s = i.legend;
        q1.configure(i, s, e), s.options = e;
    },
    afterUpdate (i) {
        let t = i.legend;
        t.buildLabels(), t.adjustHitBoxes();
    },
    afterEvent (i, t) {
        t.replay || i.legend.handleEvent(t.event);
    },
    defaults: {
        display: !0,
        position: "top",
        align: "center",
        fullSize: !0,
        reverse: !1,
        weight: 1e3,
        onClick (i, t, e) {
            let s = t.datasetIndex, n = e.chart;
            n.isDatasetVisible(s) ? (n.hide(s), t.hidden = !0) : (n.show(s), t.hidden = !1);
        },
        onHover: null,
        onLeave: null,
        labels: {
            color: (i)=>i.chart.options.color,
            boxWidth: 40,
            padding: 10,
            generateLabels (i) {
                let t = i.data.datasets, { labels: { usePointStyle: e, pointStyle: s, textAlign: n, color: o, useBorderRadius: a, borderRadius: r } } = i.legend.options;
                return i._getSortedDatasetMetas().map((l)=>{
                    let c = l.controller.getStyle(e ? 0 : void 0), h = X2(c.borderWidth);
                    return {
                        text: t[l.index].label,
                        fillStyle: c.backgroundColor,
                        fontColor: o,
                        hidden: !l.visible,
                        lineCap: c.borderCapStyle,
                        lineDash: c.borderDash,
                        lineDashOffset: c.borderDashOffset,
                        lineJoin: c.borderJoinStyle,
                        lineWidth: (h.width + h.height) / 4,
                        strokeStyle: c.borderColor,
                        pointStyle: s || c.pointStyle,
                        rotation: c.rotation,
                        textAlign: n || c.textAlign,
                        borderRadius: a && (r || c.borderRadius),
                        datasetIndex: l.index
                    };
                }, this);
            }
        },
        title: {
            color: (i)=>i.chart.options.color,
            display: !1,
            position: "center",
            text: ""
        }
    },
    descriptors: {
        _scriptable: (i)=>!i.startsWith("on"),
        labels: {
            _scriptable: (i)=>![
                    "generateLabels",
                    "filter",
                    "sort"
                ].includes(i)
        }
    }
}, ge = class extends ot1 {
    constructor(t){
        super(), this.chart = t.chart, this.options = t.options, this.ctx = t.ctx, this._padding = void 0, this.top = void 0, this.bottom = void 0, this.left = void 0, this.right = void 0, this.width = void 0, this.height = void 0, this.position = void 0, this.weight = void 0, this.fullSize = void 0;
    }
    update(t, e) {
        let s = this.options;
        if (this.left = 0, this.top = 0, !s.display) {
            this.width = this.height = this.right = this.bottom = 0;
            return;
        }
        this.width = this.right = t, this.height = this.bottom = e;
        let n = I1(s.text) ? s.text.length : 1;
        this._padding = X2(s.padding);
        let o = n * j1(s.font).lineHeight + this._padding.height;
        this.isHorizontal() ? this.height = o : this.width = o;
    }
    isHorizontal() {
        let t = this.options.position;
        return t === "top" || t === "bottom";
    }
    _drawArgs(t) {
        let { top: e, left: s, bottom: n, right: o, options: a } = this, r = a.align, l = 0, c, h, d;
        return this.isHorizontal() ? (h = Y2(r, s, o), d = e + t, c = o - s) : (a.position === "left" ? (h = s + t, d = Y2(r, n, e), l = F2 * -.5) : (h = o - t, d = Y2(r, e, n), l = F2 * .5), c = n - e), {
            titleX: h,
            titleY: d,
            maxWidth: c,
            rotation: l
        };
    }
    draw() {
        let t = this.ctx, e = this.options;
        if (!e.display) return;
        let s = j1(e.font), o = s.lineHeight / 2 + this._padding.top, { titleX: a, titleY: r, maxWidth: l, rotation: c } = this._drawArgs(o);
        vt(t, e.text, 0, 0, s, {
            color: e.color,
            maxWidth: l,
            rotation: c,
            textAlign: Oe(e.align),
            textBaseline: "middle",
            translation: [
                a,
                r
            ]
        });
    }
};
function jl(i, t) {
    let e = new ge({
        ctx: i.ctx,
        options: t,
        chart: i
    });
    q1.configure(i, e, t), q1.addBox(i, e), i.titleBlock = e;
}
var $l = {
    id: "title",
    _element: ge,
    start (i, t, e) {
        jl(i, e);
    },
    stop (i) {
        let t = i.titleBlock;
        q1.removeBox(i, t), delete i.titleBlock;
    },
    beforeUpdate (i, t, e) {
        let s = i.titleBlock;
        q1.configure(i, s, e), s.options = e;
    },
    defaults: {
        align: "center",
        display: !1,
        font: {
            weight: "bold"
        },
        fullSize: !0,
        padding: 10,
        position: "top",
        text: "",
        weight: 2e3
    },
    defaultRoutes: {
        color: "color"
    },
    descriptors: {
        _scriptable: !0,
        _indexable: !1
    }
}, Ve1 = new WeakMap, Ul = {
    id: "subtitle",
    start (i, t, e) {
        let s = new ge({
            ctx: i.ctx,
            options: e,
            chart: i
        });
        q1.configure(i, s, e), q1.addBox(i, s), Ve1.set(i, s);
    },
    stop (i) {
        q1.removeBox(i, Ve1.get(i)), Ve1.delete(i);
    },
    beforeUpdate (i, t, e) {
        let s = Ve1.get(i);
        q1.configure(i, s, e), s.options = e;
    },
    defaults: {
        align: "center",
        display: !1,
        font: {
            weight: "normal"
        },
        fullSize: !0,
        padding: 0,
        position: "top",
        text: "",
        weight: 1500
    },
    defaultRoutes: {
        color: "color"
    },
    descriptors: {
        _scriptable: !0,
        _indexable: !1
    }
}, de = {
    average (i) {
        if (!i.length) return !1;
        let t, e, s = 0, n = 0, o = 0;
        for(t = 0, e = i.length; t < e; ++t){
            let a = i[t].element;
            if (a && a.hasValue()) {
                let r = a.tooltipPosition();
                s += r.x, n += r.y, ++o;
            }
        }
        return {
            x: s / o,
            y: n / o
        };
    },
    nearest (i, t) {
        if (!i.length) return !1;
        let e = t.x, s = t.y, n = Number.POSITIVE_INFINITY, o, a, r;
        for(o = 0, a = i.length; o < a; ++o){
            let l = i[o].element;
            if (l && l.hasValue()) {
                let c = l.getCenterPoint(), h = we1(t, c);
                h < n && (n = h, r = l);
            }
        }
        if (r) {
            let l = r.tooltipPosition();
            e = l.x, s = l.y;
        }
        return {
            x: e,
            y: s
        };
    }
};
function ct(i, t) {
    return t && (I1(t) ? Array.prototype.push.apply(i, t) : i.push(t)), i;
}
function bt(i) {
    return (typeof i == "string" || i instanceof String) && i.indexOf(`
`) > -1 ? i.split(`
`) : i;
}
function Yl(i, t) {
    let { element: e, datasetIndex: s, index: n } = t, o = i.getDatasetMeta(s).controller, { label: a, value: r } = o.getLabelAndValue(n);
    return {
        chart: i,
        label: a,
        parsed: o.getParsed(n),
        raw: i.data.datasets[s].data[n],
        formattedValue: r,
        dataset: o.getDataset(),
        dataIndex: n,
        datasetIndex: s,
        element: e
    };
}
function Bn(i, t) {
    let e = i.chart.ctx, { body: s, footer: n, title: o } = i, { boxWidth: a, boxHeight: r } = t, l = j1(t.bodyFont), c = j1(t.titleFont), h = j1(t.footerFont), d = o.length, u = n.length, f = s.length, p = X2(t.padding), g = p.height, m = 0, b = s.reduce((v, x)=>v + x.before.length + x.lines.length + x.after.length, 0);
    if (b += i.beforeBody.length + i.afterBody.length, d && (g += d * c.lineHeight + (d - 1) * t.titleSpacing + t.titleMarginBottom), b) {
        let v = t.displayColors ? Math.max(r, l.lineHeight) : l.lineHeight;
        g += f * v + (b - f) * l.lineHeight + (b - 1) * t.bodySpacing;
    }
    u && (g += t.footerMarginTop + u * h.lineHeight + (u - 1) * t.footerSpacing);
    let _ = 0, y = function(v) {
        m = Math.max(m, e.measureText(v).width + _);
    };
    return e.save(), e.font = c.string, T2(i.title, y), e.font = l.string, T2(i.beforeBody.concat(i.afterBody), y), _ = t.displayColors ? a + 2 + t.boxPadding : 0, T2(s, (v)=>{
        T2(v.before, y), T2(v.lines, y), T2(v.after, y);
    }), _ = 0, e.font = h.string, T2(i.footer, y), e.restore(), m += p.width, {
        width: m,
        height: g
    };
}
function Xl(i, t) {
    let { y: e, height: s } = t;
    return e < s / 2 ? "top" : e > i.height - s / 2 ? "bottom" : "center";
}
function Kl(i, t, e, s) {
    let { x: n, width: o } = s, a = e.caretSize + e.caretPadding;
    if (i === "left" && n + o + a > t.width || i === "right" && n - o - a < 0) return !0;
}
function ql(i, t, e, s) {
    let { x: n, width: o } = e, { width: a, chartArea: { left: r, right: l } } = i, c = "center";
    return s === "center" ? c = n <= (r + l) / 2 ? "left" : "right" : n <= o / 2 ? c = "left" : n >= a - o / 2 && (c = "right"), Kl(c, i, t, e) && (c = "center"), c;
}
function Vn(i, t, e) {
    let s = e.yAlign || t.yAlign || Xl(i, e);
    return {
        xAlign: e.xAlign || t.xAlign || ql(i, t, e, s),
        yAlign: s
    };
}
function Gl(i, t) {
    let { x: e, width: s } = i;
    return t === "right" ? e -= s : t === "center" && (e -= s / 2), e;
}
function Jl(i, t, e) {
    let { y: s, height: n } = i;
    return t === "top" ? s += e : t === "bottom" ? s -= n + e : s -= n / 2, s;
}
function Nn(i, t, e, s) {
    let { caretSize: n, caretPadding: o, cornerRadius: a } = i, { xAlign: r, yAlign: l } = e, c = n + o, { topLeft: h, topRight: d, bottomLeft: u, bottomRight: f } = Mt(a), p = Gl(t, r), g = Jl(t, l, c);
    return l === "center" ? r === "left" ? p += c : r === "right" && (p -= c) : r === "left" ? p -= Math.max(h, u) + n : r === "right" && (p += Math.max(d, f) + n), {
        x: $2(p, 0, s.width - t.width),
        y: $2(g, 0, s.height - t.height)
    };
}
function Ne(i, t, e) {
    let s = X2(e.padding);
    return t === "center" ? i.x + i.width / 2 : t === "right" ? i.x + i.width - s.right : i.x + s.left;
}
function Wn(i) {
    return ct([], bt(i));
}
function Ql(i, t, e) {
    return pt(i, {
        tooltip: t,
        tooltipItems: e,
        type: "tooltip"
    });
}
function Hn(i, t) {
    let e = t && t.dataset && t.dataset.tooltip && t.dataset.tooltip.callbacks;
    return e ? i.override(e) : i;
}
var bo = {
    beforeTitle: rt1,
    title (i) {
        if (i.length > 0) {
            let t = i[0], e = t.chart.data.labels, s = e ? e.length : 0;
            if (this && this.options && this.options.mode === "dataset") return t.dataset.label || "";
            if (t.label) return t.label;
            if (s > 0 && t.dataIndex < s) return e[t.dataIndex];
        }
        return "";
    },
    afterTitle: rt1,
    beforeBody: rt1,
    beforeLabel: rt1,
    label (i) {
        if (this && this.options && this.options.mode === "dataset") return i.label + ": " + i.formattedValue || i.formattedValue;
        let t = i.dataset.label || "";
        t && (t += ": ");
        let e = i.formattedValue;
        return A1(e) || (t += e), t;
    },
    labelColor (i) {
        let e = i.chart.getDatasetMeta(i.datasetIndex).controller.getStyle(i.dataIndex);
        return {
            borderColor: e.borderColor,
            backgroundColor: e.backgroundColor,
            borderWidth: e.borderWidth,
            borderDash: e.borderDash,
            borderDashOffset: e.borderDashOffset,
            borderRadius: 0
        };
    },
    labelTextColor () {
        return this.options.bodyColor;
    },
    labelPointStyle (i) {
        let e = i.chart.getDatasetMeta(i.datasetIndex).controller.getStyle(i.dataIndex);
        return {
            pointStyle: e.pointStyle,
            rotation: e.rotation
        };
    },
    afterLabel: rt1,
    afterBody: rt1,
    beforeFooter: rt1,
    footer: rt1,
    afterFooter: rt1
};
function Q1(i, t, e, s) {
    let n = i[t].call(e, s);
    return typeof n > "u" ? bo[t].call(e, s) : n;
}
var Qe = class extends ot1 {
    static positioners = de;
    constructor(t){
        super(), this.opacity = 0, this._active = [], this._eventPosition = void 0, this._size = void 0, this._cachedAnimations = void 0, this._tooltipItems = [], this.$animations = void 0, this.$context = void 0, this.chart = t.chart, this.options = t.options, this.dataPoints = void 0, this.title = void 0, this.beforeBody = void 0, this.body = void 0, this.afterBody = void 0, this.footer = void 0, this.xAlign = void 0, this.yAlign = void 0, this.x = void 0, this.y = void 0, this.height = void 0, this.width = void 0, this.caretX = void 0, this.caretY = void 0, this.labelColors = void 0, this.labelPointStyles = void 0, this.labelTextColors = void 0;
    }
    initialize(t) {
        this.options = t, this._cachedAnimations = void 0, this.$context = void 0;
    }
    _resolveAnimations() {
        let t = this._cachedAnimations;
        if (t) return t;
        let e = this.chart, s = this.options.setContext(this.getContext()), n = s.enabled && e.options.animation && s.animations, o = new $e(this.chart, n);
        return n._cacheable && (this._cachedAnimations = Object.freeze(o)), o;
    }
    getContext() {
        return this.$context || (this.$context = Ql(this.chart.getContext(), this, this._tooltipItems));
    }
    getTitle(t, e) {
        let { callbacks: s } = e, n = Q1(s, "beforeTitle", this, t), o = Q1(s, "title", this, t), a = Q1(s, "afterTitle", this, t), r = [];
        return r = ct(r, bt(n)), r = ct(r, bt(o)), r = ct(r, bt(a)), r;
    }
    getBeforeBody(t, e) {
        return Wn(Q1(e.callbacks, "beforeBody", this, t));
    }
    getBody(t, e) {
        let { callbacks: s } = e, n = [];
        return T2(t, (o)=>{
            let a = {
                before: [],
                lines: [],
                after: []
            }, r = Hn(s, o);
            ct(a.before, bt(Q1(r, "beforeLabel", this, o))), ct(a.lines, Q1(r, "label", this, o)), ct(a.after, bt(Q1(r, "afterLabel", this, o))), n.push(a);
        }), n;
    }
    getAfterBody(t, e) {
        return Wn(Q1(e.callbacks, "afterBody", this, t));
    }
    getFooter(t, e) {
        let { callbacks: s } = e, n = Q1(s, "beforeFooter", this, t), o = Q1(s, "footer", this, t), a = Q1(s, "afterFooter", this, t), r = [];
        return r = ct(r, bt(n)), r = ct(r, bt(o)), r = ct(r, bt(a)), r;
    }
    _createItems(t) {
        let e = this._active, s = this.chart.data, n = [], o = [], a = [], r = [], l, c;
        for(l = 0, c = e.length; l < c; ++l)r.push(Yl(this.chart, e[l]));
        return t.filter && (r = r.filter((h, d, u)=>t.filter(h, d, u, s))), t.itemSort && (r = r.sort((h, d)=>t.itemSort(h, d, s))), T2(r, (h)=>{
            let d = Hn(t.callbacks, h);
            n.push(Q1(d, "labelColor", this, h)), o.push(Q1(d, "labelPointStyle", this, h)), a.push(Q1(d, "labelTextColor", this, h));
        }), this.labelColors = n, this.labelPointStyles = o, this.labelTextColors = a, this.dataPoints = r, r;
    }
    update(t, e) {
        let s = this.options.setContext(this.getContext()), n = this._active, o, a = [];
        if (!n.length) this.opacity !== 0 && (o = {
            opacity: 0
        });
        else {
            let r = de[s.position].call(this, n, this._eventPosition);
            a = this._createItems(s), this.title = this.getTitle(a, s), this.beforeBody = this.getBeforeBody(a, s), this.body = this.getBody(a, s), this.afterBody = this.getAfterBody(a, s), this.footer = this.getFooter(a, s);
            let l = this._size = Bn(this, s), c = Object.assign({}, r, l), h = Vn(this.chart, s, c), d = Nn(s, c, h, this.chart);
            this.xAlign = h.xAlign, this.yAlign = h.yAlign, o = {
                opacity: 1,
                x: d.x,
                y: d.y,
                width: l.width,
                height: l.height,
                caretX: r.x,
                caretY: r.y
            };
        }
        this._tooltipItems = a, this.$context = void 0, o && this._resolveAnimations().update(this, o), t && s.external && s.external.call(this, {
            chart: this.chart,
            tooltip: this,
            replay: e
        });
    }
    drawCaret(t, e, s, n) {
        let o = this.getCaretPosition(t, s, n);
        e.lineTo(o.x1, o.y1), e.lineTo(o.x2, o.y2), e.lineTo(o.x3, o.y3);
    }
    getCaretPosition(t, e, s) {
        let { xAlign: n, yAlign: o } = this, { caretSize: a, cornerRadius: r } = s, { topLeft: l, topRight: c, bottomLeft: h, bottomRight: d } = Mt(r), { x: u, y: f } = t, { width: p, height: g } = e, m, b, _, y, v, x;
        return o === "center" ? (v = f + g / 2, n === "left" ? (m = u, b = m - a, y = v + a, x = v - a) : (m = u + p, b = m + a, y = v - a, x = v + a), _ = m) : (n === "left" ? b = u + Math.max(l, h) + a : n === "right" ? b = u + p - Math.max(c, d) - a : b = this.caretX, o === "top" ? (y = f, v = y - a, m = b - a, _ = b + a) : (y = f + g, v = y + a, m = b + a, _ = b - a), x = y), {
            x1: m,
            x2: b,
            x3: _,
            y1: y,
            y2: v,
            y3: x
        };
    }
    drawTitle(t, e, s) {
        let n = this.title, o = n.length, a, r, l;
        if (o) {
            let c = Ot(s.rtl, this.x, this.width);
            for(t.x = Ne(this, s.titleAlign, s), e.textAlign = c.textAlign(s.titleAlign), e.textBaseline = "middle", a = j1(s.titleFont), r = s.titleSpacing, e.fillStyle = s.titleColor, e.font = a.string, l = 0; l < o; ++l)e.fillText(n[l], c.x(t.x), t.y + a.lineHeight / 2), t.y += a.lineHeight + r, l + 1 === o && (t.y += s.titleMarginBottom - r);
        }
    }
    _drawColorBox(t, e, s, n, o) {
        let a = this.labelColors[s], r = this.labelPointStyles[s], { boxHeight: l, boxWidth: c, boxPadding: h } = o, d = j1(o.bodyFont), u = Ne(this, "left", o), f = n.x(u), p = l < d.lineHeight ? (d.lineHeight - l) / 2 : 0, g = e.y + p;
        if (o.usePointStyle) {
            let m = {
                radius: Math.min(c, l) / 2,
                pointStyle: r.pointStyle,
                rotation: r.rotation,
                borderWidth: 1
            }, b = n.leftForLtr(f, c) + c / 2, _ = g + l / 2;
            t.strokeStyle = o.multiKeyBackground, t.fillStyle = o.multiKeyBackground, Le1(t, m, b, _), t.strokeStyle = a.borderColor, t.fillStyle = a.backgroundColor, Le1(t, m, b, _);
        } else {
            t.lineWidth = O2(a.borderWidth) ? Math.max(...Object.values(a.borderWidth)) : a.borderWidth || 1, t.strokeStyle = a.borderColor, t.setLineDash(a.borderDash || []), t.lineDashOffset = a.borderDashOffset || 0;
            let m = n.leftForLtr(f, c - h), b = n.leftForLtr(n.xPlus(f, 1), c - h - 2), _ = Mt(a.borderRadius);
            Object.values(_).some((y)=>y !== 0) ? (t.beginPath(), t.fillStyle = o.multiKeyBackground, $t(t, {
                x: m,
                y: g,
                w: c,
                h: l,
                radius: _
            }), t.fill(), t.stroke(), t.fillStyle = a.backgroundColor, t.beginPath(), $t(t, {
                x: b,
                y: g + 1,
                w: c - 2,
                h: l - 2,
                radius: _
            }), t.fill()) : (t.fillStyle = o.multiKeyBackground, t.fillRect(m, g, c, l), t.strokeRect(m, g, c, l), t.fillStyle = a.backgroundColor, t.fillRect(b, g + 1, c - 2, l - 2));
        }
        t.fillStyle = this.labelTextColors[s];
    }
    drawBody(t, e, s) {
        let { body: n } = this, { bodySpacing: o, bodyAlign: a, displayColors: r, boxHeight: l, boxWidth: c, boxPadding: h } = s, d = j1(s.bodyFont), u = d.lineHeight, f = 0, p = Ot(s.rtl, this.x, this.width), g = function(w) {
            e.fillText(w, p.x(t.x + f), t.y + u / 2), t.y += u + o;
        }, m = p.textAlign(a), b, _, y, v, x, M, k;
        for(e.textAlign = a, e.textBaseline = "middle", e.font = d.string, t.x = Ne(this, m, s), e.fillStyle = s.bodyColor, T2(this.beforeBody, g), f = r && m !== "right" ? a === "center" ? c / 2 + h : c + 2 + h : 0, v = 0, M = n.length; v < M; ++v){
            for(b = n[v], _ = this.labelTextColors[v], e.fillStyle = _, T2(b.before, g), y = b.lines, r && y.length && (this._drawColorBox(e, t, v, p, s), u = Math.max(d.lineHeight, l)), x = 0, k = y.length; x < k; ++x)g(y[x]), u = d.lineHeight;
            T2(b.after, g);
        }
        f = 0, u = d.lineHeight, T2(this.afterBody, g), t.y -= o;
    }
    drawFooter(t, e, s) {
        let n = this.footer, o = n.length, a, r;
        if (o) {
            let l = Ot(s.rtl, this.x, this.width);
            for(t.x = Ne(this, s.footerAlign, s), t.y += s.footerMarginTop, e.textAlign = l.textAlign(s.footerAlign), e.textBaseline = "middle", a = j1(s.footerFont), e.fillStyle = s.footerColor, e.font = a.string, r = 0; r < o; ++r)e.fillText(n[r], l.x(t.x), t.y + a.lineHeight / 2), t.y += a.lineHeight + s.footerSpacing;
        }
    }
    drawBackground(t, e, s, n) {
        let { xAlign: o, yAlign: a } = this, { x: r, y: l } = t, { width: c, height: h } = s, { topLeft: d, topRight: u, bottomLeft: f, bottomRight: p } = Mt(n.cornerRadius);
        e.fillStyle = n.backgroundColor, e.strokeStyle = n.borderColor, e.lineWidth = n.borderWidth, e.beginPath(), e.moveTo(r + d, l), a === "top" && this.drawCaret(t, e, s, n), e.lineTo(r + c - u, l), e.quadraticCurveTo(r + c, l, r + c, l + u), a === "center" && o === "right" && this.drawCaret(t, e, s, n), e.lineTo(r + c, l + h - p), e.quadraticCurveTo(r + c, l + h, r + c - p, l + h), a === "bottom" && this.drawCaret(t, e, s, n), e.lineTo(r + f, l + h), e.quadraticCurveTo(r, l + h, r, l + h - f), a === "center" && o === "left" && this.drawCaret(t, e, s, n), e.lineTo(r, l + d), e.quadraticCurveTo(r, l, r + d, l), e.closePath(), e.fill(), n.borderWidth > 0 && e.stroke();
    }
    _updateAnimationTarget(t) {
        let e = this.chart, s = this.$animations, n = s && s.x, o = s && s.y;
        if (n || o) {
            let a = de[t.position].call(this, this._active, this._eventPosition);
            if (!a) return;
            let r = this._size = Bn(this, t), l = Object.assign({}, a, this._size), c = Vn(e, t, l), h = Nn(t, l, c, e);
            (n._to !== h.x || o._to !== h.y) && (this.xAlign = c.xAlign, this.yAlign = c.yAlign, this.width = r.width, this.height = r.height, this.caretX = a.x, this.caretY = a.y, this._resolveAnimations().update(this, h));
        }
    }
    _willRender() {
        return !!this.opacity;
    }
    draw(t) {
        let e = this.options.setContext(this.getContext()), s = this.opacity;
        if (!s) return;
        this._updateAnimationTarget(e);
        let n = {
            width: this.width,
            height: this.height
        }, o = {
            x: this.x,
            y: this.y
        };
        s = Math.abs(s) < .001 ? 0 : s;
        let a = X2(e.padding), r = this.title.length || this.beforeBody.length || this.body.length || this.afterBody.length || this.footer.length;
        e.enabled && r && (t.save(), t.globalAlpha = s, this.drawBackground(o, t, n, e), Pi(t, e.textDirection), o.y += a.top, this.drawTitle(o, t, e), this.drawBody(o, t, e), this.drawFooter(o, t, e), Ci(t, e.textDirection), t.restore());
    }
    getActiveElements() {
        return this._active || [];
    }
    setActiveElements(t, e) {
        let s = this._active, n = t.map(({ datasetIndex: r, index: l })=>{
            let c = this.chart.getDatasetMeta(r);
            if (!c) throw new Error("Cannot find a dataset at index " + r);
            return {
                datasetIndex: r,
                element: c.data[l],
                index: l
            };
        }), o = !ie1(s, n), a = this._positionChanged(n, e);
        (o || a) && (this._active = n, this._eventPosition = e, this._ignoreReplayEvents = !0, this.update(!0));
    }
    handleEvent(t, e, s = !0) {
        if (e && this._ignoreReplayEvents) return !1;
        this._ignoreReplayEvents = !1;
        let n = this.options, o = this._active || [], a = this._getActiveElements(t, o, e, s), r = this._positionChanged(a, t), l = e || !ie1(a, o) || r;
        return l && (this._active = a, (n.enabled || n.external) && (this._eventPosition = {
            x: t.x,
            y: t.y
        }, this.update(!0, e))), l;
    }
    _getActiveElements(t, e, s, n) {
        let o = this.options;
        if (t.type === "mouseout") return [];
        if (!n) return e;
        let a = this.chart.getElementsAtEventForMode(t, o.mode, o, s);
        return o.reverse && a.reverse(), a;
    }
    _positionChanged(t, e) {
        let { caretX: s, caretY: n, options: o } = this, a = de[o.position].call(this, t, e);
        return a !== !1 && (s !== a.x || n !== a.y);
    }
}, Zl = {
    id: "tooltip",
    _element: Qe,
    positioners: de,
    afterInit (i, t, e) {
        e && (i.tooltip = new Qe({
            chart: i,
            options: e
        }));
    },
    beforeUpdate (i, t, e) {
        i.tooltip && i.tooltip.initialize(e);
    },
    reset (i, t, e) {
        i.tooltip && i.tooltip.initialize(e);
    },
    afterDraw (i) {
        let t = i.tooltip;
        if (t && t._willRender()) {
            let e = {
                tooltip: t
            };
            if (i.notifyPlugins("beforeTooltipDraw", {
                ...e,
                cancelable: !0
            }) === !1) return;
            t.draw(i.ctx), i.notifyPlugins("afterTooltipDraw", e);
        }
    },
    afterEvent (i, t) {
        if (i.tooltip) {
            let e = t.replay;
            i.tooltip.handleEvent(t.event, e, t.inChartArea) && (t.changed = !0);
        }
    },
    defaults: {
        enabled: !0,
        external: null,
        position: "average",
        backgroundColor: "rgba(0,0,0,0.8)",
        titleColor: "#fff",
        titleFont: {
            weight: "bold"
        },
        titleSpacing: 2,
        titleMarginBottom: 6,
        titleAlign: "left",
        bodyColor: "#fff",
        bodySpacing: 2,
        bodyFont: {},
        bodyAlign: "left",
        footerColor: "#fff",
        footerSpacing: 2,
        footerMarginTop: 6,
        footerFont: {
            weight: "bold"
        },
        footerAlign: "left",
        padding: 6,
        caretPadding: 2,
        caretSize: 5,
        cornerRadius: 6,
        boxHeight: (i, t)=>t.bodyFont.size,
        boxWidth: (i, t)=>t.bodyFont.size,
        multiKeyBackground: "#fff",
        displayColors: !0,
        boxPadding: 0,
        borderColor: "rgba(0,0,0,0)",
        borderWidth: 0,
        animation: {
            duration: 400,
            easing: "easeOutQuart"
        },
        animations: {
            numbers: {
                type: "number",
                properties: [
                    "x",
                    "y",
                    "width",
                    "height",
                    "caretX",
                    "caretY"
                ]
            },
            opacity: {
                easing: "linear",
                duration: 200
            }
        },
        callbacks: bo
    },
    defaultRoutes: {
        bodyFont: "font",
        footerFont: "font",
        titleFont: "font"
    },
    descriptors: {
        _scriptable: (i)=>i !== "filter" && i !== "itemSort" && i !== "external",
        _indexable: !1,
        callbacks: {
            _scriptable: !1,
            _indexable: !1
        },
        animation: {
            _fallback: !1
        },
        animations: {
            _fallback: "animation"
        }
    },
    additionalOptionScopes: [
        "interaction"
    ]
}, tc = Object.freeze({
    __proto__: null,
    Colors: ul,
    Decimation: ml,
    Filler: zl,
    Legend: Hl,
    SubTitle: Ul,
    Title: $l,
    Tooltip: Zl
}), ec = (i, t, e, s)=>(typeof t == "string" ? (e = i.push(t) - 1, s.unshift({
        index: e,
        label: t
    })) : isNaN(t) && (e = null), e);
function ic(i, t, e, s) {
    let n = i.indexOf(t);
    if (n === -1) return ec(i, t, e, s);
    let o = i.lastIndexOf(t);
    return n !== o ? e : n;
}
var sc = (i, t)=>i === null ? null : $2(Math.round(i), 0, t);
function jn(i) {
    let t = this.getLabels();
    return i >= 0 && i < t.length ? t[i] : i;
}
var rs = class extends Tt {
    static id = "category";
    static defaults = {
        ticks: {
            callback: jn
        }
    };
    constructor(t){
        super(t), this._startValue = void 0, this._valueRange = 0, this._addedLabels = [];
    }
    init(t) {
        let e = this._addedLabels;
        if (e.length) {
            let s = this.getLabels();
            for (let { index: n, label: o } of e)s[n] === o && s.splice(n, 1);
            this._addedLabels = [];
        }
        super.init(t);
    }
    parse(t, e) {
        if (A1(t)) return null;
        let s = this.getLabels();
        return e = isFinite(e) && s[e] === t ? e : ic(s, t, P1(e, t), this._addedLabels), sc(e, s.length - 1);
    }
    determineDataLimits() {
        let { minDefined: t, maxDefined: e } = this.getUserBounds(), { min: s, max: n } = this.getMinMax(!0);
        this.options.bounds === "ticks" && (t || (s = 0), e || (n = this.getLabels().length - 1)), this.min = s, this.max = n;
    }
    buildTicks() {
        let t = this.min, e = this.max, s = this.options.offset, n = [], o = this.getLabels();
        o = t === 0 && e === o.length - 1 ? o : o.slice(t, e + 1), this._valueRange = Math.max(o.length - (s ? 0 : 1), 1), this._startValue = this.min - (s ? .5 : 0);
        for(let a = t; a <= e; a++)n.push({
            value: a
        });
        return n;
    }
    getLabelForValue(t) {
        return jn.call(this, t);
    }
    configure() {
        super.configure(), this.isHorizontal() || (this._reversePixels = !this._reversePixels);
    }
    getPixelForValue(t) {
        return typeof t != "number" && (t = this.parse(t)), t === null ? NaN : this.getPixelForDecimal((t - this._startValue) / this._valueRange);
    }
    getPixelForTick(t) {
        let e = this.ticks;
        return t < 0 || t > e.length - 1 ? null : this.getPixelForValue(e[t].value);
    }
    getValueForPixel(t) {
        return Math.round(this._startValue + this.getDecimalForPixel(t) * this._valueRange);
    }
    getBasePixel() {
        return this.bottom;
    }
};
function nc(i, t) {
    let e = [], { bounds: n, step: o, min: a, max: r, precision: l, count: c, maxTicks: h, maxDigits: d, includeBounds: u } = i, f = o || 1, p = h - 1, { min: g, max: m } = t, b = !A1(a), _ = !A1(r), y = !A1(c), v = (m - g) / (d + 1), x = oi((m - g) / p / f) * f, M, k, w, S;
    if (x < 1e-14 && !b && !_) return [
        {
            value: g
        },
        {
            value: m
        }
    ];
    S = Math.ceil(m / x) - Math.floor(g / x), S > p && (x = oi(S * x / p / f) * f), A1(l) || (M = Math.pow(10, l), x = Math.ceil(x * M) / M), n === "ticks" ? (k = Math.floor(g / x) * x, w = Math.ceil(m / x) * x) : (k = g, w = m), b && _ && o && As((r - a) / o, x / 1e3) ? (S = Math.round(Math.min((r - a) / x, h)), x = (r - a) / S, k = a, w = r) : y ? (k = b ? a : k, w = _ ? r : w, S = c - 1, x = (w - k) / S) : (S = (w - k) / x, Nt(S, Math.round(S), x / 1e3) ? S = Math.round(S) : S = Math.ceil(S));
    let C = Math.max(ri(x), ri(k));
    M = Math.pow(10, A1(l) ? C : l), k = Math.round(k * M) / M, w = Math.round(w * M) / M;
    let D = 0;
    for(b && (u && k !== a ? (e.push({
        value: a
    }), k < a && D++, Nt(Math.round((k + D * x) * M) / M, a, $n(a, v, i)) && D++) : k < a && D++); D < S; ++D)e.push({
        value: Math.round((k + D * x) * M) / M
    });
    return _ && u && w !== r ? e.length && Nt(e[e.length - 1].value, r, $n(r, v, i)) ? e[e.length - 1].value = r : e.push({
        value: r
    }) : (!_ || w === r) && e.push({
        value: w
    }), e;
}
function $n(i, t, { horizontal: e, minRotation: s }) {
    let n = it1(s), o = (e ? Math.sin(n) : Math.cos(n)) || .001, a = .75 * t * ("" + i).length;
    return Math.min(t / o, a);
}
var qt = class extends Tt {
    constructor(t){
        super(t), this.start = void 0, this.end = void 0, this._startValue = void 0, this._endValue = void 0, this._valueRange = 0;
    }
    parse(t, e) {
        return A1(t) || (typeof t == "number" || t instanceof Number) && !isFinite(+t) ? null : +t;
    }
    handleTickRangeOptions() {
        let { beginAtZero: t } = this.options, { minDefined: e, maxDefined: s } = this.getUserBounds(), { min: n, max: o } = this, a = (l)=>n = e ? n : l, r = (l)=>o = s ? o : l;
        if (t) {
            let l = nt1(n), c = nt1(o);
            l < 0 && c < 0 ? r(0) : l > 0 && c > 0 && a(0);
        }
        if (n === o) {
            let l = o === 0 ? 1 : Math.abs(o * .05);
            r(o + l), t || a(n - l);
        }
        this.min = n, this.max = o;
    }
    getTickLimit() {
        let t = this.options.ticks, { maxTicksLimit: e, stepSize: s } = t, n;
        return s ? (n = Math.ceil(this.max / s) - Math.floor(this.min / s) + 1, n > 1e3 && (console.warn(`scales.${this.id}.ticks.stepSize: ${s} would result generating up to ${n} ticks. Limiting to 1000.`), n = 1e3)) : (n = this.computeTickLimit(), e = e || 11), e && (n = Math.min(e, n)), n;
    }
    computeTickLimit() {
        return Number.POSITIVE_INFINITY;
    }
    buildTicks() {
        let t = this.options, e = t.ticks, s = this.getTickLimit();
        s = Math.max(2, s);
        let n = {
            maxTicks: s,
            bounds: t.bounds,
            min: t.min,
            max: t.max,
            precision: e.precision,
            step: e.stepSize,
            count: e.count,
            maxDigits: this._maxDigits(),
            horizontal: this.isHorizontal(),
            minRotation: e.minRotation || 0,
            includeBounds: e.includeBounds !== !1
        }, o = this._range || this, a = nc(n, o);
        return t.bounds === "ticks" && ai(a, this, "value"), t.reverse ? (a.reverse(), this.start = this.max, this.end = this.min) : (this.start = this.min, this.end = this.max), a;
    }
    configure() {
        let t = this.ticks, e = this.min, s = this.max;
        if (super.configure(), this.options.offset && t.length) {
            let n = (s - e) / Math.max(t.length - 1, 1) / 2;
            e -= n, s += n;
        }
        this._startValue = e, this._endValue = s, this._valueRange = s - e;
    }
    getLabelForValue(t) {
        return Ht(t, this.chart.options.locale, this.options.ticks.format);
    }
}, ls = class extends qt {
    static id = "linear";
    static defaults = {
        ticks: {
            callback: jt.formatters.numeric
        }
    };
    determineDataLimits() {
        let { min: t, max: e } = this.getMinMax(!0);
        this.min = N2(t) ? t : 0, this.max = N2(e) ? e : 1, this.handleTickRangeOptions();
    }
    computeTickLimit() {
        let t = this.isHorizontal(), e = t ? this.width : this.height, s = it1(this.options.ticks.minRotation), n = (t ? Math.sin(s) : Math.cos(s)) || .001, o = this._resolveTickFontOptions(0);
        return Math.ceil(e / Math.min(40, o.lineHeight / n));
    }
    getPixelForValue(t) {
        return t === null ? NaN : this.getPixelForDecimal((t - this._startValue) / this._valueRange);
    }
    getValueForPixel(t) {
        return this._startValue + this.getDecimalForPixel(t) * this._valueRange;
    }
}, pe1 = (i)=>Math.floor(ft(i)), Lt = (i, t)=>Math.pow(10, pe1(i) + t);
function Un(i) {
    return i / Math.pow(10, pe1(i)) === 1;
}
function Yn(i, t, e) {
    let s = Math.pow(10, e), n = Math.floor(i / s);
    return Math.ceil(t / s) - n;
}
function oc(i, t) {
    let e = t - i, s = pe1(e);
    for(; Yn(i, t, s) > 10;)s++;
    for(; Yn(i, t, s) < 10;)s--;
    return Math.min(s, pe1(i));
}
function ac(i, { min: t, max: e }) {
    t = J1(i.min, t);
    let s = [], n = pe1(t), o = oc(t, e), a = o < 0 ? Math.pow(10, Math.abs(o)) : 1, r = Math.pow(10, o), l = n > o ? Math.pow(10, n) : 0, c = Math.round((t - l) * a) / a, h = Math.floor((t - l) / r / 10) * r * 10, d = Math.floor((c - h) / Math.pow(10, o)), u = J1(i.min, Math.round((l + h + d * Math.pow(10, o)) * a) / a);
    for(; u < e;)s.push({
        value: u,
        major: Un(u),
        significand: d
    }), d >= 10 ? d = d < 15 ? 15 : 20 : d++, d >= 20 && (o++, d = 2, a = o >= 0 ? 1 : a), u = Math.round((l + h + d * Math.pow(10, o)) * a) / a;
    let f = J1(i.max, u);
    return s.push({
        value: f,
        major: Un(f),
        significand: d
    }), s;
}
var cs = class extends Tt {
    static id = "logarithmic";
    static defaults = {
        ticks: {
            callback: jt.formatters.logarithmic,
            major: {
                enabled: !0
            }
        }
    };
    constructor(t){
        super(t), this.start = void 0, this.end = void 0, this._startValue = void 0, this._valueRange = 0;
    }
    parse(t, e) {
        let s = qt.prototype.parse.apply(this, [
            t,
            e
        ]);
        if (s === 0) {
            this._zero = !0;
            return;
        }
        return N2(s) && s > 0 ? s : null;
    }
    determineDataLimits() {
        let { min: t, max: e } = this.getMinMax(!0);
        this.min = N2(t) ? Math.max(0, t) : null, this.max = N2(e) ? Math.max(0, e) : null, this.options.beginAtZero && (this._zero = !0), this._zero && this.min !== this._suggestedMin && !N2(this._userMin) && (this.min = t === Lt(this.min, 0) ? Lt(this.min, -1) : Lt(this.min, 0)), this.handleTickRangeOptions();
    }
    handleTickRangeOptions() {
        let { minDefined: t, maxDefined: e } = this.getUserBounds(), s = this.min, n = this.max, o = (r)=>s = t ? s : r, a = (r)=>n = e ? n : r;
        s === n && (s <= 0 ? (o(1), a(10)) : (o(Lt(s, -1)), a(Lt(n, 1)))), s <= 0 && o(Lt(n, -1)), n <= 0 && a(Lt(s, 1)), this.min = s, this.max = n;
    }
    buildTicks() {
        let t = this.options, e = {
            min: this._userMin,
            max: this._userMax
        }, s = ac(e, this);
        return t.bounds === "ticks" && ai(s, this, "value"), t.reverse ? (s.reverse(), this.start = this.max, this.end = this.min) : (this.start = this.min, this.end = this.max), s;
    }
    getLabelForValue(t) {
        return t === void 0 ? "0" : Ht(t, this.chart.options.locale, this.options.ticks.format);
    }
    configure() {
        let t = this.min;
        super.configure(), this._startValue = ft(t), this._valueRange = ft(this.max) - ft(t);
    }
    getPixelForValue(t) {
        return (t === void 0 || t === 0) && (t = this.min), t === null || isNaN(t) ? NaN : this.getPixelForDecimal(t === this.min ? 0 : (ft(t) - this._startValue) / this._valueRange);
    }
    getValueForPixel(t) {
        let e = this.getDecimalForPixel(t);
        return Math.pow(10, this._startValue + e * this._valueRange);
    }
};
function hs(i) {
    let t = i.ticks;
    if (t.display && i.display) {
        let e = X2(t.backdropPadding);
        return P1(t.font && t.font.size, W1.font.size) + e.height;
    }
    return 0;
}
function rc(i, t, e) {
    return e = I1(e) ? e : [
        e
    ], {
        w: Ns(i, t.string, e),
        h: e.length * t.lineHeight
    };
}
function Xn(i, t, e, s, n) {
    return i === s || i === n ? {
        start: t - e / 2,
        end: t + e / 2
    } : i < s || i > n ? {
        start: t - e,
        end: t
    } : {
        start: t,
        end: t + e
    };
}
function lc(i) {
    let t = {
        l: i.left + i._padding.left,
        r: i.right - i._padding.right,
        t: i.top + i._padding.top,
        b: i.bottom - i._padding.bottom
    }, e = Object.assign({}, t), s = [], n = [], o = i._pointLabels.length, a = i.options.pointLabels, r = a.centerPointLabels ? F2 / o : 0;
    for(let l = 0; l < o; l++){
        let c = a.setContext(i.getPointLabelContext(l));
        n[l] = c.padding;
        let h = i.getPointPosition(l, i.drawingArea + n[l], r), d = j1(c.font), u = rc(i.ctx, d, i._pointLabels[l]);
        s[l] = u;
        let f = G2(i.getIndexAngle(l) + r), p = Math.round(Ce(f)), g = Xn(p, h.x, u.w, 0, 180), m = Xn(p, h.y, u.h, 90, 270);
        cc(e, t, f, g, m);
    }
    i.setCenterPoint(t.l - e.l, e.r - t.r, t.t - e.t, e.b - t.b), i._pointLabelItems = hc(i, s, n);
}
function cc(i, t, e, s, n) {
    let o = Math.abs(Math.sin(e)), a = Math.abs(Math.cos(e)), r = 0, l = 0;
    s.start < t.l ? (r = (t.l - s.start) / o, i.l = Math.min(i.l, t.l - r)) : s.end > t.r && (r = (s.end - t.r) / o, i.r = Math.max(i.r, t.r + r)), n.start < t.t ? (l = (t.t - n.start) / a, i.t = Math.min(i.t, t.t - l)) : n.end > t.b && (l = (n.end - t.b) / a, i.b = Math.max(i.b, t.b + l));
}
function hc(i, t, e) {
    let s = [], n = i._pointLabels.length, o = i.options, a = hs(o) / 2, r = i.drawingArea, l = o.pointLabels.centerPointLabels ? F2 / n : 0;
    for(let c = 0; c < n; c++){
        let h = i.getPointPosition(c, r + a + e[c], l), d = Math.round(Ce(G2(h.angle + V1))), u = t[c], f = fc(h.y, u.h, d), p = dc(d), g = uc(h.x, u.w, p);
        s.push({
            x: h.x,
            y: f,
            textAlign: p,
            left: g,
            top: f,
            right: g + u.w,
            bottom: f + u.h
        });
    }
    return s;
}
function dc(i) {
    return i === 0 || i === 180 ? "center" : i < 180 ? "left" : "right";
}
function uc(i, t, e) {
    return e === "right" ? i -= t : e === "center" && (i -= t / 2), i;
}
function fc(i, t, e) {
    return e === 90 || e === 270 ? i -= t / 2 : (e > 270 || e < 90) && (i -= t), i;
}
function gc(i, t) {
    let { ctx: e, options: { pointLabels: s } } = i;
    for(let n = t - 1; n >= 0; n--){
        let o = s.setContext(i.getPointLabelContext(n)), a = j1(o.font), { x: r, y: l, textAlign: c, left: h, top: d, right: u, bottom: f } = i._pointLabelItems[n], { backdropColor: p } = o;
        if (!A1(p)) {
            let g = Mt(o.borderRadius), m = X2(o.backdropPadding);
            e.fillStyle = p;
            let b = h - m.left, _ = d - m.top, y = u - h + m.width, v = f - d + m.height;
            Object.values(g).some((x)=>x !== 0) ? (e.beginPath(), $t(e, {
                x: b,
                y: _,
                w: y,
                h: v,
                radius: g
            }), e.fill()) : e.fillRect(b, _, y, v);
        }
        vt(e, i._pointLabels[n], r, l + a.lineHeight / 2, a, {
            color: o.color,
            textAlign: c,
            textBaseline: "middle"
        });
    }
}
function _o(i, t, e, s) {
    let { ctx: n } = i;
    if (e) n.arc(i.xCenter, i.yCenter, t, 0, z1);
    else {
        let o = i.getPointPosition(0, t);
        n.moveTo(o.x, o.y);
        for(let a = 1; a < s; a++)o = i.getPointPosition(a, t), n.lineTo(o.x, o.y);
    }
}
function pc(i, t, e, s, n) {
    let o = i.ctx, a = t.circular, { color: r, lineWidth: l } = t;
    !a && !s || !r || !l || e < 0 || (o.save(), o.strokeStyle = r, o.lineWidth = l, o.setLineDash(n.dash), o.lineDashOffset = n.dashOffset, o.beginPath(), _o(i, e, a, s), o.closePath(), o.stroke(), o.restore());
}
function mc(i, t, e) {
    return pt(i, {
        label: e,
        index: t,
        type: "pointLabel"
    });
}
var ds = class extends qt {
    static id = "radialLinear";
    static defaults = {
        display: !0,
        animate: !0,
        position: "chartArea",
        angleLines: {
            display: !0,
            lineWidth: 1,
            borderDash: [],
            borderDashOffset: 0
        },
        grid: {
            circular: !1
        },
        startAngle: 0,
        ticks: {
            showLabelBackdrop: !0,
            callback: jt.formatters.numeric
        },
        pointLabels: {
            backdropColor: void 0,
            backdropPadding: 2,
            display: !0,
            font: {
                size: 10
            },
            callback (t) {
                return t;
            },
            padding: 5,
            centerPointLabels: !1
        }
    };
    static defaultRoutes = {
        "angleLines.color": "borderColor",
        "pointLabels.color": "color",
        "ticks.color": "color"
    };
    static descriptors = {
        angleLines: {
            _fallback: "grid"
        }
    };
    constructor(t){
        super(t), this.xCenter = void 0, this.yCenter = void 0, this.drawingArea = void 0, this._pointLabels = [], this._pointLabelItems = [];
    }
    setDimensions() {
        let t = this._padding = X2(hs(this.options) / 2), e = this.width = this.maxWidth - t.width, s = this.height = this.maxHeight - t.height;
        this.xCenter = Math.floor(this.left + e / 2 + t.left), this.yCenter = Math.floor(this.top + s / 2 + t.top), this.drawingArea = Math.floor(Math.min(e, s) / 2);
    }
    determineDataLimits() {
        let { min: t, max: e } = this.getMinMax(!1);
        this.min = N2(t) && !isNaN(t) ? t : 0, this.max = N2(e) && !isNaN(e) ? e : 0, this.handleTickRangeOptions();
    }
    computeTickLimit() {
        return Math.ceil(this.drawingArea / hs(this.options));
    }
    generateTickLabels(t) {
        qt.prototype.generateTickLabels.call(this, t), this._pointLabels = this.getLabels().map((e, s)=>{
            let n = E1(this.options.pointLabels.callback, [
                e,
                s
            ], this);
            return n || n === 0 ? n : "";
        }).filter((e, s)=>this.chart.getDataVisibility(s));
    }
    fit() {
        let t = this.options;
        t.display && t.pointLabels.display ? lc(this) : this.setCenterPoint(0, 0, 0, 0);
    }
    setCenterPoint(t, e, s, n) {
        this.xCenter += Math.floor((t - e) / 2), this.yCenter += Math.floor((s - n) / 2), this.drawingArea -= Math.min(this.drawingArea / 2, Math.max(t, e, s, n));
    }
    getIndexAngle(t) {
        let e = z1 / (this._pointLabels.length || 1), s = this.options.startAngle || 0;
        return G2(t * e + it1(s));
    }
    getDistanceFromCenterForValue(t) {
        if (A1(t)) return NaN;
        let e = this.drawingArea / (this.max - this.min);
        return this.options.reverse ? (this.max - t) * e : (t - this.min) * e;
    }
    getValueForDistanceFromCenter(t) {
        if (A1(t)) return NaN;
        let e = t / (this.drawingArea / (this.max - this.min));
        return this.options.reverse ? this.max - e : this.min + e;
    }
    getPointLabelContext(t) {
        let e = this._pointLabels || [];
        if (t >= 0 && t < e.length) {
            let s = e[t];
            return mc(this.getContext(), t, s);
        }
    }
    getPointPosition(t, e, s = 0) {
        let n = this.getIndexAngle(t) - V1 + s;
        return {
            x: Math.cos(n) * e + this.xCenter,
            y: Math.sin(n) * e + this.yCenter,
            angle: n
        };
    }
    getPointPositionForValue(t, e) {
        return this.getPointPosition(t, this.getDistanceFromCenterForValue(e));
    }
    getBasePosition(t) {
        return this.getPointPositionForValue(t || 0, this.getBaseValue());
    }
    getPointLabelPosition(t) {
        let { left: e, top: s, right: n, bottom: o } = this._pointLabelItems[t];
        return {
            left: e,
            top: s,
            right: n,
            bottom: o
        };
    }
    drawBackground() {
        let { backgroundColor: t, grid: { circular: e } } = this.options;
        if (t) {
            let s = this.ctx;
            s.save(), s.beginPath(), _o(this, this.getDistanceFromCenterForValue(this._endValue), e, this._pointLabels.length), s.closePath(), s.fillStyle = t, s.fill(), s.restore();
        }
    }
    drawGrid() {
        let t = this.ctx, e = this.options, { angleLines: s, grid: n, border: o } = e, a = this._pointLabels.length, r, l, c;
        if (e.pointLabels.display && gc(this, a), n.display && this.ticks.forEach((h, d)=>{
            if (d !== 0) {
                l = this.getDistanceFromCenterForValue(h.value);
                let u = this.getContext(d), f = n.setContext(u), p = o.setContext(u);
                pc(this, f, l, a, p);
            }
        }), s.display) {
            for(t.save(), r = a - 1; r >= 0; r--){
                let h = s.setContext(this.getPointLabelContext(r)), { color: d, lineWidth: u } = h;
                !u || !d || (t.lineWidth = u, t.strokeStyle = d, t.setLineDash(h.borderDash), t.lineDashOffset = h.borderDashOffset, l = this.getDistanceFromCenterForValue(e.ticks.reverse ? this.min : this.max), c = this.getPointPosition(r, l), t.beginPath(), t.moveTo(this.xCenter, this.yCenter), t.lineTo(c.x, c.y), t.stroke());
            }
            t.restore();
        }
    }
    drawBorder() {}
    drawLabels() {
        let t = this.ctx, e = this.options, s = e.ticks;
        if (!s.display) return;
        let n = this.getIndexAngle(0), o, a;
        t.save(), t.translate(this.xCenter, this.yCenter), t.rotate(n), t.textAlign = "center", t.textBaseline = "middle", this.ticks.forEach((r, l)=>{
            if (l === 0 && !e.reverse) return;
            let c = s.setContext(this.getContext(l)), h = j1(c.font);
            if (o = this.getDistanceFromCenterForValue(this.ticks[l].value), c.showLabelBackdrop) {
                t.font = h.string, a = t.measureText(r.label).width, t.fillStyle = c.backdropColor;
                let d = X2(c.backdropPadding);
                t.fillRect(-a / 2 - d.left, -o - h.size / 2 - d.top, a + d.width, h.size + d.height);
            }
            vt(t, r.label, 0, -o, h, {
                color: c.color
            });
        }), t.restore();
    }
    drawTitle() {}
}, Ze1 = {
    millisecond: {
        common: !0,
        size: 1,
        steps: 1e3
    },
    second: {
        common: !0,
        size: 1e3,
        steps: 60
    },
    minute: {
        common: !0,
        size: 6e4,
        steps: 60
    },
    hour: {
        common: !0,
        size: 36e5,
        steps: 24
    },
    day: {
        common: !0,
        size: 864e5,
        steps: 30
    },
    week: {
        common: !1,
        size: 6048e5,
        steps: 4
    },
    month: {
        common: !0,
        size: 2628e6,
        steps: 12
    },
    quarter: {
        common: !1,
        size: 7884e6,
        steps: 4
    },
    year: {
        common: !0,
        size: 3154e7
    }
}, Z1 = Object.keys(Ze1);
function bc(i, t) {
    return i - t;
}
function Kn(i, t) {
    if (A1(t)) return null;
    let e = i._adapter, { parser: s, round: n, isoWeekday: o } = i._parseOpts, a = t;
    return typeof s == "function" && (a = s(a)), N2(a) || (a = typeof s == "string" ? e.parse(a, s) : e.parse(a)), a === null ? null : (n && (a = n === "week" && (Dt(o) || o === !0) ? e.startOf(a, "isoWeek", o) : e.startOf(a, n)), +a);
}
function qn(i, t, e, s) {
    let n = Z1.length;
    for(let o = Z1.indexOf(i); o < n - 1; ++o){
        let a = Ze1[Z1[o]], r = a.steps ? a.steps : Number.MAX_SAFE_INTEGER;
        if (a.common && Math.ceil((e - t) / (r * a.size)) <= s) return Z1[o];
    }
    return Z1[n - 1];
}
function _c(i, t, e, s, n) {
    for(let o = Z1.length - 1; o >= Z1.indexOf(e); o--){
        let a = Z1[o];
        if (Ze1[a].common && i._adapter.diff(n, s, a) >= t - 1) return a;
    }
    return Z1[e ? Z1.indexOf(e) : 0];
}
function xc(i) {
    for(let t = Z1.indexOf(i) + 1, e = Z1.length; t < e; ++t)if (Ze1[Z1[t]].common) return Z1[t];
}
function Gn(i, t, e) {
    if (!e) i[t] = !0;
    else if (e.length) {
        let { lo: s, hi: n } = De(e, t), o = e[s] >= t ? e[s] : e[n];
        i[o] = !0;
    }
}
function yc(i, t, e, s) {
    let n = i._adapter, o = +n.startOf(t[0].value, s), a = t[t.length - 1].value, r, l;
    for(r = o; r <= a; r = +n.add(r, 1, s))l = e[r], l >= 0 && (t[l].major = !0);
    return t;
}
function Jn(i, t, e) {
    let s = [], n = {}, o = t.length, a, r;
    for(a = 0; a < o; ++a)r = t[a], n[r] = a, s.push({
        value: r,
        major: !1
    });
    return o === 0 || !e ? s : yc(i, s, n, e);
}
var me = class extends Tt {
    static id = "time";
    static defaults = {
        bounds: "data",
        adapters: {},
        time: {
            parser: !1,
            unit: !1,
            round: !1,
            isoWeekday: !1,
            minUnit: "millisecond",
            displayFormats: {}
        },
        ticks: {
            source: "auto",
            callback: !1,
            major: {
                enabled: !1
            }
        }
    };
    constructor(t){
        super(t), this._cache = {
            data: [],
            labels: [],
            all: []
        }, this._unit = "day", this._majorUnit = void 0, this._offsets = {}, this._normalized = !1, this._parseOpts = void 0;
    }
    init(t, e = {}) {
        let s = t.time || (t.time = {}), n = this._adapter = new Ba._date(t.adapters.date);
        n.init(e), Vt(s.displayFormats, n.formats()), this._parseOpts = {
            parser: s.parser,
            round: s.round,
            isoWeekday: s.isoWeekday
        }, super.init(t), this._normalized = e.normalized;
    }
    parse(t, e) {
        return t === void 0 ? null : Kn(this, t);
    }
    beforeLayout() {
        super.beforeLayout(), this._cache = {
            data: [],
            labels: [],
            all: []
        };
    }
    determineDataLimits() {
        let t = this.options, e = this._adapter, s = t.time.unit || "day", { min: n, max: o, minDefined: a, maxDefined: r } = this.getUserBounds();
        function l(c) {
            !a && !isNaN(c.min) && (n = Math.min(n, c.min)), !r && !isNaN(c.max) && (o = Math.max(o, c.max));
        }
        (!a || !r) && (l(this._getLabelBounds()), (t.bounds !== "ticks" || t.ticks.source !== "labels") && l(this.getMinMax(!1))), n = N2(n) && !isNaN(n) ? n : +e.startOf(Date.now(), s), o = N2(o) && !isNaN(o) ? o : +e.endOf(Date.now(), s) + 1, this.min = Math.min(n, o - 1), this.max = Math.max(n + 1, o);
    }
    _getLabelBounds() {
        let t = this.getLabelTimestamps(), e = Number.POSITIVE_INFINITY, s = Number.NEGATIVE_INFINITY;
        return t.length && (e = t[0], s = t[t.length - 1]), {
            min: e,
            max: s
        };
    }
    buildTicks() {
        let t = this.options, e = t.time, s = t.ticks, n = s.source === "labels" ? this.getLabelTimestamps() : this._generate();
        t.bounds === "ticks" && n.length && (this.min = this._userMin || n[0], this.max = this._userMax || n[n.length - 1]);
        let o = this.min, a = this.max, r = Rs(n, o, a);
        return this._unit = e.unit || (s.autoSkip ? qn(e.minUnit, this.min, this.max, this._getLabelCapacity(o)) : _c(this, r.length, e.minUnit, this.min, this.max)), this._majorUnit = !s.major.enabled || this._unit === "year" ? void 0 : xc(this._unit), this.initOffsets(n), t.reverse && r.reverse(), Jn(this, r, this._majorUnit);
    }
    afterAutoSkip() {
        this.options.offsetAfterAutoskip && this.initOffsets(this.ticks.map((t)=>+t.value));
    }
    initOffsets(t = []) {
        let e = 0, s = 0, n, o;
        this.options.offset && t.length && (n = this.getDecimalForValue(t[0]), t.length === 1 ? e = 1 - n : e = (this.getDecimalForValue(t[1]) - n) / 2, o = this.getDecimalForValue(t[t.length - 1]), t.length === 1 ? s = o : s = (o - this.getDecimalForValue(t[t.length - 2])) / 2);
        let a = t.length < 3 ? .5 : .25;
        e = $2(e, 0, a), s = $2(s, 0, a), this._offsets = {
            start: e,
            end: s,
            factor: 1 / (e + 1 + s)
        };
    }
    _generate() {
        let t = this._adapter, e = this.min, s = this.max, n = this.options, o = n.time, a = o.unit || qn(o.minUnit, e, s, this._getLabelCapacity(e)), r = P1(n.ticks.stepSize, 1), l = a === "week" ? o.isoWeekday : !1, c = Dt(l) || l === !0, h = {}, d = e, u, f;
        if (c && (d = +t.startOf(d, "isoWeek", l)), d = +t.startOf(d, c ? "day" : a), t.diff(s, e, a) > 1e5 * r) throw new Error(e + " and " + s + " are too far apart with stepSize of " + r + " " + a);
        let p = n.ticks.source === "data" && this.getDataTimestamps();
        for(u = d, f = 0; u < s; u = +t.add(u, r, a), f++)Gn(h, u, p);
        return (u === s || n.bounds === "ticks" || f === 1) && Gn(h, u, p), Object.keys(h).sort((g, m)=>g - m).map((g)=>+g);
    }
    getLabelForValue(t) {
        let e = this._adapter, s = this.options.time;
        return s.tooltipFormat ? e.format(t, s.tooltipFormat) : e.format(t, s.displayFormats.datetime);
    }
    _tickFormatFunction(t, e, s, n) {
        let o = this.options, a = o.ticks.callback;
        if (a) return E1(a, [
            t,
            e,
            s
        ], this);
        let r = o.time.displayFormats, l = this._unit, c = this._majorUnit, h = l && r[l], d = c && r[c], u = s[e], f = c && d && u && u.major;
        return this._adapter.format(t, n || (f ? d : h));
    }
    generateTickLabels(t) {
        let e, s, n;
        for(e = 0, s = t.length; e < s; ++e)n = t[e], n.label = this._tickFormatFunction(n.value, e, t);
    }
    getDecimalForValue(t) {
        return t === null ? NaN : (t - this.min) / (this.max - this.min);
    }
    getPixelForValue(t) {
        let e = this._offsets, s = this.getDecimalForValue(t);
        return this.getPixelForDecimal((e.start + s) * e.factor);
    }
    getValueForPixel(t) {
        let e = this._offsets, s = this.getDecimalForPixel(t) / e.factor - e.end;
        return this.min + s * (this.max - this.min);
    }
    _getLabelSize(t) {
        let e = this.options.ticks, s = this.ctx.measureText(t).width, n = it1(this.isHorizontal() ? e.maxRotation : e.minRotation), o = Math.cos(n), a = Math.sin(n), r = this._resolveTickFontOptions(0).size;
        return {
            w: s * o + r * a,
            h: s * a + r * o
        };
    }
    _getLabelCapacity(t) {
        let e = this.options.time, s = e.displayFormats, n = s[e.unit] || s.millisecond, o = this._tickFormatFunction(t, 0, Jn(this, [
            t
        ], this._majorUnit), n), a = this._getLabelSize(o), r = Math.floor(this.isHorizontal() ? this.width / a.w : this.height / a.h) - 1;
        return r > 0 ? r : 1;
    }
    getDataTimestamps() {
        let t = this._cache.data || [], e, s;
        if (t.length) return t;
        let n = this.getMatchingVisibleMetas();
        if (this._normalized && n.length) return this._cache.data = n[0].controller.getAllParsedValues(this);
        for(e = 0, s = n.length; e < s; ++e)t = t.concat(n[e].controller.getAllParsedValues(this));
        return this._cache.data = this.normalize(t);
    }
    getLabelTimestamps() {
        let t = this._cache.labels || [], e, s;
        if (t.length) return t;
        let n = this.getLabels();
        for(e = 0, s = n.length; e < s; ++e)t.push(Kn(this, n[e]));
        return this._cache.labels = this._normalized ? t : this.normalize(t);
    }
    normalize(t) {
        return hi(t.sort(bc));
    }
};
function We(i, t, e) {
    let s = 0, n = i.length - 1, o, a, r, l;
    e ? (t >= i[s].pos && t <= i[n].pos && ({ lo: s, hi: n } = at(i, "pos", t)), { pos: o, time: r } = i[s], { pos: a, time: l } = i[n]) : (t >= i[s].time && t <= i[n].time && ({ lo: s, hi: n } = at(i, "time", t)), { time: o, pos: r } = i[s], { time: a, pos: l } = i[n]);
    let c = a - o;
    return c ? r + (l - r) * (t - o) / c : r;
}
var us = class extends me {
    static id = "timeseries";
    static defaults = me.defaults;
    constructor(t){
        super(t), this._table = [], this._minPos = void 0, this._tableRange = void 0;
    }
    initOffsets() {
        let t = this._getTimestampsForTable(), e = this._table = this.buildLookupTable(t);
        this._minPos = We(e, this.min), this._tableRange = We(e, this.max) - this._minPos, super.initOffsets(t);
    }
    buildLookupTable(t) {
        let { min: e, max: s } = this, n = [], o = [], a, r, l, c, h;
        for(a = 0, r = t.length; a < r; ++a)c = t[a], c >= e && c <= s && n.push(c);
        if (n.length < 2) return [
            {
                time: e,
                pos: 0
            },
            {
                time: s,
                pos: 1
            }
        ];
        for(a = 0, r = n.length; a < r; ++a)h = n[a + 1], l = n[a - 1], c = n[a], Math.round((h + l) / 2) !== c && o.push({
            time: c,
            pos: a / (r - 1)
        });
        return o;
    }
    _getTimestampsForTable() {
        let t = this._cache.all || [];
        if (t.length) return t;
        let e = this.getDataTimestamps(), s = this.getLabelTimestamps();
        return e.length && s.length ? t = this.normalize(e.concat(s)) : t = e.length ? e : s, t = this._cache.all = t, t;
    }
    getDecimalForValue(t) {
        return (We(this._table, t) - this._minPos) / this._tableRange;
    }
    getValueForPixel(t) {
        let e = this._offsets, s = this.getDecimalForPixel(t) / e.factor - e.end;
        return We(this._table, s * this._tableRange + this._minPos, !0);
    }
}, vc = Object.freeze({
    __proto__: null,
    CategoryScale: rs,
    LinearScale: ls,
    LogarithmicScale: cs,
    RadialLinearScale: ds,
    TimeScale: me,
    TimeSeriesScale: us
});
function distinct(array) {
    const set = new Set(array);
    return Array.from(set);
}
function sortBy(array, selector, options) {
    const len = array.length;
    const indexes = new Array(len);
    const selectors = new Array(len);
    const order = options?.order ?? "asc";
    for(let i = 0; i < len; i++){
        indexes[i] = i;
        const s = selector(array[i]);
        selectors[i] = Number.isNaN(s) ? null : s;
    }
    indexes.sort((ai, bi)=>{
        let a = selectors[ai];
        let b = selectors[bi];
        if (order === "desc") {
            [a, b] = [
                b,
                a
            ];
        }
        if (a === null) return 1;
        if (b === null) return -1;
        return a > b ? 1 : a < b ? -1 : 0;
    });
    for(let i = 0; i < len; i++){
        indexes[i] = array[indexes[i]];
    }
    return indexes;
}
function replacePlaceholders(str, nameValuePairs) {
    const nvps = Array.isArray(nameValuePairs) ? nameValuePairs : [
        [
            'arg',
            nameValuePairs
        ]
    ];
    let i = 0;
    return str.replace(/%[dDsS]/g, (sub)=>{
        const nvp = nvps[i];
        i++;
        if (nvp === undefined) return sub;
        return nvp[1].toString();
    });
}
function pluralize(n, strings1, singleKey, pluralKey, format) {
    return replacePlaceholders(strings1[n === 1 ? singleKey : pluralKey], (format ?? withCommas).format(n));
}
const supportedLanguageLabels = {
    en: 'English (US)',
    es: 'Español',
    fr: 'Français',
    nl: 'Nederlands',
    de: 'Deutsch',
    it: 'Italiano',
    'en-gb': 'English (British)'
};
Object.keys(supportedLanguageLabels);
const withCommas = new Intl.NumberFormat('en-US');
function checkMatches(name1, value, pattern) {
    const m = pattern.exec(value);
    if (!m) throw new Error(`Bad ${name1}: ${value}`);
    return m;
}
function isValidHour(hour) {
    return typeof hour === 'string' && /^2\d{3}-(0[1-9]|1[012])-(0[1-9]|[12]\d|3[01])T([0-1][0-9]|2[0-3])$/.test(hour);
}
function isValidDate(date) {
    return typeof date === 'string' && /^2\d{3}-(0[1-9]|1[012])-(0[1-9]|[12]\d|3[01])$/.test(date);
}
function isValidMonth(month) {
    return /^2\d{3}-(0[1-9]|1[012])$/.test(month);
}
function increment(summary, key, delta = 1) {
    const existing = summary[key];
    summary[key] = (typeof existing === 'number' ? existing : 0) + delta;
}
function incrementAll(summary, keysAndDeltas) {
    for (const [key, delta] of Object.entries(keysAndDeltas)){
        increment(summary, key, delta);
    }
    return summary;
}
function addDays(date, days) {
    if (!Number.isSafeInteger(days)) throw new Error(`Bad days: ${days}`);
    const rt = new Date(date);
    rt.setUTCDate(rt.getUTCDate() + days);
    return rt;
}
function addDaysToDateString(date, days) {
    if (!isValidDate(date)) throw new Error(`Bad date: ${date}`);
    return addDays(`${date}T00:00:00.000Z`, days).toISOString().substring(0, 10);
}
function addMonthsToMonthString(month, months) {
    if (!isValidMonth(month)) throw new Error(`Bad month: ${month}`);
    if (!Number.isSafeInteger(months)) throw new Error(`Bad months: ${months}`);
    const rt = new Date(`${month}-01T00:00:00.000Z`);
    rt.setUTCMonth(rt.getUTCMonth() + months);
    return rt.toISOString().substring(0, 7);
}
function addHoursToHourString(hour, hours) {
    if (!isValidHour(hour)) throw new Error(`Bad hour: ${hour}`);
    if (!Number.isSafeInteger(hours)) throw new Error(`Bad hours: ${hours}`);
    const rt = new Date(`${hour}:00:00.000Z`);
    rt.setUTCHours(rt.getUTCHours() + hours);
    return rt.toISOString().substring(0, 13);
}
function element(id) {
    const rt = document.getElementById(id);
    if (!rt) throw new Error(`Element not found: ${id}`);
    return rt;
}
function removeAllChildren(node) {
    while(node.firstChild)node.removeChild(node.firstChild);
}
function computeMonthName(month, lang, { includeYear } = {}) {
    return (includeYear ? getMonthNameAndYearFormat(lang) : getMonthNameFormat(lang)).format(new Date(`${month}-01T00:00:00.000Z`));
}
function download(content, { type, filename }) {
    const parts = typeof content === 'string' ? [
        content
    ] : content;
    const blob = new Blob(parts, {
        type
    });
    const blobUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = blobUrl;
    anchor.target = '_blank';
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(blobUrl);
}
function getOrCache(map, key, valueFn) {
    let rt = map.get(key);
    if (!rt) {
        rt = valueFn();
        map.set(key, rt);
    }
    return rt;
}
const monthNameFormatsByLocale = new Map();
function getMonthNameFormat(lang) {
    return getOrCacheByLocale(monthNameFormatsByLocale, lang, (locale)=>new Intl.DateTimeFormat(locale, {
            month: 'long',
            timeZone: 'UTC'
        }));
}
const monthNameAndYearFormatsByLocale = new Map();
function getMonthNameAndYearFormat(lang) {
    return getOrCacheByLocale(monthNameAndYearFormatsByLocale, lang, (locale)=>new Intl.DateTimeFormat(locale, {
            month: 'long',
            year: 'numeric',
            timeZone: 'UTC'
        }));
}
const numberFormatsByLocale = new Map();
function getNumberFormat(lang) {
    return getOrCacheByLocale(numberFormatsByLocale, lang, (locale)=>new Intl.NumberFormat(locale));
}
const dayFormatsByLocale = new Map();
function getDayFormat(lang) {
    return getOrCacheByLocale(dayFormatsByLocale, lang, (locale)=>new Intl.DateTimeFormat(locale, {
            weekday: 'short',
            month: 'long',
            day: 'numeric',
            timeZone: 'UTC'
        }));
}
const shorterDayFormatsByLocale = new Map();
function getShorterDayFormat(lang) {
    return getOrCacheByLocale(shorterDayFormatsByLocale, lang, (locale)=>new Intl.DateTimeFormat(locale, {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            timeZone: 'UTC'
        }));
}
const dayAndHourFormatsByLocale = new Map();
function getDayAndHourFormat(lang) {
    return getOrCacheByLocale(dayAndHourFormatsByLocale, lang, (locale)=>new Intl.DateTimeFormat(locale, {
            weekday: 'short',
            month: 'long',
            day: 'numeric',
            hour: 'numeric',
            hour12: true,
            timeZone: 'UTC'
        }));
}
const timeOnlyFormatsByLocale = new Map();
function getTimeOnlyFormat(lang) {
    return getOrCacheByLocale(timeOnlyFormatsByLocale, lang, (locale)=>new Intl.DateTimeFormat(locale, {
            hour: 'numeric',
            hour12: true,
            timeZone: 'UTC'
        }));
}
function getOrCacheByLocale(map, lang, valueFn) {
    const locale = lang ?? 'en-US';
    return getOrCache(map, locale, ()=>valueFn(locale));
}
const makeDownloadsGraph = ({ hourlyDownloads, episodes, episodeHourlyDownloads, debug, strings: strings1, lang })=>{
    const [downloadsGraphCanvas, downloadsGraphPreviousButton, downloadsGraphGranularitySpan, downloadsGraphOptionsMenu, downloadsGraphRangeSpan, downloadsGraphNextButton] = [
        element('downloads-graph'),
        element('downloads-graph-previous'),
        element('downloads-graph-granularity'),
        element('downloads-graph-options'),
        element('downloads-graph-range'),
        element('downloads-graph-next')
    ];
    const hours = Object.keys(hourlyDownloads);
    const isHourlyMoreInteresting = hours.length < 24 * 5;
    let granularity = isHourlyMoreInteresting ? 'hourly' : 'daily';
    let showEpisodeMarkers = true;
    let rangeStartHourIndex = 0;
    let rangeEndHourIndex = hours.length - 1;
    function recomputeRangeForGranularity() {
        if (granularity === 'daily') {
            rangeStartHourIndex = 0;
            rangeEndHourIndex = hours.length - 1;
        } else if (granularity === 'hourly') {
            const startOfDayInstant = `${hours[rangeEndHourIndex].substring(0, 10)}T00:00:00Z`;
            const rangeStartHour = addDays(startOfDayInstant, -4).toISOString().substring(0, 13);
            rangeStartHourIndex = Math.max(0, hours.indexOf(rangeStartHour));
        }
        redrawChart();
    }
    downloadsGraphPreviousButton.onclick = ()=>{
        if (granularity === 'hourly') {
            const startOfDayInstant = `${hours[rangeStartHourIndex].substring(0, 10)}T00:00:00Z`;
            const rangeStartHour = addDays(startOfDayInstant, -4).toISOString().substring(0, 13);
            rangeStartHourIndex = Math.max(0, hours.indexOf(rangeStartHour));
            rangeEndHourIndex = rangeStartHourIndex + 24 * 4 - 1;
            redrawChart();
            update();
        }
    };
    downloadsGraphNextButton.onclick = ()=>{
        if (granularity === 'hourly') {
            const startOfDayInstant = `${hours[rangeStartHourIndex].substring(0, 10)}T00:00:00Z`;
            const rangeStartHour = addDays(startOfDayInstant, 4).toISOString().substring(0, 13);
            rangeStartHourIndex = Math.max(0, hours.indexOf(rangeStartHour));
            rangeEndHourIndex = Math.min(rangeStartHourIndex + 24 * 4 - 1, hours.length - 1);
            redrawChart();
            update();
        }
    };
    downloadsGraphOptionsMenu.addEventListener('sl-select', (ev)=>{
        const e = ev;
        const item = e.detail.item;
        const { value } = item;
        if (isGranularity(value)) {
            if (granularity === value) return;
            granularity = value;
            recomputeRangeForGranularity();
            update();
        } else if (value === 'episode-markers') {
            showEpisodeMarkers = !showEpisodeMarkers;
            update();
            redrawChart();
        }
    });
    let chart;
    function redrawChart() {
        if (chart) chart.destroy();
        const hourlyDownloadsToChart = Object.fromEntries(Object.entries(hourlyDownloads).slice(rangeStartHourIndex, rangeEndHourIndex + 1));
        chart = drawDownloadsChart(downloadsGraphCanvas, hourlyDownloadsToChart, episodeHourlyDownloads, granularity, debug, strings1, lang, showEpisodeMarkers ? episodes : undefined);
    }
    function update() {
        downloadsGraphGranularitySpan.textContent = ({
            'hourly': strings1.hourly_downloads,
            'six-hourly': strings1.six_hourly_downloads,
            'twelve-hourly': strings1.twelve_hourly_downloads,
            'daily': strings1.daily_downloads
        })[granularity];
        const items = downloadsGraphOptionsMenu.querySelectorAll('sl-menu-item');
        for (const item of items){
            const { value } = item;
            if (isGranularity(value)) {
                item.checked = value === granularity;
            } else if (value === 'episode-markers') {
                item.checked = showEpisodeMarkers;
            }
        }
        downloadsGraphPreviousButton.disabled = rangeStartHourIndex === 0;
        downloadsGraphRangeSpan.textContent = hours.length === 0 ? '' : `${computeRangeDisplay(hours[rangeStartHourIndex], lang)} – ${computeRangeDisplay(hours[rangeEndHourIndex], lang)}`;
        downloadsGraphNextButton.disabled = hours.length === 0 || rangeEndHourIndex === hours.length - 1;
    }
    update();
    redrawChart();
    return {
        update
    };
};
function isGranularity(obj) {
    return [
        'hourly',
        'six-hourly',
        'twelve-hourly',
        'daily'
    ].includes(obj);
}
function computeRangeDisplay(hour, lang) {
    return `${computeMonthName(hour.substring(0, 7), lang)} ${parseInt(hour.substring(8, 10))}`;
}
function computeKeyForGranularity(hour, granularity) {
    const [_, date, hh] = checkMatches('hour', hour, /^(.*)T(\d{2})$/);
    if (granularity === 'hourly') return `${date}T${hh}:00:00.000Z`;
    if (granularity === 'six-hourly') return `${date}T${(Math.floor(parseInt(hh) / 6) * 6).toString().padStart(2, '0')}:00:00.000Z`;
    if (granularity === 'twelve-hourly') return `${date}T${(Math.floor(parseInt(hh) / 12) * 12).toString().padStart(2, '0')}:00:00.000Z`;
    if (granularity === 'daily') return `${date}T00:00:00.000Z`;
    throw new Error(`Unsupported granularity: ${granularity}`);
}
function computeDownloads(hourlyDownloads, granularity) {
    const rt = {};
    for (const [hour, downloads] of Object.entries(hourlyDownloads)){
        const key = computeKeyForGranularity(hour, granularity);
        increment(rt, key, downloads);
    }
    return rt;
}
function computeEpisodeMarkerIndex(episodes, downloadLabels, granularity, episodeHourlyDownloads) {
    const rt = new Map();
    for (const ep of episodes){
        const { firstHour, pubdate } = ep;
        const findValue = granularity === 'hourly' ? `${firstHour}:00:00.000Z` : `${firstHour.substring(0, 10)}T00:00:00.000Z`;
        const index = downloadLabels.indexOf(findValue);
        if (index < 0) continue;
        if (!pubdate) continue;
        const diff = new Date(`${firstHour}:00:00.000Z`).getTime() - new Date(pubdate).getTime();
        if (diff > 1000 * 60 * 60 * 24 * 5) continue;
        if (Object.keys(episodeHourlyDownloads[ep.id] ?? {}).length === 0) continue;
        const records = rt.get(index) ?? [];
        rt.set(index, records);
        records.push(ep);
    }
    return rt;
}
function drawDownloadsChart(canvas, hourlyDownloads, episodeHourlyDownloads, granularity, debug, strings1, lang, episodes) {
    const downloads = computeDownloads(hourlyDownloads, granularity);
    const downloadLabels = Object.keys(downloads);
    const episodeMarkerIndex = episodes ? computeEpisodeMarkerIndex(episodes, downloadLabels, granularity, episodeHourlyDownloads) : undefined;
    const dateFormat = granularity === 'daily' ? getDayFormat(lang) : getDayAndHourFormat(lang);
    const locale = lang ?? 'en-US';
    const ctx = canvas.getContext('2d');
    const data = {
        labels: downloadLabels,
        datasets: [
            {
                data: Object.values(downloads),
                backgroundColor: 'rgba(75, 192, 192, 0.75)',
                hoverBackgroundColor: 'rgba(75, 192, 192, 1)',
                pointRadius: 0,
                borderWidth: 0
            }
        ]
    };
    const config = {
        type: 'bar',
        data,
        options: {
            animation: {
                duration: 100
            },
            interaction: {
                intersect: false,
                mode: 'index'
            },
            locale,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    displayColors: false,
                    footerColor: 'rgba(154, 52, 18, 1)',
                    callbacks: {
                        title: (items)=>dateFormat.format(new Date(items[0].label)),
                        label: (item)=>pluralize(item.parsed.y, strings1, 'one_download', 'multiple_downloads'),
                        footer: (items)=>{
                            const records = episodeMarkerIndex?.get(items[0].parsed.x) ?? [];
                            return records.length === 0 ? undefined : records.map((v)=>`${replacePlaceholders(strings1.published_episode, v.title ?? '')}${debug ? ` f:${v.firstHour} p:${v.pubdate}` : ''}`).join('\n');
                        }
                    }
                }
            },
            scales: {
                x: {
                    ticks: {
                        callback: function(value) {
                            const label = this.getLabelForValue(value);
                            const d = new Date(label);
                            const format = d.getUTCHours() === 0 ? getShorterDayFormat(lang) : getTimeOnlyFormat(lang);
                            return format.format(d);
                        }
                    }
                }
            }
        },
        plugins: [
            {
                beforeDraw: (chart)=>{
                    if (!episodeMarkerIndex) return;
                    const meta = chart.getDatasetMeta(0).controller.getMeta();
                    for (const index of episodeMarkerIndex.keys()){
                        const x = meta.data[index].x;
                        const ctx = chart.ctx;
                        const { chartArea } = chart;
                        ctx.beginPath();
                        ctx.strokeStyle = 'rgba(154, 52, 18, 0.75)';
                        ctx.moveTo(x, chartArea.top);
                        ctx.lineTo(x, chartArea.bottom);
                        ctx.stroke();
                    }
                }
            }
        ]
    };
    return new ts(ctx, config);
}
const makeEpisodePacing = ({ episodeHourlyDownloads, episodes, showTitle, showSlug, mostRecentDate, shot, strings: strings1, lang })=>{
    const [episodePacingPrevious, episodePacingNext, episodePacingShotHeader, episodePacingCanvas, episodePacingShotFooter, episodePacingLegendElement, episodePacingNav, episodePacingNavCaption, episodePacingExportButton, episodePacingLegendItemTemplate] = [
        element('episode-pacing-previous'),
        element('episode-pacing-next'),
        element('episode-pacing-shot-header'),
        element('episode-pacing'),
        element('episode-pacing-shot-footer'),
        element('episode-pacing-legend'),
        element('episode-pacing-nav'),
        element('episode-pacing-nav-caption'),
        element('episode-pacing-export'),
        element('episode-pacing-legend-item')
    ];
    if (shot) {
        episodePacingShotHeader.classList.remove('hidden');
        episodePacingShotHeader.innerHTML = showTitle ?? '(untitled)';
        episodePacingShotFooter.classList.remove('hidden');
        episodePacingCanvas.style.marginLeft = episodePacingCanvas.style.marginRight = '4rem';
        document.body.style.backgroundColor = 'black';
        document.querySelector('footer').style.display = 'none';
        const main = document.querySelector('main');
        for (const node of main.childNodes){
            if (node instanceof HTMLElement) {
                if (node.id === 'episode-pacing-container') {
                    break;
                }
                node.style.display = 'none';
            }
        }
    }
    const pageSize = 8;
    let episodeIdsWithData = [];
    let episodeRelativeSummaries = {};
    let pages = 0;
    let maxPageIndex = 0;
    let pageIndex = 0;
    let final_ = false;
    let currentChart;
    function redrawChart() {
        if (currentChart) currentChart.destroy();
        currentChart = undefined;
        const pageEpisodeIds = episodeIdsWithData.slice(pageIndex * 8, (pageIndex + 1) * 8);
        const pageEpisodeRelativeSummaries = Object.fromEntries(pageEpisodeIds.map((v)=>[
                v,
                episodeRelativeSummaries[v]
            ]));
        const suggestedMax = Math.max(...Object.values(pageEpisodeRelativeSummaries).map((v)=>Math.max(...Object.values(v.cumulative))));
        const episodeInfos = Object.fromEntries(episodes.map((v)=>[
                v.id,
                v
            ]));
        const chart = drawPacingChart(episodePacingCanvas, pageEpisodeRelativeSummaries, suggestedMax, episodeInfos, shot, strings1, lang);
        initLegend(chart, episodePacingLegendItemTemplate, episodePacingLegendElement, episodePacingNav, pageEpisodeRelativeSummaries, lang);
        currentChart = chart;
    }
    function updateEpisodeHourlyDownloads(episodeHourlyDownloads, __final) {
        if (__final) console.log(`updateEpisodeHourlyDownloadsFinal: changed=${!!episodeHourlyDownloads}`);
        final_ = __final;
        if (episodeHourlyDownloads) {
            episodeIdsWithData = episodes.filter((v)=>episodeHourlyDownloads[v.id]).map((v)=>v.id);
            episodeRelativeSummaries = Object.fromEntries(Object.entries(episodeHourlyDownloads).map((v)=>[
                    v[0],
                    computeRelativeSummary(v[1])
                ]));
            pages = Math.ceil(episodeIdsWithData.length / pageSize);
            maxPageIndex = pages - 1;
        }
        episodePacingExportButton.style.visibility = final_ ? 'visible' : 'hidden';
        if (__final) update();
    }
    updateEpisodeHourlyDownloads(episodeHourlyDownloads, false);
    redrawChart();
    episodePacingPrevious.onclick = ()=>{
        if (pageIndex > 0) {
            pageIndex--;
            redrawChart();
            update();
        }
    };
    episodePacingNext.onclick = ()=>{
        if (pageIndex < maxPageIndex && final_) {
            pageIndex++;
            redrawChart();
            update();
        }
    };
    if (mostRecentDate) episodePacingExportButton.onclick = ()=>{
        const tsvRows = [];
        tsvRows.push([
            'episode_title',
            'episode_pub_date',
            'downloads_3_day',
            'downloads_7_day',
            'downloads_30_day',
            'downloads_all_time',
            'downloads_asof'
        ]);
        const formatForTsv = (downloads)=>downloads === undefined || downloads === 0 ? '' : downloads.toString();
        const asof = `${addDaysToDateString(mostRecentDate, 1)}T00:00:00.000Z`;
        for (const episode of episodes){
            const summary = episodeRelativeSummaries[episode.id];
            if (!summary) continue;
            tsvRows.push([
                episode.title ?? '',
                episode.pubdate ?? '',
                formatForTsv(summary.downloads3),
                formatForTsv(summary.downloads7),
                formatForTsv(summary.downloads30),
                formatForTsv(summary.downloadsAll),
                asof
            ]);
        }
        const tsv = tsvRows.map((v)=>v.join('\t')).join('\n');
        const filename = `${showSlug}-episode-downloads.tsv`;
        download(tsv, {
            type: 'text/plain',
            filename
        });
    };
    function update() {
        episodePacingPrevious.disabled = pageIndex === 0;
        episodePacingNext.disabled = !final_ || pageIndex === maxPageIndex;
        episodePacingNavCaption.textContent = replacePlaceholders(strings1.page_x_of_n, [
            [
                'page',
                pageIndex + 1
            ],
            [
                'pages',
                pages
            ]
        ]);
    }
    update();
    return {
        update,
        updateEpisodeHourlyDownloads
    };
};
const ZWSP = '\u200b';
function bindDownloads(item, lang, selector, downloads) {
    const downloadsN = item.querySelector(selector);
    downloadsN.textContent = downloads ? getNumberFormat(lang).format(downloads) : '—';
}
function initLegend(chart, episodePacingLegendItemTemplate, episodePacingLegendElement, episodePacingNav, episodeRelativeSummaries, lang) {
    const summaries = Object.values(episodeRelativeSummaries);
    const items = chart.options.plugins.legend.labels.generateLabels(chart);
    const legendSelections = {};
    const updateChartForLegend = ()=>{
        const noneSelected = Object.values(legendSelections).every((v)=>!v);
        for (const [datasetIndex, selected] of Object.entries(legendSelections)){
            chart.setDatasetVisibility(parseInt(datasetIndex), noneSelected || selected);
        }
        chart.update();
    };
    while(episodePacingLegendElement.childElementCount > 7)episodePacingLegendElement.removeChild(episodePacingNav.previousElementSibling);
    items.forEach((v, i)=>{
        const { text, fillStyle, datasetIndex } = v;
        const summary = summaries[i];
        const item = episodePacingLegendItemTemplate.content.cloneNode(true);
        const dt = item.querySelector('dt');
        dt.style.backgroundColor = fillStyle;
        const dd = item.querySelector('dd');
        dd.textContent = text;
        bindDownloads(item, lang, '.downloads-3', summary.downloads3);
        bindDownloads(item, lang, '.downloads-7', summary.downloads7);
        bindDownloads(item, lang, '.downloads-30', summary.downloads30);
        bindDownloads(item, lang, '.downloads-all', summary.downloadsAll);
        legendSelections[datasetIndex] = false;
        const updateItem = ()=>{
            dt.style.opacity = legendSelections[datasetIndex] ? '1' : '0.9';
            dd.style.opacity = legendSelections[datasetIndex] ? '1' : '0.5';
        };
        updateItem();
        dd.onmouseover = ()=>{
            legendSelections[datasetIndex] = true;
            updateItem();
            updateChartForLegend();
        };
        dd.onmouseout = ()=>{
            legendSelections[datasetIndex] = false;
            updateItem();
            updateChartForLegend();
        };
        episodePacingLegendElement.insertBefore(item, episodePacingNav);
    });
}
function computeRelativeSummary(hourlyDownloads) {
    const cumulative = {};
    let downloads3;
    let downloads7;
    let downloads30;
    let hourNum = 1;
    let total = 0;
    for (const [_hour, downloads] of Object.entries(hourlyDownloads)){
        total += downloads;
        if (hourNum <= 24 * 30) {
            cumulative[`h${(hourNum++).toString().padStart(4, '0')}`] = total;
        }
        if (hourNum === 3 * 24) downloads3 = total;
        if (hourNum === 7 * 24) downloads7 = total;
        if (hourNum === 30 * 24) downloads30 = total;
    }
    return {
        cumulative,
        downloadsAll: total,
        downloads3,
        downloads7,
        downloads30
    };
}
function drawPacingChart(canvas, episodeRelativeSummaries, suggestedMax, episodeInfos, shot, strings1, lang) {
    const allHours = distinct(Object.values(episodeRelativeSummaries).flatMap((v)=>Object.keys(v.cumulative)).sort());
    const parseHourLabel = (label)=>{
        const hour = parseInt(label.substring(1));
        if (hour % 24 === 0) return replacePlaceholders(strings1.day_n, Math.floor(hour / 24));
        return replacePlaceholders(strings1.hour_n, Math.floor(hour));
    };
    const ctx = canvas.getContext('2d');
    const colors = [
        '#003f5c',
        '#2f4b7c',
        '#665191',
        '#a05195',
        '#d45087',
        '#f95d6a',
        '#ff7c43',
        '#ffa600'
    ].reverse();
    const locale = lang ?? 'en-US';
    return new ts(ctx, {
        type: 'line',
        data: {
            labels: allHours,
            datasets: Object.entries(episodeRelativeSummaries).map((v, i)=>({
                    label: [
                        episodeInfos[v[0]]
                    ].filter((v)=>v.pubdate).map((v)=>`${v.pubdate.substring(0, 10)}: ${v.title}`).join(''),
                    data: v[1].cumulative,
                    backgroundColor: colors[i],
                    borderColor: colors[i],
                    borderWidth: 1,
                    pointRadius: 0
                }))
        },
        options: {
            animation: shot ? false : {
                duration: 100
            },
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: 'index'
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    enabled: true,
                    itemSort: (a, b)=>b.parsed.y - a.parsed.y,
                    callbacks: {
                        title: (v)=>parseHourLabel(v[0].label)
                    }
                }
            },
            locale,
            scales: {
                x: {
                    ticks: {
                        autoSkip: false,
                        callback: function(value) {
                            const hour = value + 1;
                            const label = hour % 24 === 0 ? ZWSP + replacePlaceholders(strings1.day_n, Math.floor(hour / 24)) : '';
                            if (label !== '' && this.width < 700 && hour !== 24 && hour / 24 % 5 !== 0) return '';
                            return label;
                        }
                    },
                    grid: {
                        color: (ctx)=>ctx.tick.label.startsWith(ZWSP) ? 'rgba(255, 255, 255, 0.1)' : undefined
                    }
                },
                y: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    beginAtZero: true,
                    suggestedMax
                }
            }
        }
    });
}
const makeExportDownloads = ({ showUuid, showSlug, previewToken: previewToken1, strings: strings1, lang })=>{
    const [exportSpinner, exportIcon, exportTitleDiv, exportCancelButton, exportDropdown, exportOlderButton, exportBotsSwitch] = [
        element('export-spinner'),
        element('export-icon'),
        element('export-title'),
        element('export-cancel'),
        element('export-dropdown'),
        element('export-older'),
        element('export-bots')
    ];
    let exporting;
    let progress;
    const currentMonth = new Date().toISOString().substring(0, 7);
    const locale = lang ?? 'en-US';
    const f = new Intl.DateTimeFormat(locale, {
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC'
    });
    const disables = [
        exportOlderButton,
        exportBotsSwitch
    ];
    for (const monthNum of [
        0,
        1,
        2
    ]){
        const button = element(`export-month-${monthNum}`);
        const month = addMonthsToMonthString(currentMonth, -monthNum);
        button.textContent = f.format(new Date(`${month}-01T00:00:00Z`));
        button.title = month;
        button.onclick = async (e)=>{
            const includeBots = exportBotsSwitch.checked;
            const controller = new AbortController();
            exportCancelButton.onclick = ()=>{
                controller.abort();
                exporting = undefined;
                update();
            };
            exporting = controller;
            progress = 0;
            update();
            try {
                await downloadDownloads(e, showUuid, showSlug, month, previewToken1, includeBots, controller.signal, (v)=>{
                    progress = v;
                    update();
                });
            } finally{
                exporting = undefined;
                update();
            }
        };
        disables.push(button);
    }
    document.addEventListener('keydown', (evt)=>{
        if (evt.key === 'Escape') {
            if (exporting) {
                exporting.abort();
                exporting = undefined;
                update();
            }
        }
    });
    function update() {
        if (exporting) {
            exportDropdown.open = false;
            exportSpinner.classList.remove('hidden');
            exportIcon.classList.add('hidden');
            exportCancelButton.classList.remove('invisible');
            exportTitleDiv.textContent = `Exporting${typeof progress === 'number' && progress > 0 ? ` (${(progress * 100).toFixed(0)}%)` : ''}...`;
        } else {
            exportSpinner.classList.add('hidden');
            exportIcon.classList.remove('hidden');
            exportCancelButton.classList.add('invisible');
            exportTitleDiv.textContent = strings1.export_download_details;
        }
        disables.forEach((v)=>v.disabled = !!exporting);
    }
    update();
    return {
        update
    };
};
async function downloadDownloads(e, showUuid, showSlug, month, previewToken1, includeBots, signal, onProgress) {
    e.preventDefault();
    console.log(`download ${JSON.stringify({
        month,
        includeBots
    })}`);
    const parts = [];
    let continuationToken;
    const qp = new URLSearchParams(document.location.search);
    while(true){
        const u = new URL(`/api/1/downloads/show/${showUuid}`, document.location.href);
        if (qp.has('ro')) u.searchParams.set('ro', 'true');
        const limit = qp.get('limit') ?? '20000';
        u.searchParams.set('start', month);
        u.searchParams.set('end', addMonthsToMonthString(month, 1));
        u.searchParams.set('limit', limit);
        u.searchParams.set('token', previewToken1);
        if (includeBots) u.searchParams.set('bots', 'include');
        if (continuationToken) {
            u.searchParams.set('continuationToken', continuationToken);
            u.searchParams.set('skip', 'headers');
        }
        console.log(`fetch limit=${limit} continuationToken=${continuationToken}`);
        const res = await fetch(u.toString(), {
            signal
        });
        if (signal.aborted) return;
        if (res.status !== 200) throw new Error(`Unexpected status: ${res.status} ${await res.text()}`);
        const blob = await res.blob();
        if (signal.aborted) return;
        parts.push(blob);
        continuationToken = res.headers.get('x-continuation-token');
        const done = typeof continuationToken !== 'string';
        const progress = done ? 1 : parseFloat(res.headers.get('x-progress') ?? '0');
        onProgress(progress);
        if (done) break;
    }
    if (signal.aborted) return;
    const { type } = parts[0];
    download(parts, {
        type,
        filename: `${showSlug}-downloads-${month}${includeBots ? `-including-bots` : ''}.tsv`
    });
}
const makeHeadlineStats = ({ hourlyDownloads, dailyFoundAudience, strings: strings1, lang })=>{
    const [sevenDayDownloadsDiv, sevenDaySpacerLine, sevenDayDownloadsAsofSpan, sevenDayDownloadsSparklineCanvas, thirtyDayDownloadsDiv, thirtyDayDownloadsAsofSpan, thirtyDayDownloadsSparklineCanvas, downloadsCountDiv, downloadsPeriodDiv, downloadsSpacerLine, downloadsMinigraph, audienceCountDiv, audiencePeriodDiv, audienceSpacerLine, audienceMinigraph] = [
        element('seven-day-downloads'),
        element('seven-day-spacer-line'),
        element('seven-day-downloads-asof'),
        element('seven-day-downloads-sparkline'),
        element('thirty-day-downloads'),
        element('thirty-day-downloads-asof'),
        element('thirty-day-downloads-sparkline'),
        element('downloads-count'),
        element('downloads-period'),
        element('downloads-spacer-line'),
        element('downloads-minigraph'),
        element('audience-count'),
        element('audience-period'),
        element('audience-spacer-line'),
        element('audience-minigraph')
    ];
    initDownloadsBox(7, hourlyDownloads, sevenDayDownloadsDiv, sevenDaySpacerLine, sevenDayDownloadsAsofSpan, sevenDayDownloadsSparklineCanvas, lang);
    initDownloadsBox(30, hourlyDownloads, thirtyDayDownloadsDiv, undefined, thirtyDayDownloadsAsofSpan, thirtyDayDownloadsSparklineCanvas, lang);
    const monthlyDownloadsBox = initMonthlyBox(computeMonthlyCounts(hourlyDownloads), downloadsCountDiv, downloadsPeriodDiv, downloadsSpacerLine, downloadsMinigraph, strings1, lang);
    const monthlyAudienceBox = initMonthlyBox(computeMonthlyCounts(dailyFoundAudience), audienceCountDiv, audiencePeriodDiv, audienceSpacerLine, audienceMinigraph, strings1, lang);
    monthlyDownloadsBox.addHoverListener(monthlyAudienceBox.onHoverMonth);
    monthlyAudienceBox.addHoverListener(monthlyDownloadsBox.onHoverMonth);
    function update() {}
    update();
    return {
        update
    };
};
function initDownloadsBox(n, hourlyDownloads, valueDiv, spacerLine, asofSpan, sparklineCanvas, lang) {
    const locale = lang ?? 'en-US';
    const asofFormat = new Intl.DateTimeFormat(locale, {
        weekday: 'short',
        month: 'long',
        day: 'numeric',
        timeZone: 'UTC'
    });
    if (spacerLine && lang === 'nl') spacerLine.classList.remove('hidden');
    const nDayDownloads = computeHourlyNDayDownloads(n, hourlyDownloads);
    if (Object.keys(nDayDownloads).length === 0) {
        valueDiv.textContent = getNumberFormat(lang).format(Object.values(hourlyDownloads).reduce((a, b)=>a + b, 0));
        asofSpan.textContent = Object.keys(hourlyDownloads).length === 0 ? '' : asofFormat.format(new Date(`${Object.keys(hourlyDownloads).at(-1).substring(0, 10)}T00:00:00.000Z`));
        return;
    }
    const init = ()=>{
        valueDiv.textContent = getNumberFormat(lang).format(Object.values(nDayDownloads).at(-1));
        asofSpan.textContent = asofFormat.format(new Date(`${Object.keys(nDayDownloads).at(-1).substring(0, 10)}T00:00:00.000Z`));
    };
    init();
    drawSparkline(sparklineCanvas, nDayDownloads, {
        onHover: (v)=>{
            if (v) {
                valueDiv.textContent = getNumberFormat(lang).format(Math.round(v.value));
                asofSpan.textContent = asofFormat.format(new Date(`${v.label.substring(0, 10)}T00:00:00.000Z`));
            } else {
                init();
            }
        }
    });
}
function computeHourlyNDayDownloads(n, hourlyDownloads) {
    const buffer = [];
    const rt = {};
    const bufferSize = n * 24;
    for (const [hour, downloads] of Object.entries(hourlyDownloads)){
        buffer.push(downloads);
        if (buffer.length > bufferSize) buffer.shift();
        if (buffer.length === bufferSize) {
            rt[hour] = buffer.reduce((a, b)=>a + b, 0);
        }
    }
    return rt;
}
function drawSparkline(canvas, labelsAndValues, { onHover } = {}) {
    const ctx = canvas.getContext('2d');
    const entries = Object.entries(labelsAndValues);
    const values = Object.values(labelsAndValues);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const labels = Object.keys(labelsAndValues);
    const data = {
        labels,
        datasets: [
            {
                data: values,
                fill: false,
                borderColor: 'rgb(75, 192, 192)',
                pointRadius: 0,
                borderWidth: 1
            }
        ]
    };
    const config = {
        type: 'line',
        data,
        options: {
            scales: {
                x: {
                    display: false
                },
                y: {
                    display: false,
                    min: minValue,
                    max: maxValue
                }
            },
            interaction: {
                intersect: false,
                mode: 'index'
            },
            animation: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    enabled: false,
                    backgroundColor: 'transparent',
                    caretSize: 0,
                    padding: 0,
                    titleFont: {
                        style: 'normal',
                        weight: 'normal',
                        size: 12,
                        lineHeight: 1
                    },
                    titleSpacing: 0,
                    titleMarginBottom: 30,
                    callbacks: {
                        label: ()=>''
                    }
                }
            }
        },
        plugins: [
            {
                id: 'event-catcher',
                beforeEvent (_chart, args, _pluginOptions) {
                    if (args.event.type === 'mouseout' && onHover) {
                        onHover();
                    }
                }
            }
        ]
    };
    const chart = new ts(ctx, config);
    if (onHover) {
        chart.options.onHover = (e)=>{
            const points = chart.getElementsAtEventForMode(e, 'index', {
                intersect: false
            }, true);
            if (points.length > 0) {
                const { index } = points[0];
                const [label, value] = entries[index];
                onHover({
                    label,
                    value
                });
            }
        };
    }
}
function computeMonthlyCounts(dateBasedCounts) {
    const monthlyCounts = {};
    for (const [date, count] of Object.entries(dateBasedCounts)){
        const month = date.substring(0, 7);
        increment(monthlyCounts, month, count);
    }
    return monthlyCounts;
}
function initMonthlyBox(monthlyCounts, countDiv, periodDiv, spacerLine, minigraph, strings1, lang) {
    const [lastMonth, lastMonthCount] = Object.entries(monthlyCounts).at(-2) ?? [
        '',
        0
    ];
    const [thisMonth, thisMonthCount] = Object.entries(monthlyCounts).at(-1) ?? [
        '',
        0
    ];
    const initialMonth = lastMonthCount > thisMonthCount ? lastMonth : thisMonth;
    if (lang === 'fr' || lang === 'nl') spacerLine.classList.remove('hidden');
    const hoverListeners = [];
    const onHoverMonth = (hoverMonth)=>{
        const month = hoverMonth ?? initialMonth;
        const value = monthlyCounts[month];
        countDiv.textContent = getNumberFormat(lang).format(value);
        periodDiv.textContent = `${replacePlaceholders(strings1.in_month, [
            [
                'month',
                computeMonthName(month, lang)
            ]
        ])}${month === thisMonth ? ` (${strings1.so_far})` : ''}`;
    };
    if (initialMonth !== '') onHoverMonth(initialMonth);
    drawMinigraph(minigraph, monthlyCounts, {
        onHover: (v)=>{
            onHoverMonth(v?.label);
            hoverListeners.forEach((w)=>w(v?.label));
        }
    });
    return {
        onHoverMonth,
        addHoverListener: (v)=>hoverListeners.push(v)
    };
}
function drawMinigraph(canvas, labelsAndValues, { onHover } = {}) {
    const ctx = canvas.getContext('2d');
    const entries = Object.entries(labelsAndValues);
    const values = Object.values(labelsAndValues);
    const maxValue = Math.max(...values);
    const labels = Object.keys(labelsAndValues);
    const data = {
        labels,
        datasets: [
            {
                data: values,
                borderColor: 'rgb(75, 192, 192)',
                backgroundColor: 'rgba(75, 192, 192, 0.5)',
                pointRadius: 0,
                borderWidth: 1
            }
        ]
    };
    const config = {
        type: 'bar',
        data,
        options: {
            scales: {
                x: {
                    display: false
                },
                y: {
                    display: false,
                    min: 0,
                    max: maxValue
                }
            },
            interaction: {
                intersect: false,
                mode: 'index'
            },
            animation: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    enabled: false,
                    backgroundColor: 'transparent',
                    caretSize: 0,
                    padding: 0,
                    titleFont: {
                        style: 'normal',
                        weight: 'normal',
                        size: 12,
                        lineHeight: 1
                    },
                    titleSpacing: 0,
                    titleMarginBottom: 30,
                    callbacks: {
                        label: ()=>''
                    }
                }
            }
        },
        plugins: [
            {
                id: 'event-catcher',
                beforeEvent (_chart, args, _pluginOptions) {
                    if (args.event.type === 'mouseout' && onHover) {
                        onHover();
                    }
                }
            }
        ]
    };
    const chart = new ts(ctx, config);
    if (onHover) {
        chart.options.onHover = (e)=>{
            const points = chart.getElementsAtEventForMode(e, 'index', {
                intersect: false
            }, true);
            if (points.length > 0) {
                const { index } = points[0];
                const [label, value] = entries[index];
                onHover({
                    label,
                    value
                });
            }
        };
    }
}
const makeTopBox = ({ type, showSlug, exportId, previousId, monthId, nextId, listId, templateId, cardId, monthlyDownloads, downloadsPerMonth, tsvHeaderNames, computeEmoji, computeName, computeUrl, strings: strings1, lang })=>{
    const [exportButton, previousButton, monthDiv, nextButton, list, rowTemplate] = [
        element(exportId),
        element(previousId),
        element(monthId),
        element(nextId),
        element(listId),
        element(templateId)
    ];
    const card = cardId ? element(cardId) : undefined;
    const months = Object.keys(monthlyDownloads);
    const monthlyDownloadsValues = Object.values(monthlyDownloads);
    if (monthlyDownloadsValues.length === 0) return;
    const computeInitialMonthIndex = ()=>{
        const lastMonthsDownloads = Object.values(monthlyDownloadsValues.at(-2) ?? {}).reduce((a, b)=>a + b, 0);
        const thisMonthsDownloads = Object.values(monthlyDownloadsValues.at(-1)).reduce((a, b)=>a + b, 0);
        return months.length - (lastMonthsDownloads > thisMonthsDownloads ? 2 : 1);
    };
    let monthIndex = computeInitialMonthIndex();
    const tsvRows = [
        [
            'rank',
            ...tsvHeaderNames,
            'downloads',
            'pct'
        ]
    ];
    exportButton.onclick = ()=>{
        const tsv = tsvRows.map((v)=>v.join('\t')).join('\n');
        const filename = `${showSlug}-top-${type}-${months[monthIndex]}.tsv`;
        download(tsv, {
            type: 'text/plain',
            filename
        });
    };
    let first = true;
    const updateTableForMonth = ()=>{
        const month = months[monthIndex];
        monthDiv.textContent = computeMonthName(month, lang, {
            includeYear: true
        });
        const monthDownloads = Object.values(monthlyDownloads)[monthIndex] ?? {};
        const totalDownloads = downloadsPerMonth ? downloadsPerMonth[month] : Object.values(monthDownloads).reduce((a, b)=>a + b, 0);
        const pct = Object.values(monthDownloads).reduce((a, b)=>a + b, 0) / totalDownloads;
        if (first && card && cardId) {
            const hide = pct < 0.03;
            console.log({
                cardId,
                pct,
                hide
            });
            if (hide) {
                card.style.display = 'none';
                return;
            }
        }
        first = false;
        removeAllChildren(list);
        const sorted = sortBy(Object.entries(monthDownloads), (v)=>-v[1]);
        for (const [key, downloads] of sorted){
            const item = rowTemplate.content.cloneNode(true);
            const span = item.querySelector('span');
            if (computeEmoji) {
                span.textContent = computeEmoji(key);
            }
            const dt = item.querySelector('dt');
            const isUrl = key.startsWith('https://');
            if (isUrl || computeUrl) {
                dt.textContent = '';
                const a = document.createElement('a');
                a.textContent = computeUrl ? computeName(key) : new URL(key).host;
                a.href = computeUrl ? computeUrl(key) : key;
                a.className = 'text-white';
                a.target = '_blank';
                a.rel = 'nofollow noopener noreferrer';
                dt.appendChild(a);
            } else {
                const name1 = computeName(key);
                dt.textContent = name1;
                dt.title = name1;
            }
            const dd = item.querySelector('dd');
            dd.textContent = (downloads / totalDownloads * 100).toFixed(2).toString() + '%';
            dd.title = pluralize(downloads, strings1, 'one_download', 'multiple_downloads');
            list.appendChild(item);
        }
        previousButton.disabled = monthIndex === 0;
        nextButton.disabled = monthIndex === months.length - 1;
        tsvRows.splice(1);
        let rank = 1;
        for (const [keyStr, downloads] of sorted){
            const key = keyStr.startsWith('https://') ? new URL(keyStr).hostname : keyStr;
            const name1 = computeName(key);
            const pct = (downloads / totalDownloads * 100).toFixed(4);
            const fields = tsvHeaderNames.length === 1 ? [
                name1
            ] : [
                key,
                name1
            ];
            tsvRows.push([
                `${rank++}`,
                ...fields,
                downloads.toString(),
                pct
            ]);
        }
    };
    previousButton.onclick = ()=>{
        if (monthIndex > 0) {
            monthIndex--;
            updateTableForMonth();
        }
    };
    nextButton.onclick = ()=>{
        if (monthIndex < months.length - 1) {
            monthIndex++;
            updateTableForMonth();
        }
    };
    updateTableForMonth();
    function update() {}
    update();
    return {
        update
    };
};
function regionCountryFunctions(implicitCountry) {
    const regionalIndicators = Object.fromEntries([
        ...new Array(26).keys()
    ].map((v)=>[
            String.fromCharCode('A'.charCodeAt(0) + v),
            String.fromCodePoint('🇦'.codePointAt(0) + v)
        ]));
    const computeEmoji = (str)=>{
        const regionCountry = implicitCountry ? `${str}, ${implicitCountry}` : str;
        const countryCode = regionCountry.split(',').at(-1).trim();
        return ({
            'T1': '🧅',
            'XX': '❔'
        })[countryCode] ?? [
            ...countryCode
        ].map((v)=>regionalIndicators[v]).join('');
    };
    const computeFirstRegion = (region)=>{
        return region.replaceAll(/Tri-Cities/g, 'Tri🙄Cities').split('-')[0].trim().replaceAll('🙄', '-');
    };
    const computeUrl = (str)=>{
        const regionCountry = implicitCountry ? `${str}, ${implicitCountry}` : str;
        let query = regionCountry;
        let queryForUrl;
        {
            const m = /^(.*), ([A-Z]{2})$/.exec(query);
            if (m) {
                const region = m[1];
                const country = tryComputeRegionNameInEnglish(m[2]) ?? m[2];
                query = `${region}, ${country}`;
                queryForUrl = `${computeFirstRegion(region)}, ${country}`;
            }
        }
        {
            const m = /^([A-Z]{2})$/.exec(query);
            if (m) query = tryComputeRegionNameInEnglish(m[1]) ?? m[1];
        }
        return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(queryForUrl ?? query)}`;
    };
    return {
        computeEmoji,
        computeUrl
    };
}
function computeMonthlyDownloads(monthlyDimensionDownloads, dimension) {
    const monthlyDownloads = Object.fromEntries(Object.entries(monthlyDimensionDownloads).map(([n, v])=>[
            n,
            v[dimension] ?? {}
        ]));
    Object.values(monthlyDownloads).forEach((v)=>{
        for (const name1 of Object.keys(v)){
            if (name1.startsWith('Unknown, ') || name1 === 'Unknown') {
                delete v[name1];
            }
        }
    });
    return monthlyDownloads;
}
function tryComputeRegionNameInEnglish(countryCode) {
    try {
        return regionNamesInEnglish.of(countryCode);
    } catch (e) {
        console.warn(`tryComputeRegionNameInEnglish: ${e.stack || e} for ${countryCode}`);
    }
}
function computeCountryName(countryCode) {
    if (countryCode === 'T1') return 'Tor traffic';
    if (countryCode === 'XX') return 'Unknown';
    return (countryCode.length === 2 ? tryComputeRegionNameInEnglish(countryCode) : undefined) ?? countryCode;
}
const regionNamesInEnglish = new Intl.DisplayNames([
    'en'
], {
    type: 'region'
});
const makeTopCountries = ({ showSlug, monthlyDimensionDownloads, strings: strings1, lang })=>{
    const monthlyDownloads = computeMonthlyDownloads(monthlyDimensionDownloads, 'countryCode');
    const { computeEmoji, computeUrl } = regionCountryFunctions();
    return makeTopBox({
        type: 'countries',
        showSlug,
        exportId: 'top-countries-export',
        previousId: 'top-countries-month-previous',
        nextId: 'top-countries-month-next',
        monthId: 'top-countries-month',
        listId: 'top-countries',
        templateId: 'top-countries-row',
        monthlyDownloads,
        tsvHeaderNames: [
            'countryCode',
            'countryName'
        ],
        computeEmoji,
        computeName: computeCountryName,
        computeUrl,
        strings: strings1,
        lang
    });
};
function computeAppDownloads(dimensionDownloads) {
    const rt = dimensionDownloads['appName'] ?? {};
    const libs = dimensionDownloads['libraryName'] ?? {};
    const appleCoreMedia = libs['AppleCoreMedia'];
    if (appleCoreMedia) rt['Unknown Apple App'] = appleCoreMedia;
    const referrers = dimensionDownloads['referrer'] ?? {};
    for (const [referrer, downloads] of Object.entries(referrers)){
        const [_, type, name1] = checkMatches('referrer', referrer, /^([a-z]+)\.(.*?)$/);
        if (type === 'app') {
            increment(rt, name1, downloads);
        }
    }
    return rt;
}
const makeTopApps = ({ showSlug, monthlyDimensionDownloads, strings: strings1, lang })=>{
    const monthlyDownloads = Object.fromEntries(Object.entries(monthlyDimensionDownloads).map(([n, v])=>[
            n,
            computeAppDownloads(v)
        ]));
    return makeTopBox({
        type: 'apps',
        showSlug,
        exportId: 'top-apps-export',
        previousId: 'top-apps-month-previous',
        nextId: 'top-apps-month-next',
        monthId: 'top-apps-month',
        listId: 'top-apps',
        templateId: 'top-apps-row',
        monthlyDownloads,
        tsvHeaderNames: [
            'app'
        ],
        computeName: (key)=>key,
        strings: strings1,
        lang
    });
};
const makeTopDevices = ({ showSlug, monthlyDimensionDownloads, strings: strings1, lang })=>{
    const monthlyDownloads = Object.fromEntries(Object.entries(monthlyDimensionDownloads).map(([n, v])=>[
            n,
            v['deviceName'] ?? {}
        ]));
    return makeTopBox({
        type: 'devices',
        showSlug,
        exportId: 'top-devices-export',
        previousId: 'top-devices-month-previous',
        nextId: 'top-devices-month-next',
        monthId: 'top-devices-month',
        listId: 'top-devices',
        templateId: 'top-devices-row',
        monthlyDownloads,
        tsvHeaderNames: [
            'device'
        ],
        computeName: (key)=>key,
        strings: strings1,
        lang
    });
};
const makeTopDeviceTypes = ({ showSlug, monthlyDimensionDownloads, strings: strings1, lang })=>{
    const monthlyDownloads = Object.fromEntries(Object.entries(monthlyDimensionDownloads).map(([n, v])=>[
            n,
            v['deviceType'] ?? {}
        ]));
    return makeTopBox({
        type: 'device-types',
        showSlug,
        exportId: 'top-device-types-export',
        previousId: 'top-device-types-month-previous',
        nextId: 'top-device-types-month-next',
        monthId: 'top-device-types-month',
        listId: 'top-device-types',
        templateId: 'top-device-types-row',
        monthlyDownloads,
        tsvHeaderNames: [
            'deviceType'
        ],
        computeEmoji,
        computeName: computeDeviceTypeName,
        strings: strings1,
        lang
    });
};
function computeDeviceTypeName(deviceType) {
    return deviceType.split('_').map((v)=>v === 'tv' ? 'TV' : v.substring(0, 1).toUpperCase() + v.substring(1)).join(' ');
}
function computeEmoji(deviceType) {
    return ({
        mobile: '📱',
        smart_tv: '📺',
        computer: '💻',
        smart_speaker: '🔊',
        watch: '⌚️'
    })[deviceType] ?? '❔';
}
const makeTopBrowserDownloads = ({ showSlug, monthlyDimensionDownloads, downloadsPerMonth, strings: strings1, lang })=>{
    const monthlyDownloads = Object.fromEntries(Object.entries(monthlyDimensionDownloads).map(([n, v])=>[
            n,
            computeBrowserDownloads(v)
        ]));
    return makeTopBox({
        type: 'browser-and-referrers',
        showSlug,
        exportId: 'top-browser-downloads-export',
        previousId: 'top-browser-downloads-month-previous',
        nextId: 'top-browser-downloads-month-next',
        monthId: 'top-browser-downloads-month',
        listId: 'top-browser-downloads',
        templateId: 'top-browser-downloads-row',
        monthlyDownloads,
        downloadsPerMonth,
        tsvHeaderNames: [
            'browserOrReferrer'
        ],
        computeName: (key)=>key,
        strings: strings1,
        lang
    });
};
function computeBrowserDownloads(dimensionDownloads) {
    const rt = dimensionDownloads['browserName'] ?? {};
    const referrers = dimensionDownloads['referrer'] ?? {};
    for (const [referrer, downloads] of Object.entries(referrers)){
        const [_, type, name1] = checkMatches('referrer', referrer, /^([a-z]+)\.(.*?)$/);
        if (type === 'app') {
            increment(rt, name1, downloads);
        } else if (type === 'domain') {
            if (name1.startsWith('unknown:')) {
                increment(rt, 'Unknown', downloads);
            } else if (name1.includes(' ')) {
                increment(rt, name1, downloads);
            } else {
                increment(rt, `https://${name1}`, downloads);
            }
        } else if (type === 'host') {
            increment(rt, name1, downloads);
        } else {
            console.warn(`Unsupported referrer type: ${type}`);
        }
    }
    delete rt['Unknown'];
    return rt;
}
const METROS = {
    '300': `Tijuana, BA - San Diego, CA`,
    '301': `Ensenada, BA`,
    '302': `Rosarito, BA`,
    '303': `Mexicali, BA - Yuma, AZ - El Centro, CA`,
    '305': `La Paz - Consititucion - San Jose Del Cabo, BJ`,
    '310': `Agua Prieta, SO - Nogales, AZ/SO`,
    '311': `Hermosillo, SO`,
    '315': `Chihuaua, CH`,
    '316': `Ciudad Juarez, CH - El Paso, TX`,
    '320': `Piedras Negras - Ciudad Acuna, CU - Del Rio - Eagle, TX`,
    '321': `Zacatecas - Sombrete, ZA`,
    '322': `Aguascalientes - Calvillo -Ojocaliente, AG`,
    '325': `Nuevo Laredo, TA - Laredo, TX`,
    '326': `Matamoros, TA - Brownsville- Rio Grande Delta, TX`,
    '327': `San Luis Potosi - Tamazuncahle - Ciudad Valles, SL`,
    '330': `Monterrey, NN`,
    '335': `Oaxaca, OA`,
    '340': `Durango, DO`,
    '345': `Mazatlan, SI`,
    '347': `Tepic, NA`,
    '350': `Ciudad Victoria, TA`,
    '351': `Tampico, TA`,
    '360': `Poza Rica, VC`,
    '364': `Tlaxcala, TL`,
    '365': `Guadalajara, JL`,
    '366': `Puerto Vallarta, JL`,
    '367': `Guanajuato - Leon - Celaya, GX`,
    '368': `Queretaro , QU`,
    '369': `Tulancingo - Pachuca, HL`,
    '370': `Mexico City, DF`,
    '371': `Toluca - Altzomoni, MX`,
    '372': `Morelia - Zamora, MC`,
    '373': `Colima - Manzanillo - Tecoman, CL`,
    '374': `Puebla - Tehuacan, PB`,
    '375': `Veracruz, VC`,
    '376': `Oaxaca - Puerta Escondido, OA`,
    '377': `Tapachula, CI`,
    '378': `Villahermosa - La Venta, TB`,
    '379': `Campeche - Ciudad Del Carmen - Escarcega, CE`,
    '380': `Merida, YU`,
    '384': `Cuernavaca, MR`,
    '385': `Cancun, QR`,
    '386': `Acapulco, GR`,
    '490': `Puerto Rico`,
    '491': `Virgin Islands`,
    '493': `American Samoa`,
    '494': `Federated States OF Micronesia`,
    '495': `Guam`,
    '496': `Marshall Islands`,
    '497': `Minor Outlying Islands`,
    '498': `Northern Mariana Islands`,
    '499': `Palau`,
    '500': `Portland-Auburn`,
    '501': `New York`,
    '502': `Binghamton`,
    '503': `Macon`,
    '504': `Philadelphia`,
    '505': `Detroit`,
    '506': `Boston-Manchester`,
    '507': `Savannah`,
    '508': `Pittsburgh`,
    '509': `Ft. Wayne`,
    '510': `Cleveland-Akron-Canton`,
    '511': `Washington, DC-Hagarstown`,
    '512': `Baltimore`,
    '513': `Flint-Saginaw-Bay City`,
    '514': `Buffalo`,
    '515': `Cincinnati`,
    '516': `Erie`,
    '517': `Charlotte`,
    '518': `Greensboro-High Point-Winston/Salem`,
    '519': `Charleston, SC`,
    '520': `Augusta`,
    '521': `Providence-New Bedford`,
    '522': `Columbus, GA-Opelika, AL`,
    '523': `Burlington-Plattsburgh`,
    '524': `Atlanta`,
    '525': `Albany, GA`,
    '526': `Utica`,
    '527': `Indianapolis`,
    '528': `Miami-Ft. Lauderdale`,
    '529': `Louisville`,
    '530': `Tallahassee-Thomasville`,
    '531': `Tri-Cities, TN-VA`,
    '532': `Albany-Schenectady-Troy`,
    '533': `Hartford-New Haven`,
    '534': `Orlando-Daytona Beach-Melbourne`,
    '535': `Columbus, OH`,
    '536': `Youngstown`,
    '537': `Bangor`,
    '538': `Rochester, NY`,
    '539': `Tampa-St. Petersburg-Sarasota`,
    '540': `Traverse City-Cadillac`,
    '541': `Lexington`,
    '542': `Dayton`,
    '543': `Springfield-Holyoke`,
    '544': `Norfolk-Portsmith-Newport News`,
    '545': `Greenville-New Bern-Washington,NC`,
    '546': `Columbia, SC`,
    '547': `Toledo`,
    '548': `West Palm Beach-Ft. Pierce`,
    '549': `Watertown`,
    '550': `Wilmington`,
    '551': `Lansing`,
    '552': `Presque Isle`,
    '553': `Marquette`,
    '554': `Wheeling-Steubenville`,
    '555': `Syracuse`,
    '556': `Richmond-Petersburg`,
    '557': `Knoxville`,
    '558': `Lima`,
    '559': `Bluefield-Beckley-Oak Hill`,
    '560': `Raleigh-Durham-Fayettevlle`,
    '561': `Jacksonville`,
    '563': `Grand Rapids-Kalamazoo-Battlecreek`,
    '564': `Charleston-Huntington`,
    '565': `Elmira-Corning`,
    '566': `Harrisburg-Lancaster-Lebanon-York,PA`,
    '567': `Greenville-Sparta-Asheville`,
    '569': `Harrisonburg`,
    '570': `Myrtle Beach-Florence`,
    '571': `Ft. Myers-Naples`,
    '573': `Roanoke-Lynchburg`,
    '574': `Johnstown-Altoona-ST Colge`,
    '575': `Chattanooga`,
    '576': `Salisbury`,
    '577': `Wilkes Barre-Scranton`,
    '581': `Terre Haute`,
    '582': `Lafayette, IN`,
    '583': `Alpena`,
    '584': `Charlottesville`,
    '588': `South Bend-Elkhart`,
    '592': `Gainesville`,
    '596': `Zanesville`,
    '597': `Parkersburg`,
    '598': `Clarksburg-Weston`,
    '600': `Corpus Christi`,
    '602': `Chicago`,
    '603': `Joplin-Pittsburg`,
    '604': `Columbia-Jefferson City`,
    '605': `Topeka`,
    '606': `Dothan`,
    '609': `St. Louis`,
    '610': `Rockford`,
    '611': `Rochestr-Mason City-Austin`,
    '612': `Shreveport`,
    '613': `Minneapolis-St. Paul`,
    '616': `Kansas City`,
    '617': `Milwaukee`,
    '618': `Houston`,
    '619': `Springfield, MO`,
    '622': `New Orleans`,
    '623': `Dallas-Ft. Worth`,
    '624': `Sioux City`,
    '625': `Waco-Temple-Bryan`,
    '626': `Victoria`,
    '627': `Wichita Falls & Lawton`,
    '628': `Monroe-El Dorado`,
    '630': `Birmingham-Anniston-Tuscaloosa`,
    '631': `Ottumwa-Kirksville`,
    '632': `Paducah-Cape Girardo-Harrisburg`,
    '633': `Odessa-Midland`,
    '634': `Amarillo`,
    '635': `Austin`,
    '636': `Harlingen-Weslaco-Brownsville-Mcarthur`,
    '637': `Cedar Rapids-Waterloo-Iowa City & Dubuque, IA`,
    '638': `St. Joseph`,
    '639': `Jackson, TN`,
    '640': `Memphis`,
    '641': `San Antonio`,
    '642': `Lafayette, LA`,
    '643': `Lake Charles`,
    '644': `Alexandria, LA`,
    '647': `Greenwood-Greenville`,
    '648': `Champaign & Springfield-Decatur`,
    '649': `Evansville`,
    '650': `Oklahoma City`,
    '651': `Lubbock`,
    '652': `Omaha`,
    '656': `Panama City`,
    '657': `Sherman-Ada`,
    '658': `Green Bay-Appleton`,
    '659': `Nashville`,
    '661': `San Angelo`,
    '662': `Abilene-Sweetwater`,
    '669': `Madison`,
    '670': `Ft. Smith-Fayetteville-Sprngdale-Rogers`,
    '671': `Tulsa`,
    '673': `Columbus-Tupelo-West Point`,
    '675': `Peoria-Bloomington`,
    '676': `Duluth-Superior`,
    '678': `Wichita-Hutchinson Plus`,
    '679': `Des Moines-Ames`,
    '682': `Davenport-R.Island-Moline`,
    '686': `Mobile-Pensacola`,
    '687': `Minot-Bismarck-Dickinson`,
    '691': `Huntsville-Decatur-Florence`,
    '692': `Beaumont-Port Arthur`,
    '693': `Little Rock-Pine Bluff`,
    '698': `Montgomery-Selma`,
    '702': `La Crosse-Eau Claire`,
    '705': `Wausau-Rhinelander`,
    '709': `Tyler-Longview (Lufkin&Nacogdoches)`,
    '710': `Hattiesburg-Laurel`,
    '711': `Meridian`,
    '716': `Baton Rouge`,
    '717': `Quincy-Hannibal-Keokuk`,
    '718': `Jackson, MS`,
    '722': `Lincoln & Hastings-Kearny`,
    '724': `Fargo-Valley City`,
    '725': `Sioux Falls-Mitchell`,
    '734': `Jonesboro`,
    '736': `Bowling Green`,
    '737': `Mankato`,
    '740': `North Platte`,
    '743': `Anchorage`,
    '744': `Honolulu`,
    '745': `Fairbanks`,
    '746': `Biloxi-Gulfport`,
    '747': `Juneau`,
    '749': `Laredo`,
    '751': `Denver`,
    '752': `Colorado Springs-Pueblo`,
    '753': `Phoenix-Prescott`,
    '754': `Butte-Bozeman`,
    '755': `Great Falls`,
    '756': `Billings`,
    '757': `Boise`,
    '758': `Idaho Falls-Pocatello-Jackson`,
    '759': `Cheyenne-Scottsbluff`,
    '760': `Twin Falls`,
    '762': `Missoula`,
    '764': `Rapid City`,
    '765': `El Paso-Las Cruces`,
    '766': `Helena`,
    '767': `Casper-Riverton`,
    '770': `Salt Lake City`,
    '771': `Yuma-El Centro`,
    '773': `Grand Junction-Montrose`,
    '789': `Tucson-Sierra Vista`,
    '790': `Albuquerque-Santa FE`,
    '798': `Glendive`,
    '800': `Bakersfield`,
    '801': `Eugene`,
    '802': `Eureka`,
    '803': `Los Angeles`,
    '804': `Palm Springs`,
    '807': `San Francisco-Oakland-San Jose`,
    '810': `Yakima-Pasco-Richland-Kennwick`,
    '811': `Reno`,
    '813': `Medford-Klamath Falls`,
    '819': `Seattle-Tacoma`,
    '820': `Portland, OR`,
    '821': `Bend, OR`,
    '825': `San Diego`,
    '828': `Monterey-Salinas`,
    '839': `Las Vegas`,
    '855': `Santa Barbara-Santa Maria-San Luis Obispo`,
    '862': `Sacramento-Stockton-Modesto`,
    '866': `Fresno-Visalia`,
    '868': `Chico-Redding`,
    '881': `Spokane`,
    '900': `St. Johns - Corner Brook, NL`,
    '905': `Halifax - Dartmouth, NS`,
    '906': `Sydney - Glace Bay, NS`,
    '910': `Charlottetown, Pei`,
    '915': `Rimonouski - Matane - Sept Iles - Gaspe - Perce QC, Cambellton - Bathurst, NB`,
    '916': `St. John - Fredericton - Moncton, NB`,
    '920': `Chaleur Bay - Carleton, QC`,
    '921': `Montreal - Laval, QC`,
    '922': `Ottawa, ON - Gatineau, QC`,
    '923': `Quebec City - Levis, QC`,
    '924': `Riviere DU Loup, QC`,
    '925': `Rouyn - Noranda - Val D'OR, QC`,
    '926': `Saguenay, QC`,
    '927': `Sherbrooke, QC`,
    '928': `Trois -Rivieres - Shawinigan, QC`,
    '940': `Barrie - Orillia, ON`,
    '941': `Kenora, ON`,
    '942': `Kingston, ON`,
    '943': `Kitchener - Waterloo - Cambridge - Guelph, ON`,
    '944': `London - Woodstock - Wingham, ON`,
    '945': `Pembroke - Petawawa, ON`,
    '946': `Peterborough - Belleville - Trenton, ON`,
    '947': `Sault Sainte Marie, ON`,
    '948': `Sudbury - Timmins - North Bay, ON`,
    '949': `Thunder Bay, ON`,
    '950': `Toronto - Hamilton - Niagra Falls, ON`,
    '951': `Windsor, ON`,
    '960': `Winnipeg - Brandon, MB`,
    '965': `Prince Albert, SK`,
    '966': `Regina - Moose Jaw, SK`,
    '967': `Saskatoon, SK`,
    '968': `Swift Current, SK`,
    '969': `Yorkton, SK`,
    '972': `Calgary - Lethbridge, AB`,
    '973': `Edmonton, AB`,
    '974': `Lloydminster, AB/SK`,
    '975': `Medicine Hat, AB`,
    '976': `Red Deer, AB`,
    '980': `Dawson Creek, BC`,
    '981': `Kelowna - Okanagan Valley - Kamloops, BC`,
    '982': `Prince George, BC`,
    '983': `Terrace - Kitimat - Prince Rupert, BC`,
    '984': `Vancouver - Victoria, BC`,
    '990': `Iqaluit, NU`,
    '993': `Yellowknife, NT`,
    '996': `Whitehorse, YT`
};
const makeTopMetros = ({ showSlug, monthlyDimensionDownloads, downloadsPerMonth, strings: strings1, lang })=>{
    const monthlyDownloads = computeMonthlyDownloads(monthlyDimensionDownloads, 'metroCode');
    const { computeUrl } = regionCountryFunctions('US');
    return makeTopBox({
        type: 'metros',
        showSlug,
        exportId: 'top-metros-export',
        previousId: 'top-metros-month-previous',
        nextId: 'top-metros-month-next',
        monthId: 'top-metros-month',
        listId: 'top-metros',
        templateId: 'top-metros-row',
        cardId: 'top-metros-card',
        monthlyDownloads,
        downloadsPerMonth,
        tsvHeaderNames: [
            'metroCode',
            'metroName'
        ],
        computeName: computeMetroName,
        computeUrl: (v)=>computeUrl(computeMetroName(v)),
        strings: strings1,
        lang
    });
};
function computeMetroName(metroCode) {
    return METROS[metroCode] ?? `Metro ${metroCode}`;
}
const makeFooter = ({ mostRecentDate = new Date().toISOString().substring(0, 10), strings: strings1, lang })=>{
    const [lastUpdatedDateSpan, lastUpdatedAgoRelativeTime, languageMenu, timezoneDiv] = [
        element('footer-last-updated-date'),
        element('footer-last-updated-ago'),
        element('footer-language-menu'),
        element('footer-timezone')
    ];
    const locale = lang ?? 'en-US';
    const shorterDayFormat = new Intl.DateTimeFormat(locale, {
        month: 'long',
        day: 'numeric',
        timeZone: 'UTC'
    });
    lastUpdatedDateSpan.textContent = shorterDayFormat.format(new Date(`${mostRecentDate}T00:00:00.000Z`));
    lastUpdatedAgoRelativeTime.date = `${addDaysToDateString(mostRecentDate, 1)}T00:00:00.000Z`;
    languageMenu.addEventListener('sl-select', (event)=>{
        const newLang = event.detail.item.value;
        if (newLang === (lang ?? 'en')) return;
        const u = new URL(document.location.href);
        u.searchParams.set('lang', newLang);
        document.location.href = u.toString();
    });
    try {
        const currentTimezone = Intl.DateTimeFormat(locale).resolvedOptions().timeZone;
        const offsetMinutes = new Date().getTimezoneOffset();
        const offsetHours = pluralize(Math.abs(offsetMinutes) / 60, strings1, 'one_hour', 'multiple_hours');
        timezoneDiv.textContent = offsetMinutes === 0 ? replacePlaceholders(strings1.tz_is_equal_to_utc, [
            [
                'currentTimezone',
                currentTimezone
            ],
            [
                'utc',
                strings1.utc
            ]
        ]) : offsetMinutes > 0 ? replacePlaceholders(strings1.tz_is_behind_utc, [
            [
                'currentTimezone',
                currentTimezone
            ],
            [
                'offsetHours',
                offsetHours
            ],
            [
                'utc',
                strings1.utc
            ]
        ]) : replacePlaceholders(strings1.tz_is_ahead_of_utc, [
            [
                'currentTimezone',
                currentTimezone
            ],
            [
                'offsetHours',
                offsetHours
            ],
            [
                'utc',
                strings1.utc
            ]
        ]);
    } catch (e) {
        console.warn(`Error displaying current time zone: ${e.stack || e}`);
        timezoneDiv.style.visibility = 'hidden';
    }
    function update() {}
    update();
    return {
        update
    };
};
const makeTopEuRegions = ({ showSlug, monthlyDimensionDownloads, downloadsPerMonth, strings: strings1, lang })=>{
    const monthlyDownloads = computeMonthlyDownloads(monthlyDimensionDownloads, 'euRegion');
    const { computeEmoji, computeUrl } = regionCountryFunctions();
    return makeTopBox({
        type: 'eu-regions',
        showSlug,
        exportId: 'top-eu-regions-export',
        previousId: 'top-eu-regions-month-previous',
        nextId: 'top-eu-regions-month-next',
        monthId: 'top-eu-regions-month',
        listId: 'top-eu-regions',
        templateId: 'top-eu-regions-row',
        cardId: 'top-eu-regions-card',
        monthlyDownloads,
        downloadsPerMonth,
        tsvHeaderNames: [
            'euRegion'
        ],
        computeEmoji,
        computeName: computeRegionName,
        computeUrl,
        strings: strings1,
        lang
    });
};
function computeRegionName(regionCountry) {
    let region = regionCountry.substring(0, regionCountry.length - ', XX'.length).trim();
    region = ({
        'Free and Hanseatic City of Hamburg': 'Hamburg'
    })[region] ?? region;
    return region;
}
const makeTopAuRegions = ({ showSlug, monthlyDimensionDownloads, downloadsPerMonth, strings: strings1, lang })=>{
    const monthlyDownloads = computeMonthlyDownloads(monthlyDimensionDownloads, 'auRegion');
    const { computeEmoji, computeUrl } = regionCountryFunctions();
    return makeTopBox({
        type: 'au-regions',
        showSlug,
        exportId: 'top-au-regions-export',
        previousId: 'top-au-regions-month-previous',
        nextId: 'top-au-regions-month-next',
        monthId: 'top-au-regions-month',
        listId: 'top-au-regions',
        templateId: 'top-au-regions-row',
        cardId: 'top-au-regions-card',
        monthlyDownloads,
        downloadsPerMonth,
        tsvHeaderNames: [
            'auRegion'
        ],
        computeEmoji,
        computeName: computeRegionName1,
        computeUrl,
        strings: strings1,
        lang
    });
};
function computeRegionName1(regionCountry) {
    const region = regionCountry.substring(0, regionCountry.length - ', XX'.length).trim();
    return region;
}
const makeTopCaRegions = ({ showSlug, monthlyDimensionDownloads, downloadsPerMonth, strings: strings1, lang })=>{
    const monthlyDownloads = computeMonthlyDownloads(monthlyDimensionDownloads, 'caRegion');
    const { computeUrl } = regionCountryFunctions('CA');
    return makeTopBox({
        type: 'ca-regions',
        showSlug,
        exportId: 'top-ca-regions-export',
        previousId: 'top-ca-regions-month-previous',
        nextId: 'top-ca-regions-month-next',
        monthId: 'top-ca-regions-month',
        listId: 'top-ca-regions',
        templateId: 'top-ca-regions-row',
        cardId: 'top-ca-regions-card',
        monthlyDownloads,
        downloadsPerMonth,
        tsvHeaderNames: [
            'caRegion'
        ],
        computeName: (v)=>v,
        computeUrl,
        strings: strings1,
        lang
    });
};
const makeTopAsRegions = ({ showSlug, monthlyDimensionDownloads, downloadsPerMonth, strings: strings1, lang })=>{
    const monthlyDownloads = computeMonthlyDownloads(monthlyDimensionDownloads, 'asRegion');
    const { computeEmoji, computeUrl } = regionCountryFunctions();
    return makeTopBox({
        type: 'as-regions',
        showSlug,
        exportId: 'top-as-regions-export',
        previousId: 'top-as-regions-month-previous',
        nextId: 'top-as-regions-month-next',
        monthId: 'top-as-regions-month',
        listId: 'top-as-regions',
        templateId: 'top-as-regions-row',
        cardId: 'top-as-regions-card',
        monthlyDownloads,
        downloadsPerMonth,
        tsvHeaderNames: [
            'asRegion'
        ],
        computeEmoji,
        computeName: computeRegionName2,
        computeUrl,
        strings: strings1,
        lang
    });
};
function computeRegionName2(regionCountry) {
    const region = regionCountry.substring(0, regionCountry.length - ', XX'.length).trim();
    return region;
}
const makeTopAfRegions = ({ showSlug, monthlyDimensionDownloads, downloadsPerMonth, strings: strings1, lang })=>{
    const monthlyDownloads = computeMonthlyDownloads(monthlyDimensionDownloads, 'afRegion');
    const { computeEmoji, computeUrl } = regionCountryFunctions();
    return makeTopBox({
        type: 'af-regions',
        showSlug,
        exportId: 'top-af-regions-export',
        previousId: 'top-af-regions-month-previous',
        nextId: 'top-af-regions-month-next',
        monthId: 'top-af-regions-month',
        listId: 'top-af-regions',
        templateId: 'top-af-regions-row',
        cardId: 'top-af-regions-card',
        monthlyDownloads,
        downloadsPerMonth,
        tsvHeaderNames: [
            'afRegion'
        ],
        computeEmoji,
        computeName: computeRegionName3,
        computeUrl,
        strings: strings1,
        lang
    });
};
function computeRegionName3(regionCountry) {
    const region = regionCountry.substring(0, regionCountry.length - ', XX'.length).trim();
    return region;
}
const makeTopLatamRegions = ({ showSlug, monthlyDimensionDownloads, downloadsPerMonth, strings: strings1, lang })=>{
    const monthlyDownloads = computeMonthlyDownloads(monthlyDimensionDownloads, 'latamRegion');
    const { computeEmoji, computeUrl } = regionCountryFunctions();
    return makeTopBox({
        type: 'latam-regions',
        showSlug,
        exportId: 'top-latam-regions-export',
        previousId: 'top-latam-regions-month-previous',
        nextId: 'top-latam-regions-month-next',
        monthId: 'top-latam-regions-month',
        listId: 'top-latam-regions',
        templateId: 'top-latam-regions-row',
        cardId: 'top-latam-regions-card',
        monthlyDownloads,
        downloadsPerMonth,
        tsvHeaderNames: [
            'latamRegion'
        ],
        computeEmoji,
        computeName: computeRegionName4,
        computeUrl,
        strings: strings1,
        lang
    });
};
function computeRegionName4(regionCountry) {
    let region = regionCountry.substring(0, regionCountry.length - ', XX'.length).trim();
    let m = /^(Departamento del? |Region del? |Provincia del? |Provincia )(.*)$/.exec(region);
    if (m) region = m[2];
    m = /^(.*)( Department| Region)$/.exec(region);
    if (m) region = m[1];
    region = ({
        'Santo Domingo de los Tsachilas': 'Santo Domingo'
    })[region] ?? region;
    return region;
}
const makeListens = ({ episodeListens, episodes, knownAppLinks = {}, strings: strings1 })=>{
    const [listensSection, listens25, listens50, listens90, listensCount, listensFromAppTemplate, listensBasedOn, listensGraph, listensGraphFooter, listensEpisode, listensGraphFooterPrevious, listensGraphFooterNext] = [
        element('listens-section'),
        element('listens-25'),
        element('listens-50'),
        element('listens-90'),
        element('listens-count'),
        element('listens-from-app'),
        element('listens-based-on'),
        element('listens-graph'),
        element('listens-graph-footer'),
        element('listens-episode'),
        element('listens-graph-footer-previous'),
        element('listens-graph-footer-next')
    ];
    if (!episodeListens) return;
    listensSection.classList.remove('hidden');
    let listens25Count = 0, listens50Count = 0, listens90Count = 0, listens = 0;
    for (const minuteMap of Object.values(episodeListens).flatMap((v)=>v.minuteMaps)){
        const listened = [
            ...minuteMap
        ].filter((v)=>v === '1').length;
        const pct = listened / minuteMap.length;
        if (pct >= .25) listens25Count++;
        if (pct >= .50) listens50Count++;
        if (pct >= .90) listens90Count++;
        listens++;
    }
    listens25.textContent = `${Math.round(listens25Count / listens * 100)}%`;
    listens50.textContent = `${Math.round(listens50Count / listens * 100)}%`;
    listens90.textContent = `${Math.round(listens90Count / listens * 100)}%`;
    const allAppCounts = Object.values(episodeListens).map((v)=>v.appCounts).reduce(incrementAll, {});
    listensCount.textContent = Object.values(allAppCounts).reduce((a, b)=>a + b, 0).toString();
    const apps = Object.keys(allAppCounts).length;
    sortBy(Object.entries(allAppCounts), (v)=>-v[1]).forEach(([appName, count], i)=>{
        if (i > 0) listensBasedOn.appendChild(document.createTextNode(i < apps - 1 ? ', ' : ', and '));
        const item = listensFromAppTemplate.content.cloneNode(true);
        const a = item.querySelector('a');
        a.textContent = appName;
        a.href = knownAppLinks[appName] ?? '#';
        item.querySelector('span').textContent = `${count}`;
        listensBasedOn.appendChild(item);
    });
    const episodeListensEntries = Object.entries(episodeListens).filter((v)=>v[1].minuteMaps.length > 0 && v[1].minuteMaps[0].length >= 3);
    if (episodeListensEntries.length === 0) return;
    [
        listensGraph,
        listensGraphFooter
    ].forEach((v)=>v.classList.remove('hidden'));
    let index = episodeListensEntries[1] && episodeListensEntries[1][1].minuteMaps.length > episodeListensEntries[0][1].minuteMaps.length ? 1 : 0;
    let chart;
    const updateGraph = ()=>{
        const [episodeGuid, { minuteMaps }] = episodeListensEntries[index];
        if (chart) chart.destroy();
        const minutes = {};
        for (const minuteMap of minuteMaps){
            [
                ...minuteMap
            ].forEach((v, i)=>increment(minutes, (i + 1).toString(), v === '1' ? 1 : 0));
        }
        chart = drawGraph(listensGraph, minutes, minuteMaps.length, strings1);
        const epName = episodes.find((v)=>v.itemGuid === episodeGuid)?.title ?? episodeGuid;
        listensEpisode.textContent = `‘${epName}’`;
        listensGraphFooterPrevious.disabled = index === episodeListensEntries.length - 1;
        listensGraphFooterNext.disabled = index === 0;
    };
    updateGraph();
    listensGraphFooterPrevious.onclick = ()=>{
        index = Math.min(index + 1, episodeListensEntries.length - 1);
        updateGraph();
    };
    listensGraphFooterNext.onclick = ()=>{
        index = Math.max(index - 1, 0);
        updateGraph();
    };
};
function drawGraph(canvas, labelsAndValues, sessions, strings1) {
    const ctx = canvas.getContext('2d');
    const values = Object.values(labelsAndValues);
    const maxValue = Math.min(Math.round(Math.max(...values) * 1.25), sessions);
    const labels = Object.keys(labelsAndValues);
    const data = {
        labels,
        datasets: [
            {
                data: values,
                backgroundColor: 'rgba(75, 192, 192, 0.75)',
                hoverBackgroundColor: 'rgba(75, 192, 192, 1)',
                pointRadius: 0,
                borderWidth: 0,
                barPercentage: 1,
                categoryPercentage: .95
            }
        ]
    };
    const config = {
        type: 'bar',
        data,
        options: {
            scales: {
                x: {
                    display: false
                },
                y: {
                    display: false,
                    min: 0,
                    max: maxValue
                }
            },
            animation: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    displayColors: false,
                    footerColor: 'rgba(154, 52, 18, 1)',
                    callbacks: {
                        title: (items)=>replacePlaceholders(strings1.minute_n, items[0].label),
                        label: (item)=>`${replacePlaceholders(strings1.x_of_n_anonymized_sessions, [
                                [
                                    'x',
                                    item.parsed.y
                                ],
                                [
                                    'sessions',
                                    sessions
                                ]
                            ])} (${Math.round(item.parsed.y / sessions * 100)}%)`
                    }
                }
            }
        }
    };
    const chart = new ts(ctx, config);
    return chart;
}
async function initShow() {
    const app = await (async ()=>{
        ts.register(me);
        ts.register(Zl);
        ts.register(rs);
        ts.register(ls);
        ts.register(ji);
        ts.register(ss);
        ts.register(Kt);
        ts.register(Wi);
        ts.register(ns);
        ts.register(Hl);
        const [debugDiv] = [
            element('debug')
        ];
        console.log(initialData);
        const { showObj, statsObj, times, lang } = initialData;
        const { showUuid, episodes = [], title: showTitle } = showObj;
        if (typeof showUuid !== 'string') throw new Error(`Bad showUuid: ${JSON.stringify(showUuid)}`);
        const grabMoreDataIfNecessary = async (page)=>{
            const { episodeHourlyDownloads, months } = statsObj;
            let changed = false;
            try {
                let needMonth;
                let epsByPubdate = sortBy(episodes, (v)=>v.pubdate ?? '1970').reverse();
                if (page === 'first') epsByPubdate = epsByPubdate.slice(0, 8);
                for (const ep of epsByPubdate){
                    const firstHour = statsObj.episodeFirstHours[ep.id];
                    if (firstHour) {
                        const month = firstHour.substring(0, 7);
                        needMonth = needMonth === undefined ? month : month < needMonth ? month : needMonth;
                    }
                }
                let haveMonth = statsObj.months[0];
                console.log(JSON.stringify({
                    page,
                    haveMonth,
                    needMonth
                }));
                if (needMonth === undefined) return changed;
                if (months.includes(needMonth)) return changed;
                const moreMonths = [];
                let grabs = 0;
                while(grabs < 10){
                    if (!haveMonth) return changed;
                    if (moreMonths.includes(needMonth)) return changed;
                    const latestMonth = addMonthsToMonthString(haveMonth, -1);
                    const qp = new URLSearchParams(document.location.search);
                    const u = new URL(`/api/1/shows/${showUuid}/stats`, document.location.href);
                    if (qp.has('ro')) u.searchParams.set('ro', 'true');
                    u.searchParams.set('token', previewToken);
                    u.searchParams.set('overall', 'stub');
                    u.searchParams.set('latestMonth', latestMonth);
                    u.searchParams.set('lookbackMonths', 2..toString());
                    console.log(`grab more show stats: ${JSON.stringify({
                        latestMonth,
                        lookbackMonths: 2
                    })}`);
                    const res = await fetch(u.toString());
                    if (res.status !== 200) throw new Error(`Unexpected status: ${res.status} ${await res.text()}`);
                    const moreStats = await res.json();
                    for (const [episodeId, hourlyDownloads] of Object.entries(moreStats.episodeHourlyDownloads)){
                        const merged = {
                            ...hourlyDownloads,
                            ...episodeHourlyDownloads[episodeId]
                        };
                        episodeHourlyDownloads[episodeId] = merged;
                    }
                    changed = true;
                    haveMonth = moreStats.months[0];
                    moreMonths.push(...moreStats.months);
                    grabs++;
                }
            } finally{
                if (page === 'first') {
                    class DataLoaded extends HTMLElement {
                    }
                    customElements.define('data-loaded', DataLoaded);
                }
            }
            return changed;
        };
        await grabMoreDataIfNecessary('first');
        const { episodeFirstHours, dailyFoundAudience, monthlyDimensionDownloads, episodeListens, knownAppLinks } = statsObj;
        const hourlyDownloads = insertZeros(statsObj.hourlyDownloads);
        const episodeHourlyDownloads = Object.fromEntries(Object.entries(statsObj.episodeHourlyDownloads).map((v)=>[
                v[0],
                insertZeros(v[1])
            ]));
        const episodesWithFirstHours = Object.entries(episodeFirstHours).map(([episodeId, firstHour])=>({
                firstHour,
                ...episodes.find((v)=>v.id === episodeId)
            }));
        const showSlug = computeShowSlug(showTitle);
        const debug = new URLSearchParams(document.location.search).has('debug');
        const mostRecentDate = Object.keys(hourlyDownloads).at(-1)?.substring(0, 10);
        if (debug) {
            debugDiv.textContent = Object.entries(times).map((v)=>v.join(': ')).join('\n');
        } else {
            debugDiv.style.display = 'none';
        }
        const headlineStats = makeHeadlineStats({
            hourlyDownloads,
            dailyFoundAudience,
            strings,
            lang
        });
        makeDownloadsGraph({
            hourlyDownloads,
            episodes: episodesWithFirstHours,
            episodeHourlyDownloads,
            debug,
            strings,
            lang
        });
        const exportDownloads = makeExportDownloads({
            showUuid,
            showSlug,
            previewToken,
            strings,
            lang
        });
        const shot = new URLSearchParams(document.location.search).has('shot');
        const { updateEpisodeHourlyDownloads } = makeEpisodePacing({
            episodeHourlyDownloads,
            episodes,
            showTitle,
            showSlug,
            mostRecentDate,
            shot,
            strings,
            lang
        });
        makeListens({
            episodeListens,
            episodes,
            knownAppLinks,
            debug,
            strings
        });
        const downloadsPerMonth = Object.fromEntries(Object.entries(monthlyDimensionDownloads).map(([month, v])=>[
                month,
                Object.values(v['countryCode'] ?? {}).reduce((a, b)=>a + b, 0)
            ]));
        makeTopCountries({
            showSlug,
            monthlyDimensionDownloads,
            strings,
            lang
        });
        makeTopApps({
            showSlug,
            monthlyDimensionDownloads,
            strings,
            lang
        });
        makeTopDevices({
            showSlug,
            monthlyDimensionDownloads,
            strings,
            lang
        });
        makeTopDeviceTypes({
            showSlug,
            monthlyDimensionDownloads,
            strings,
            lang
        });
        makeTopBrowserDownloads({
            showSlug,
            monthlyDimensionDownloads,
            downloadsPerMonth,
            strings,
            lang
        });
        makeTopMetros({
            showSlug,
            monthlyDimensionDownloads,
            downloadsPerMonth,
            strings,
            lang
        });
        makeTopCaRegions({
            showSlug,
            monthlyDimensionDownloads,
            downloadsPerMonth,
            strings,
            lang
        });
        makeTopEuRegions({
            showSlug,
            monthlyDimensionDownloads,
            downloadsPerMonth,
            strings,
            lang
        });
        makeTopAuRegions({
            showSlug,
            monthlyDimensionDownloads,
            downloadsPerMonth,
            strings,
            lang
        });
        makeTopAsRegions({
            showSlug,
            monthlyDimensionDownloads,
            downloadsPerMonth,
            strings,
            lang
        });
        makeTopLatamRegions({
            showSlug,
            monthlyDimensionDownloads,
            downloadsPerMonth,
            strings,
            lang
        });
        makeTopAfRegions({
            showSlug,
            monthlyDimensionDownloads,
            downloadsPerMonth,
            strings,
            lang
        });
        makeFooter({
            mostRecentDate,
            strings,
            lang
        });
        const langParam = new URL(document.location.href).searchParams.get('lang') ?? undefined;
        if (langParam) {
            const localized = document.querySelectorAll('a.localized');
            for (const a of localized){
                const u = new URL(a.href);
                u.searchParams.set('lang', langParam);
                a.href = u.toString();
            }
        }
        function update() {
            exportDownloads.update();
            headlineStats.update();
        }
        (async ()=>{
            if (shot) return;
            const changed = await grabMoreDataIfNecessary('all');
            updateEpisodeHourlyDownloads(changed ? Object.fromEntries(Object.entries(statsObj.episodeHourlyDownloads).map((v)=>[
                    v[0],
                    insertZeros(v[1])
                ])) : undefined, true);
        })();
        return {
            update
        };
    })();
    globalThis.addEventListener('DOMContentLoaded', ()=>{
        console.log('Document content loaded');
        app.update();
    });
    function insertZeros(hourlyDownloads) {
        const hours = Object.keys(hourlyDownloads);
        if (hours.length < 2) return hourlyDownloads;
        const maxHour = hours.at(-1);
        let hour = hours[0];
        const rt = {};
        while(hour <= maxHour){
            rt[hour] = hourlyDownloads[hour] ?? 0;
            hour = addHoursToHourString(hour, 1);
        }
        return rt;
    }
    function computeShowSlug(title) {
        return (title ?? 'untitled').toLowerCase().replaceAll(/[^a-z0-9]+/g, ' ').replaceAll(/\s+/g, ' ').trim().replaceAll(' ', '-');
    }
}
function initStats() {
    console.log('initStats!');
}
const { pathname } = document.location;
if (pathname.startsWith('/show/')) await initShow();
if (pathname === '/stats') initStats();
