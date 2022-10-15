
const app = (() => {
   

    const [  ] = 
    [ ].map(v => document.getElementById(v));

   
    function update() {
        {
           
        }

       
    }

    return { update };
})();

globalThis.updateApp = () => app.update();

globalThis.addEventListener('DOMContentLoaded', () => {
    console.log('Document content loaded');
    updateApp();
});
