import { isStringRecord } from './check.ts';
import { XMLParser } from './deps.ts';

export interface Callback {
    onStartElement?(path: string[], attributes: ReadonlyMap<string, string>, findNamespaceUri: (prefix: string) => string | undefined): void;
    onText?(text: string, path: string[], attributes: ReadonlyMap<string, string>, findNamespaceUri: (prefix: string) => string | undefined): void;
    onEndElement?(path: string[], attributes: ReadonlyMap<string, string>, findNamespaceUri: (prefix: string) => string | undefined): void;
}

export function parseXml(contents: BufferSource | string, callback: Callback): void {
    const text = typeof contents === 'string' ? contents : new TextDecoder().decode(contents);
    const p = new XMLParser({
        processEntities: false,
        ignoreAttributes: false,
        commentPropName: '#comment',
        cdataPropName: '#cdata',
        alwaysCreateTextNode: true,
        attributeNamePrefix: '@_',
        parseAttributeValue: false,
        parseTagValue: false,

    });
    const top = p.parse(text);
    const walker = new NodeVisitor(callback);
    walker.visit(top);
}

//

const EMPTY_STRING_MAP: ReadonlyMap<string, string> = new Map<string, string>();

//

class NodeVisitor {
    private readonly callback: Callback;

    private readonly path: string[] = [];
    private readonly namespaces = new XmlNamespaces();

    constructor(callback: Callback) {
        this.callback = callback;
    }

    visit(node: unknown, elementContext?: string) {
        const { callback } = this;
        if (!isStringRecord(node)) throw new Error(`Unexpected node: ${JSON.stringify(node)}, elementContext=${elementContext}`);
        let attributes: Map<string, string> | undefined;
        const elements: string[] = [];
        let text: string | undefined;

        // run through entries once to collect attributes
        for (const [ name, value ] of Object.entries(node)) {
            if (name === '?xml') {
                // "?xml": { "@_version": "1.0", "@_encoding": "UTF-8" },
            } else if (name === '?xml-stylesheet') {
                // "?xml-stylesheet": { "@_type": "text/xsl", "@_href": "/style.xsl" },
            } else if (name.startsWith('?')) {
                throw new Error(`Unsupported node: ${JSON.stringify(node)}`);
            } else if (name.startsWith('@_')) {
                if (typeof value !== 'string') throw new Error(`Unsupported ${name} attribute value: ${JSON.stringify(value)}`);
                attributes = attributes ?? new Map();
                attributes.set(name.substring(2), value);
            } else if (name === '#text') {
                if (typeof value !== 'string') throw new Error(`Unsupported text value: ${JSON.stringify(value)}`);
                text = value;
            } else if (name === '#cdata') {
                for (const item of Array.isArray(value) ? value : [ value ]) {
                    this.visit(item, elementContext);
                }
            } else if (name === '#comment') {
                // ignore for now
            } else if (name.startsWith('#')) {
                throw new Error(`Unsupported name ${name} in node: ${JSON.stringify(node)}`);
            } else {
                elements.push(name);
            }
        }
        
        const nsBefore = this.namespaces.stackSize;
        this.namespaces.push(attributes ?? EMPTY_STRING_MAP);

        if (elementContext && callback.onStartElement) callback.onStartElement(this.path, attributes ?? EMPTY_STRING_MAP, v => this.namespaces.findNamespaceUri(v));

        // process text if found
        if (text !== undefined && callback.onText) {
            callback.onText(text, this.path, attributes ?? EMPTY_STRING_MAP, v => this.namespaces.findNamespaceUri(v));
        }

        // process elements if found
        for (const element of elements) {
            const value = node[element];
            const values = Array.isArray(value) ? value : [ value ];
            for (const item of values) {
                this.path.push(element);
                this.visit(item, element);
                this.path.pop();
            }
        }

        if (elementContext && callback.onEndElement) callback.onEndElement(this.path, attributes ?? EMPTY_STRING_MAP, v => this.namespaces.findNamespaceUri(v));

        this.namespaces.pop();
        if (this.namespaces.stackSize !== nsBefore) throw new Error(`Unbalanced namespace stack`);
    }

}

class XmlNamespaces {

    private stack: ReadonlyMap<string, string>[] = [];

    get stackSize(): number { return this.stack.length; }

    push(attributes: ReadonlyMap<string, string>) {
        let map: Map<string, string> | undefined;
        for (const [ name, value ] of attributes) {
            if (name === 'xmlns') {
                map = map || new Map<string, string>();
                map.set('', value);
            } else if (name.startsWith('xmlns:')) {
                map = map || new Map<string, string>();
                const prefix = name.substring(6);
                map.set(prefix, value);
            }
        }
        this.stack.push(map || EMPTY_STRING_MAP);
    }

    pop() {
        this.stack.pop();
    }

    findNamespaceUri(prefix: string): string | undefined {
        for (let i = this.stack.length - 1; i >= 0; i--) {
            const rt = this.stack[i].get(prefix);
            if (rt) return rt;
        }
        return undefined;
    }

    getNamespaceUri(prefix: string): string {
        for (let i = this.stack.length - 1; i >= 0; i--) {
            const rt = this.stack[i].get(prefix);
            if (rt) return rt;
        }
        throw new Error(`getNamespaceUri: prefix not found: ${prefix}`);
    }

}
