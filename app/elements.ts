
export function element<T extends HTMLElement>(id: string): T {
    const rt = document.getElementById(id);
    if (!rt) throw new Error(`Element not found: ${id}`);
    return rt as T;
}

export function removeAllChildren(node: Node) {
    while (node.firstChild) node.removeChild(node.firstChild);
}

//

export interface SlDropdown extends HTMLElement {
    open: boolean;
    disabled: boolean;
}

export interface SlButton extends HTMLElement {
    disabled: boolean;
}

export interface SlSwitch extends HTMLElement {
    disabled: boolean;
    checked: boolean;
}

export interface SlMenuItem extends HTMLElement {
    disabled: boolean;
    checked: boolean;
    value: string;
}

export interface SlIconButton extends HTMLElement {
    disabled: boolean;
}

export interface SlRelativeTime extends HTMLElement {
    date: string | Date;
}

export interface SlSelectEvent extends Event {
    detail: { item: SlMenuItem };
}
