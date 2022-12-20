
const app = (() => {

    const [ debugDiv ] = 
        [ 'debug' ].map(v => document.getElementById(v));

    function update() {
        debugDiv.textContent = Object.keys(initialData).length.toString();
        console.log(initialData);
    }

    return { update };
})();

globalThis.updateApp = () => app.update();

globalThis.addEventListener('DOMContentLoaded', () => {
    console.log('Document content loaded');
    updateApp();
});
