export function isDurableObjectFetchErrorRetryable(e: Error): boolean {
    const error = `${e.stack || e}`;
    if (error.includes('Network connection lost')) return true; // Error: Network connection lost.
    if (error.includes('The Durable Object\'s code has been updated')) return true; // TypeError: The Durable Object's code has been updated, this version can no longer access storage.
    if (error.includes('Response closed due to connection limit')) return true; // Error: Response closed due to connection limit
    if (error.includes('Error: Durable Object reset because its code was updated')) return true; // Error: Rpc error: Error: Durable Object reset because its code was updated.
    if (error.includes('Internal error in Durable Object storage write')) return true; // Error: Internal error in Durable Object storage write caused object to be reset.
    if (error.includes('Durable Object storage operation exceeded timeout')) return true; // Error: Durable Object storage operation exceeded timeout which caused object to be reset.
    if (error.includes('Cannot resolve Durable Object due to transient')) return true; // Error: Cannot resolve Durable Object due to transient issue on remote node.
    if (error.includes('object has moved to a different machine')) return true; // Error: cannot access storage because object has moved to a different machine
    if (error.includes('Error: internal error')) return true; // Error: internal error
    if (error.includes('Error: Network connection lost')) return true; // Error: Network connection lost.
    return false;
}
